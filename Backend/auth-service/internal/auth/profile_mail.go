package auth

import (
	"context"
	"fmt"
)

// EmailChangeSenderFromEnv uses the same verified TLS transport as recovery.
func EmailChangeSenderFromEnv() func(context.Context, string, string) error {
	sender := smtpDeliveryFromEnv()
	if sender == nil {
		return nil
	}
	return func(ctx context.Context, to, token string) error {
		return sender.send(ctx, to, "Витрина: подтверждение нового email", fmt.Sprintf("Код подтверждения нового email:\r\n%s\r\n\r\nВведите код в окне подтверждения профиля. Он действует 1 час.\r\n", token))
	}
}
