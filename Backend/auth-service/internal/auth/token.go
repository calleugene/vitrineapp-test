package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

func generateOpaqueToken() (string, string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	return token, tokenHashString(token), nil
}

func tokenHashString(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Service) signAccessToken(claims accessClaims) (string, error) {
	if len(s.config.TokenSecret) < 32 {
		return "", fmt.Errorf("token secret must be at least 32 bytes")
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payloadEncoded := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(s.config.TokenSecret))
	if _, err := mac.Write([]byte(payloadEncoded)); err != nil {
		return "", err
	}
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payloadEncoded + "." + signature, nil
}

func (s *Service) parseAccessToken(token string) (accessClaims, error) {
	var claims accessClaims
	if len(s.config.TokenSecret) < 32 {
		return claims, ErrUnauthorized
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return claims, ErrUnauthorized
	}
	mac := hmac.New(sha256.New, []byte(s.config.TokenSecret))
	if _, err := mac.Write([]byte(parts[0])); err != nil {
		return claims, err
	}
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(parts[1]), []byte(expectedSig)) {
		return claims, ErrUnauthorized
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return claims, ErrUnauthorized
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return claims, ErrUnauthorized
	}
	if claims.ExpiresAt < s.config.now().Unix() {
		return claims, ErrUnauthorized
	}
	return claims, nil
}

func bearerToken(header string) string {
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(header, "Bearer ")
}

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

func newMuseumID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "mus_" + hex.EncodeToString(b), nil
}

func isUnauthorized(err error) bool {
	return errors.Is(err, ErrUnauthorized)
}
