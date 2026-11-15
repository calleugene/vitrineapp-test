package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestAmountAndCalendarEnd(t *testing.T) {
	for _, input := range []string{`"19.99"`, `19.99`} {
		if got, err := amountKopecks(json.RawMessage(input)); got != 1999 || err != nil {
			t.Fatalf("unexpected amount %d (%v)", got, err)
		}
	}
	for _, input := range []string{`"19.999"`, `-19`, `1e2`, `null`} {
		if _, err := amountKopecks(json.RawMessage(input)); err == nil {
			t.Fatalf("accepted invalid amount %s", input)
		}
	}
	start := time.Date(2028, time.January, 31, 10, 0, 0, 0, time.UTC)
	if end := addMonths(start, 1); end.Day() != 29 || end.Month() != time.February {
		t.Fatalf("incorrect subscription expiry: %v", end)
	}
}

func TestCheckoutAndSignedWebhook(t *testing.T) {
	dsn := os.Getenv("BILLING_TEST_DB_DSN")
	if dsn == "" {
		t.Skip("set BILLING_TEST_DB_DSN to run PostgreSQL integration")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	schemaName := "billing_test_" + time.Now().Format("20060102150405_000000000")
	if _, err := db.Exec("CREATE SCHEMA " + schemaName); err != nil {
		t.Fatal(err)
	}
	defer db.Exec("DROP SCHEMA " + schemaName + " CASCADE")
	testDSN, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	opts := testDSN.Query()
	opts.Set("search_path", schemaName)
	testDSN.RawQuery = opts.Encode()
	data, err := sql.Open("pgx", testDSN.String())
	if err != nil {
		t.Fatal(err)
	}
	defer data.Close()
	if _, err := data.Exec(schema); err != nil {
		t.Fatal(err)
	}

	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		museum := r.Header.Get("Authorization")
		if museum != "Bearer museum-a" && museum != "Bearer museum-b" {
			w.WriteHeader(401)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"user": map[string]string{
			"id": "staff", "museum_id": strings.TrimPrefix(museum, "Bearer "), "email": "test@example.com",
			"role": "methodist", "status": "active",
		}})
	}))
	defer auth.Close()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	const op = "48232c9a-ce82-1593-3cb6-5c85a1ffef8f"
	var created atomic.Int32
	var applied atomic.Bool
	var bankOrder atomic.Value
	bank := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/keys" {
			_ = json.NewEncoder(w).Encode(bankJWK{
				Type: "RSA", N: base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
				E: base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
			})
			return
		}
		if r.Header.Get("Authorization") != "Bearer bank-test" {
			w.WriteHeader(403)
			return
		}
		if r.Method == "POST" && r.URL.Path == bankPayments+"_with_receipt" {
			var submitted struct {
				Data struct {
					Order  string      `json:"paymentLinkId"`
					Amount json.Number `json:"amount"`
					Client struct{ Email string }
				}
			}
			if json.NewDecoder(r.Body).Decode(&submitted) != nil || submitted.Data.Client.Email != "test@example.com" ||
				submitted.Data.Amount != "99.99" || !uuidPattern.MatchString(submitted.Data.Order) {
				w.WriteHeader(400)
				return
			}
			created.Add(1)
			bankOrder.Store(submitted.Data.Order)
			_ = json.NewEncoder(w).Encode(map[string]any{"Data": operation{ID: op, Link: "https://pay.example.test/order"}})
			return
		}
		if r.Method != "GET" || r.URL.Path != bankPayments+"/"+op {
			w.WriteHeader(404)
			return
		}
		status := "CREATED"
		if applied.Load() {
			status = "APPROVED"
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"Data": map[string]any{"Operation": []operation{{
			ID: op, OrderID: bankOrder.Load().(string), Merchant: "200000000001056", Customer: "300000092",
			Link: "https://pay.example.test/order", Status: status, Amount: json.RawMessage(`"99.99"`),
			PaidAt: "2026-11-15T12:00:00Z",
		}}}})
	}))
	defer bank.Close()

	app := &service{
		db: data, authURL: auth.URL, authClient: auth.Client(), secret: strings.Repeat("s", 32), termsVersion: "1",
		bank: &tochka{base: bank.URL, jwkURL: bank.URL + "/keys", client: bank.Client(), token: "bank-test",
			merchant: "200000000001056", customer: "300000092", checkoutHosts: []string{"pay.example.test"}},
		plans: []plan{{ID: "month", Months: 1, Amount: 9999}},
	}
	handler := app.routes()
	request := func(method, path, token string, body []byte, expected int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, bytes.NewReader(body))
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		if strings.HasPrefix(path, "/internal/") && token == "admin" {
			r.Header.Set("X-Service-Secret", app.secret)
			r.Header.Set("X-Billing-Admin", "platform-admin")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != expected {
			t.Fatalf("%s %s: got %d, wanted %d (%s)", method, path, w.Code, expected, w.Body)
		}
		return w
	}
	const prefix = "/api/v1/billing"
	input := []byte(`{"plan_id":"month","expected_amount_kopecks":9999,"terms_accepted":true,"terms_version":"1","request_id":"48232c9a-ce82-1593-3cb6-5c85a1ffef81"}`)
	request("GET", prefix+"/subscription", "", nil, 401)
	first := request("POST", prefix+"/orders", "museum-a", input, 200)
	second := request("POST", prefix+"/orders", "museum-a", input, 200)
	alias := bytes.ReplaceAll(input, []byte("ffef81"), []byte("ffef82"))
	request("POST", prefix+"/orders", "museum-a", alias, 200)
	var order payment
	if err := json.Unmarshal(first.Body.Bytes(), &order); err != nil {
		t.Fatal(err)
	}
	var duplicate payment
	if err := json.Unmarshal(second.Body.Bytes(), &duplicate); err != nil {
		t.Fatal(err)
	}
	if order.ID == "" || duplicate.ID != order.ID || created.Load() != 1 || order.Status != "pending" || order.Link == "" {
		t.Fatalf("checkout did not safely reuse first order: %+v %+v %d", order, duplicate, created.Load())
	}
	request("GET", prefix+"/orders/"+order.ID, "museum-b", nil, 404)
	request("GET", "/internal/admin/payments", "museum-a", nil, 403)

	h := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256"}`))
	p := base64.RawURLEncoding.EncodeToString([]byte(`{"webhookType":"acquiringInternetPayment","operationId":"` + op + `","paymentLinkId":"` + order.ID + `"}`))
	signing := h + "." + p
	sum := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, sum[:])
	if err != nil {
		t.Fatal(err)
	}
	webhook := prefix + "/webhooks/tochka"
	request("POST", webhook, "", []byte(signing+".Zm9yZ2Vk"), 403)

	request("POST", webhook, "", []byte(signing+"."+base64.RawURLEncoding.EncodeToString(sig)), 200)
	var grants int
	if err := data.QueryRow("SELECT count(*) FROM billing_grants").Scan(&grants); err != nil || grants != 0 {
		t.Fatalf("pending operation granted a period: %d %v", grants, err)
	}
	applied.Store(true)
	token := []byte(signing + "." + base64.RawURLEncoding.EncodeToString(sig))
	request("POST", webhook, "", token, 200)
	request("POST", webhook, "", token, 200)
	afterPayment := request("POST", prefix+"/orders", "museum-a", alias, 200)
	if !strings.Contains(afterPayment.Body.String(), order.ID) || created.Load() != 1 {
		t.Fatalf("retry created a second checkout after payment: %s", afterPayment.Body)
	}
	recheck := request("POST", "/internal/admin/payments/"+order.ID+"/recheck", "admin", []byte(`{"reason":"Проверка оплаты"}`), 200)
	if !strings.Contains(recheck.Body.String(), "platform-admin") {
		t.Fatalf("recheck audit missing: %s", recheck.Body)
	}
	var end time.Time
	if err := data.QueryRowContext(context.Background(),
		"SELECT ends_at FROM billing_subscriptions WHERE museum_id='museum-a'").Scan(&end); err != nil {
		t.Fatal(err)
	}
	if err := data.QueryRow("SELECT count(*) FROM billing_grants").Scan(&grants); err != nil {
		t.Fatal(err)
	}
	if end.UTC().Format(time.RFC3339) != "2026-12-15T12:00:00Z" || grants != 1 {
		t.Fatalf("unexpected or duplicated period: %s (%d grants)", end, grants)
	}
}
