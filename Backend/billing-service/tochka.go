package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const bankPayments = "/acquiring/v1.0/payments"
const bankCheckoutTTLMinutes = 30

var (
	errBankRejected = errors.New("bank rejected checkout")
	decimalAmount   = regexp.MustCompile("^[0-9]+(\\.[0-9]{1,2})?$")
)

type tochka struct {
	base, jwkURL, token, customer, merchant, tax, vat, publicURL string
	checkoutHosts                                                []string
	client                                                       *http.Client
	keysMu                                                       sync.Mutex
	keys                                                         []bankJWK
	keysUntil                                                    time.Time
}

type operation struct {
	ID       string          `json:"operationId"`
	OrderID  string          `json:"paymentLinkId"`
	Merchant string          `json:"merchantId"`
	Customer string          `json:"customerCode"`
	Status   string          `json:"status"`
	Link     string          `json:"paymentLink"`
	Amount   json.RawMessage `json:"amount"`
	PaidAt   string          `json:"paidAt"`
}

func amountKopecks(raw json.RawMessage) (int64, error) {
	value := strings.Trim(string(raw), "\"")
	if !decimalAmount.MatchString(value) {
		return 0, errors.New("invalid bank amount")
	}
	whole, fraction, _ := strings.Cut(value, ".")
	if len(whole) > 12 {
		return 0, errors.New("bank amount out of range")
	}
	return strconv.ParseInt(whole+fraction+strings.Repeat("0", 2-len(fraction)), 10, 64)
}

func (b *tochka) safeLink(link string) bool {
	parsed, err := url.Parse(link)
	if err != nil || parsed.Scheme != "https" || parsed.User != nil || parsed.Port() != "" {
		return false
	}
	for _, host := range b.checkoutHosts {
		if strings.EqualFold(parsed.Hostname(), host) {
			return true
		}
	}
	return false
}

func (b *tochka) create(ctx context.Context, order payment, email string) (operation, error) {
	returnURL := b.publicURL + "/methodist/subscription?order=" + order.ID
	amount := json.Number(fmt.Sprintf("%d.%02d", order.Amount/100, order.Amount%100))
	purpose := fmt.Sprintf("Подписка «Витрина», %d мес.", order.Months)
	body := map[string]any{"Data": map[string]any{
		"customerCode": order.Customer, "merchantId": order.Merchant,
		"amount": amount, "purpose": purpose, "paymentLinkId": order.ID,
		"paymentMode": []string{"card", "sbp"}, "ttl": bankCheckoutTTLMinutes,
		"redirectUrl": returnURL, "failRedirectUrl": returnURL,
		"preAuthorization": false, "saveCard": false, "taxSystemCode": b.tax,
		"Client": map[string]string{"email": email},
		"Items": []map[string]any{{
			"name": purpose, "amount": amount, "quantity": 1, "vatType": b.vat,
			"paymentMethod": "full_payment", "paymentObject": "service",
		}},
	}}
	var reply struct{ Data operation }
	err := b.call(ctx, http.MethodPost, bankPayments+"_with_receipt", body, &reply)
	return reply.Data, err
}

func (b *tochka) lookup(ctx context.Context, id string) (operation, error) {
	if !uuidPattern.MatchString(id) {
		return operation{}, errors.New("invalid bank operation id")
	}
	var reply struct {
		Data struct{ Operation []operation }
	}
	if err := b.call(ctx, http.MethodGet, bankPayments+"/"+id, nil, &reply); err != nil {
		return operation{}, err
	}
	if len(reply.Data.Operation) != 1 || reply.Data.Operation[0].ID != id {
		return operation{}, errors.New("unexpected bank operation response")
	}
	return reply.Data.Operation[0], nil
}

func (b *tochka) call(ctx context.Context, method, path string, body, reply any) error {
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		if err != nil {
			return err
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, b.base+path, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+b.token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := b.client.Do(req)
	if err != nil {
		return errors.New("bank transport unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		if method == http.MethodPost && (resp.StatusCode == 400 || resp.StatusCode == 401 || resp.StatusCode == 403) {
			return errBankRejected
		}
		return fmt.Errorf("unexpected bank HTTP status %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 512<<10)).Decode(reply)
}

type bankJWK struct {
	Type string `json:"kty"`
	ID   string `json:"kid"`
	N    string `json:"n"`
	E    string `json:"e"`
}

type bankEvent struct {
	Type        string `json:"webhookType"`
	OperationID string `json:"operationId"`
	OrderID     string `json:"paymentLinkId"`
}

func (b *tochka) verifiedEvent(ctx context.Context, token string) (bankEvent, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return bankEvent{}, errInvalidWebhook
	}
	header, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return bankEvent{}, errInvalidWebhook
	}
	var metadata struct{ Alg, Kid string }
	if json.Unmarshal(header, &metadata) != nil || metadata.Alg != "RS256" {
		return bankEvent{}, errInvalidWebhook
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return bankEvent{}, errInvalidWebhook
	}
	keys, err := b.publicKeys(ctx)
	if err != nil {
		return bankEvent{}, err
	}
	hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	for _, key := range keys {
		if key.Type != "RSA" || (metadata.Kid != "" && key.ID != "" && metadata.Kid != key.ID) {
			continue
		}
		n, nerr := base64.RawURLEncoding.DecodeString(key.N)
		e, eerr := base64.RawURLEncoding.DecodeString(key.E)
		if nerr != nil || eerr != nil || len(n) < 256 || len(e) == 0 || len(e) > 4 {
			continue
		}
		public := &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
		if rsa.VerifyPKCS1v15(public, crypto.SHA256, hash[:], signature) != nil {
			continue
		}
		payload, err := base64.RawURLEncoding.DecodeString(parts[1])
		var event bankEvent
		if err != nil || json.Unmarshal(payload, &event) != nil {
			return bankEvent{}, errInvalidWebhook
		}
		return event, nil
	}
	return bankEvent{}, errInvalidWebhook
}

var errInvalidWebhook = errors.New("invalid bank webhook")

func (b *tochka) publicKeys(ctx context.Context) ([]bankJWK, error) {
	b.keysMu.Lock()
	defer b.keysMu.Unlock()
	if time.Now().Before(b.keysUntil) {
		return b.keys, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.jwkURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, errors.New("bank webhook keys unavailable")
	}
	var result struct {
		bankJWK
		Keys []bankJWK `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&result); err != nil {
		return nil, err
	}
	keys := result.Keys
	if len(keys) == 0 && result.Type == "RSA" {
		keys = []bankJWK{result.bankJWK}
	}
	if len(keys) == 0 {
		return nil, errors.New("no bank webhook keys")
	}
	b.keys, b.keysUntil = keys, time.Now().Add(5*time.Minute)
	return keys, nil
}
