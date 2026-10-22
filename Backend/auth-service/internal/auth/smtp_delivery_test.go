package auth

import (
	"bufio"
	"context"
	"crypto/tls"
	"crypto/x509"
	"io"
	"mime/quotedprintable"
	"net"
	"net/http"
	"net/http/httptest"
	"net/mail"
	"net/textproto"
	"os"
	"strings"
	"testing"
	"time"
)

func smtpFixture(t *testing.T, implicit bool) (string, *tls.Config, <-chan string) {
	t.Helper()
	certServer := httptest.NewTLSServer(http.NotFoundHandler())
	serverTLS := certServer.TLS.Clone()
	cert := certServer.Certificate()
	certServer.Close()
	roots := x509.NewCertPool()
	roots.AddCert(cert)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	messages := make(chan string, 1)
	go func() {
		raw, err := listener.Accept()
		if err != nil {
			return
		}
		defer raw.Close()
		raw.SetDeadline(time.Now().Add(5 * time.Second))
		var conn net.Conn = raw
		if implicit {
			secure := tls.Server(raw, serverTLS)
			if secure.Handshake() != nil {
				return
			}
			conn = secure
		}
		reader := bufio.NewReader(conn)
		writer := bufio.NewWriter(conn)
		reply := func(text string) { writer.WriteString(text + "\r\n"); writer.Flush() }
		reply("220 localhost SMTP test")
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			switch {
			case strings.HasPrefix(line, "EHLO"):
				reply("250-localhost\r\n250-STARTTLS\r\n250 AUTH PLAIN")
			case strings.HasPrefix(line, "STARTTLS"):
				reply("220 TLS ready")
				secure := tls.Server(raw, serverTLS)
				if secure.Handshake() != nil {
					return
				}
				conn = secure
				reader = bufio.NewReader(conn)
				writer = bufio.NewWriter(conn)
			case strings.HasPrefix(line, "AUTH PLAIN"):
				if _, ok := conn.(*tls.Conn); !ok {
					return
				}
				reply("235 Authenticated")
			case strings.HasPrefix(line, "MAIL FROM"), strings.HasPrefix(line, "RCPT TO"):
				reply("250 OK")
			case strings.HasPrefix(line, "DATA"):
				reply("354 Send message")
				data, err := textproto.NewReader(reader).ReadDotBytes()
				if err != nil {
					return
				}
				messages <- string(data)
				reply("250 Accepted")
			case strings.HasPrefix(line, "QUIT"):
				reply("221 Bye")
				return
			default:
				return
			}
		}
	}()
	return listener.Addr().String(), &tls.Config{RootCAs: roots, ServerName: "127.0.0.1", MinVersion: tls.VersionTLS12}, messages
}

func TestSMTPDeliversThroughImplicitTLSAndSTARTTLS(t *testing.T) {
	for _, implicit := range []bool{true, false} {
		name := "starttls"
		if implicit {
			name = "implicit_tls"
		}
		t.Run(name, func(t *testing.T) {
			addr, config, messages := smtpFixture(t, implicit)
			sender := &smtpDelivery{addr: addr, host: "127.0.0.1", from: "hello@example.test", username: "hello@example.test", password: "test-only", implicitTLS: implicit, tlsConfig: config}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := sender.send(ctx, "recipient@example.test", "Восстановление пароля", "Ссылка: https://example.test/reset-password?token=test-token\r\n"); err != nil {
				t.Fatal(err)
			}
			select {
			case raw := <-messages:
				message, err := mail.ReadMessage(strings.NewReader(raw))
				if err != nil {
					t.Fatal(err)
				}
				body, err := io.ReadAll(quotedprintable.NewReader(message.Body))
				if err != nil {
					t.Fatal(err)
				}
				if !strings.Contains(string(body), "Ссылка: https://example.test/reset-password?token=test-token") {
					t.Fatal("message changed")
				}
			case <-ctx.Done():
				t.Fatal("no message received")
			}
		})
	}
}

func TestSMTPRejectsUntrustedCertificate(t *testing.T) {
	addr, _, _ := smtpFixture(t, true)
	sender := &smtpDelivery{addr: addr, host: "127.0.0.1", from: "hello@example.test", implicitTLS: true, tlsConfig: &tls.Config{ServerName: "127.0.0.1", MinVersion: tls.VersionTLS12}}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := sender.send(ctx, "recipient@example.test", "Test", "Test"); err == nil {
		t.Fatal("untrusted certificate accepted")
	}
}

func TestSMTP465SelectsImplicitTLS(t *testing.T) {
	t.Setenv("AUTH_SMTP_ADDR", "smtp.example.test:465")
	t.Setenv("AUTH_MAIL_FROM", "hello@example.test")
	if !smtpDeliveryFromEnv().implicitTLS {
		t.Fatal("port 465 did not select implicit TLS")
	}
	t.Setenv("AUTH_SMTP_ADDR", "smtp.example.test:587")
	if smtpDeliveryFromEnv().implicitTLS {
		t.Fatal("port 587 skipped STARTTLS")
	}
}

func TestSMTPUsesResponsiveVerifiedAddress(t *testing.T) {
	good, config, _ := smtpFixture(t, true)
	stalled, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer stalled.Close()
	done := make(chan struct{})
	defer close(done)
	go func() {
		conn, err := stalled.Accept()
		if err == nil {
			defer conn.Close()
			<-done
		}
	}()
	sender := &smtpDelivery{tlsConfig: config}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	conn, err := sender.dialVerifiedTLS(ctx, []string{stalled.Addr().String(), good})
	if err != nil {
		t.Fatal(err)
	}
	conn.Close()
}

func TestConfiguredSMTPConnection(t *testing.T) {
	if os.Getenv("AUTH_SMTP_INTEGRATION") != "1" {
		t.Skip("explicit SMTP connection check only")
	}
	sender := smtpDeliveryFromEnv()
	if sender == nil {
		t.Fatal("SMTP configuration missing")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	client, closeClient, err := sender.connect(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer closeClient()
	if err = client.Quit(); err != nil {
		t.Fatal(err)
	}
}
