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
	return passwordResetSender(os.Getenv("AUTH_PUBLIC_URL"), "reset-password")
}

func PlatformAdminPasswordResetSenderFromEnv() func(context.Context, string, string) error {
	return passwordResetSender(os.Getenv("AUTH_PLATFORM_ADMIN_ORIGIN"), "admin/")
}

func passwordResetSender(origin, path string) func(context.Context, string, string) error {
	sender := smtpDeliveryFromEnv()
	if sender == nil || origin == "" {
		return nil
	}
	base, err := url.Parse(origin)
	if err != nil || base.Scheme != "https" || base.Host == "" || base.User != nil {
		panic("AUTH_PUBLIC_URL must be an HTTPS URL")
	}
	return func(ctx context.Context, to, token string) error {
		link := *base
		link.Path = strings.TrimRight(base.Path, "/") + "/" + path
		link.RawPath = ""
		link.Fragment = ""
		params := url.Values{"token": {token}}.Encode()
		if path == "admin/" {
			link.RawQuery = ""
			link.Fragment = params
		} else {
			link.RawQuery = params
		}
		return sender.send(ctx, to, "Витрина: восстановление пароля", fmt.Sprintf("Для восстановления пароля перейдите по ссылке:\r\n%s\r\n\r\nСсылка действует 30 минут и может быть использована один раз.\r\nЕсли вы не запрашивали смену пароля, проигнорируйте письмо.\r\n", link.String()))
	}
}
