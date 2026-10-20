package auth

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
)

// PasswordResetSenderFromEnv captures only trusted server configuration.
func PasswordResetSenderFromEnv() func(context.Context, string, string) error {
	sender := smtpDeliveryFromEnv()
	origin := os.Getenv("AUTH_PUBLIC_URL")
	if sender == nil || origin == "" {
		return nil
	}
	base, err := url.Parse(origin)
	if err != nil || base.Scheme != "https" || base.Host == "" || base.User != nil {
		panic("AUTH_PUBLIC_URL must be an HTTPS URL")
	}
	return func(ctx context.Context, to, token string) error {
		link := *base
		link.Path = strings.TrimRight(base.Path, "/") + "/reset-password"
		link.RawPath = ""
		link.RawQuery = url.Values{"token": {token}}.Encode()
		link.Fragment = ""
		return sender.send(ctx, to, "Витрина: восстановление пароля", fmt.Sprintf("Для восстановления пароля перейдите по ссылке:\r\n%s\r\n\r\nСсылка действует 30 минут и может быть использована один раз.\r\nЕсли вы не запрашивали смену пароля, проигнорируйте письмо.\r\n", link.String()))
	}
}
