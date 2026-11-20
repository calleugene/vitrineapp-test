package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	_ "embed"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

//go:embed schema.sql
var schema string

//go:embed tochka-ca.pem
var tochkaCA []byte

type plan struct {
	ID     string `json:"id"`
	Months int    `json:"months"`
	Amount int64  `json:"amount_kopecks"`
}

var (
	uuidPattern     = regexp.MustCompile("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")
	merchantPattern = regexp.MustCompile("^[0-9]{15}$")
	customerPattern = regexp.MustCompile("^[0-9]{9}$")
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	authURL := strings.TrimRight(os.Getenv("BILLING_AUTH_URL"), "/")
	secret := os.Getenv("BILLING_INTERNAL_SECRET")
	if authURL == "" || len(secret) < 32 || os.Getenv("BILLING_DB_DSN") == "" {
		return errors.New("billing auth URL, database DSN and internal secret are required")
	}
	bank, plans, err := bankConfig()
	if err != nil {
		return err
	}
	db, err := sql.Open("pgx", os.Getenv("BILLING_DB_DSN"))
	if err != nil {
		return errors.New("could not open billing database configuration")
	}
	defer db.Close()
	db.SetMaxOpenConns(12)
	db.SetMaxIdleConns(4)
	migration, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	tx, err := db.BeginTx(migration, nil)
	if err != nil {
		return errors.New("billing database unavailable")
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(migration, "SELECT pg_advisory_xact_lock(749113)"); err != nil {
		return errors.New("billing schema lock failed")
	}
	for _, statement := range strings.Split(schema, ";") {
		if strings.TrimSpace(statement) == "" {
			continue
		}
		if _, err = tx.ExecContext(migration, statement); err != nil {
			return errors.New("billing schema migration failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return errors.New("billing schema commit failed")
	}

	app := &service{
		db: db, bank: bank, plans: plans, authURL: authURL, secret: secret,
		termsURL: os.Getenv("BILLING_TERMS_URL"), termsVersion: os.Getenv("BILLING_TERMS_VERSION"),
		authClient: &http.Client{
			Timeout:       3 * time.Second,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
		},
	}
	address := os.Getenv("BILLING_HTTP_ADDR")
	if address == "" {
		address = ":8089"
	}
	server := &http.Server{
		Addr: address, Handler: app.routes(), ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 12 * time.Second, WriteTimeout: 17 * time.Second, IdleTimeout: 60 * time.Second,
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		if bank != nil {
			app.reconcileLoop(ctx)
		}
	}()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 12*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	log.Printf("billing listening on %s (bank configured: %t)", address, bank != nil)
	err = server.ListenAndServe()
	stop()
	<-done
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func bankConfig() (*tochka, []plan, error) {
	if os.Getenv("BILLING_ENABLED") != "true" {
		return nil, []plan{}, nil
	}
	client, err := bankHTTPClient()
	if err != nil {
		return nil, nil, err
	}
	bank := &tochka{
		base:          "https://enter.tochka.com/uapi",
		jwkURL:        "https://enter.tochka.com/doc/openapi/static/keys/public",
		token:         os.Getenv("TOCHKA_API_TOKEN"),
		customer:      os.Getenv("TOCHKA_CUSTOMER_CODE"),
		merchant:      os.Getenv("TOCHKA_MERCHANT_ID"),
		tax:           os.Getenv("TOCHKA_RECEIPT_TAX_SYSTEM"),
		vat:           os.Getenv("TOCHKA_RECEIPT_VAT"),
		publicURL:     strings.TrimRight(os.Getenv("BILLING_PUBLIC_URL"), "/"),
		checkoutHosts: strings.Fields(os.Getenv("TOCHKA_CHECKOUT_HOSTS")),
		client:        client,
	}
	publicURL, err := url.Parse(bank.publicURL)
	if err != nil || publicURL.Scheme != "https" || publicURL.Host == "" || publicURL.Path != "" ||
		publicURL.User != nil || publicURL.RawQuery != "" || publicURL.Fragment != "" {
		return nil, nil, errors.New("BILLING_PUBLIC_URL must be an HTTPS origin")
	}
	if bank.token == "" || !customerPattern.MatchString(bank.customer) || !merchantPattern.MatchString(bank.merchant) ||
		bank.tax == "" || bank.vat == "" || len(bank.checkoutHosts) == 0 {
		return nil, nil, errors.New("Tochka token, merchant, customer, checkout hosts and receipt settings required")
	}
	termsURL, err := url.Parse(os.Getenv("BILLING_TERMS_URL"))
	if err != nil || termsURL.Scheme != "https" || termsURL.Host == "" || termsURL.User != nil ||
		strings.TrimSpace(os.Getenv("BILLING_TERMS_VERSION")) == "" {
		return nil, nil, errors.New("published HTTPS terms URL and version required")
	}

	var plans []plan
	for _, item := range []struct {
		id, env string
		months  int
	}{
		{"month", "BILLING_PRICE_MONTH_KOPECKS", 1},
		{"year", "BILLING_PRICE_YEAR_KOPECKS", 12},
	} {
		value := os.Getenv(item.env)
		if value == "" {
			continue
		}
		amount, err := strconv.ParseInt(value, 10, 64)
		if err != nil || amount <= 0 || amount > 100_000_000_00 {
			return nil, nil, errors.New("invalid subscription price in " + item.env)
		}
		plans = append(plans, plan{item.id, item.months, amount})
	}
	if len(plans) == 0 {
		return nil, nil, errors.New("at least one subscription price is required")
	}
	return bank, plans, nil
}

func bankHTTPClient() (*http.Client, error) {
	roots, err := x509.SystemCertPool()
	if err != nil {
		return nil, errors.New("could not load the system certificate pool for Tochka")
	}
	if !roots.AppendCertsFromPEM(tochkaCA) {
		return nil, errors.New("could not load the documented Tochka CA bundle")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12}
	return &http.Client{
		Transport: transport, Timeout: 6 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}, nil
}
