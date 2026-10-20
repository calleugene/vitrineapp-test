package auth

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"os"
	"strings"
	"time"
)

type smtpDelivery struct {
	addr, host, from, username, password string
	implicitTLS                          bool
	tlsConfig                            *tls.Config
}

func smtpDeliveryFromEnv() *smtpDelivery {
	addr, from := os.Getenv("AUTH_SMTP_ADDR"), os.Getenv("AUTH_MAIL_FROM")
	if addr == "" || from == "" {
		return nil
	}
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		panic("invalid AUTH_SMTP_ADDR")
	}
	if _, err := mail.ParseAddress(from); err != nil || strings.ContainsAny(from, "\r\n") {
		panic("invalid AUTH_MAIL_FROM")
	}
	config := &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
	switch os.Getenv("AUTH_SMTP_TLS_MAX_VERSION") {
	case "":
	case "1.2":
		config.MaxVersion = tls.VersionTLS12
	case "1.3":
		config.MaxVersion = tls.VersionTLS13
	default:
		panic("invalid AUTH_SMTP_TLS_MAX_VERSION")
	}
	return &smtpDelivery{addr: addr, host: host, from: from, username: os.Getenv("AUTH_SMTP_USER"), password: os.Getenv("AUTH_SMTP_PASSWORD"), implicitTLS: port == "465", tlsConfig: config}
}

func (s *smtpDelivery) connect(ctx context.Context) (*smtp.Client, func(), error) {
	var conn net.Conn
	var err error
	if s.implicitTLS {
		_, port, _ := net.SplitHostPort(s.addr)
		ips, resolveErr := net.DefaultResolver.LookupIPAddr(ctx, s.host)
		if resolveErr != nil {
			return nil, func() {}, smtpFailure("dns", resolveErr)
		}
		addresses := make([]string, 0, len(ips))
		for _, ip := range ips {
			addresses = append(addresses, net.JoinHostPort(ip.IP.String(), port))
		}
		conn, err = s.dialVerifiedTLS(ctx, addresses)
		if err != nil {
			log.Printf("SMTP TLS connection diagnostics: tls_max=%d addresses=%v error=%v", s.tlsConfig.MaxVersion, addresses, smtpFailure("tls", err))
		}
	} else {
		conn, err = (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, "tcp", s.addr)
	}
	if err != nil {
		return nil, func() {}, smtpFailure("connection", err)
	}
	deadline := time.Now().Add(15 * time.Second)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	if err = conn.SetDeadline(deadline); err != nil {
		conn.Close()
		return nil, func() {}, smtpFailure("deadline", err)
	}
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	closeConn := func() { stop(); conn.Close() }
	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		closeConn()
		return nil, func() {}, smtpFailure("greeting", err)
	}
	closeClient := func() { client.Close(); closeConn() }
	if !s.implicitTLS {
		if err = client.StartTLS(s.tlsConfig.Clone()); err != nil {
			closeClient()
			return nil, func() {}, smtpFailure("starttls", err)
		}
	}
	if s.username != "" {
		if err = client.Auth(smtp.PlainAuth("", s.username, s.password, s.host)); err != nil {
			closeClient()
			return nil, func() {}, smtpFailure("authentication", err)
		}
	}
	return client, closeClient, nil
}

func (s *smtpDelivery) send(ctx context.Context, to, subject, body string) error {
	recipient, err := mail.ParseAddress(to)
	if err != nil || strings.ContainsAny(to, "\r\n") {
		return fmt.Errorf("invalid recipient")
	}
	sender, _ := mail.ParseAddress(s.from)
	client, closeClient, err := s.connect(ctx)
	if err != nil {
		return err
	}
	defer closeClient()
	if err = client.Mail(sender.Address); err != nil {
		return smtpFailure("mail_from", err)
	}
	if err = client.Rcpt(recipient.Address); err != nil {
		return smtpFailure("recipient", err)
	}
	writer, err := client.Data()
	if err != nil {
		return smtpFailure("data_start", err)
	}
	if _, err = fmt.Fprintf(writer, "From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n", s.from, to, mime.QEncoding.Encode("UTF-8", subject)); err != nil {
		return smtpFailure("headers", err)
	}
	encoded := quotedprintable.NewWriter(writer)
	if _, err = encoded.Write([]byte(body)); err != nil {
		return smtpFailure("body", err)
	}
	if err = encoded.Close(); err != nil {
		return smtpFailure("body_finish", err)
	}
	if err = writer.Close(); err != nil {
		return smtpFailure("acceptance", err)
	}
	// DATA was accepted; a QUIT failure must not cause duplicate delivery.
	_ = client.Quit()
	return nil
}

// Race verified TLS handshakes across DNS addresses: a TCP-accepting but stalled
// SMTP node must not block all deliveries. Credentials are sent only to the winner.
func (s *smtpDelivery) dialVerifiedTLS(ctx context.Context, addresses []string) (net.Conn, error) {
	if len(addresses) == 0 {
		return nil, fmt.Errorf("SMTP host has no addresses")
	}
	attemptCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	type result struct {
		conn net.Conn
		err  error
	}
	results := make(chan result)
	for _, address := range addresses {
		go func(address string) {
			var secure net.Conn
			raw, err := (&net.Dialer{Timeout: 8 * time.Second}).DialContext(attemptCtx, "tcp", address)
			if err == nil {
				candidate := tls.Client(raw, s.tlsConfig.Clone())
				err = candidate.HandshakeContext(attemptCtx)
				if err != nil {
					raw.Close()
				} else {
					secure = candidate
				}
			}
			select {
			case results <- result{secure, err}:
			case <-attemptCtx.Done():
				if secure != nil {
					secure.Close()
				}
			}
		}(address)
	}
	var lastErr error
	for range addresses {
		select {
		case outcome := <-results:
			if outcome.err == nil {
				return outcome.conn, nil
			}
			lastErr = outcome.err
		case <-attemptCtx.Done():
			return nil, attemptCtx.Err()
		}
	}
	return nil, lastErr
}

type smtpDeliveryError struct {
	phase string
	cause error
}

func (e *smtpDeliveryError) Error() string {
	var protocol *textproto.Error
	if errors.As(e.cause, &protocol) {
		return fmt.Sprintf("smtp %s rejected (code %d)", e.phase, protocol.Code)
	}
	var network net.Error
	if errors.As(e.cause, &network) && network.Timeout() {
		return "smtp " + e.phase + " timed out"
	}
	if errors.Is(e.cause, context.DeadlineExceeded) {
		return "smtp " + e.phase + " timed out"
	}
	return fmt.Sprintf("smtp %s failed (%T)", e.phase, e.cause)
}
func (e *smtpDeliveryError) Unwrap() error { return e.cause }
func smtpFailure(phase string, err error) error {
	if err == nil {
		return nil
	}
	return &smtpDeliveryError{phase: phase, cause: err}
}
