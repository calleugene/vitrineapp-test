package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonMemory  uint32 = 64 * 1024
	argonTime    uint32 = 3
	argonThreads uint8  = 2
	argonKeyLen  uint32 = 32
)

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("argon2id$v=19$m=%d,t=%d,p=%d$%s$%s", argonMemory, argonTime, argonThreads, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash)), nil
}

func verifyPassword(password, encoded string) bool {
	if strings.HasPrefix(encoded, "argon2id$") {
		parts := strings.Split(encoded, "$")
		if len(parts) != 5 || parts[1] != "v=19" || parts[2] != fmt.Sprintf("m=%d,t=%d,p=%d", argonMemory, argonTime, argonThreads) {
			return false
		}
		salt, err := base64.RawStdEncoding.DecodeString(parts[3])
		if err != nil || len(salt) < 16 {
			return false
		}
		expected, err := base64.RawStdEncoding.DecodeString(parts[4])
		if err != nil || len(expected) != int(argonKeyLen) {
			return false
		}
		return hmac.Equal(argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen), expected)
	}
	// Compatibility for existing accounts; successful legacy logins are rehashed.
	parts := strings.Split(encoded, "$")
	if len(parts) != 3 || parts[0] != "sha256" {
		return false
	}
	sum := sha256.Sum256([]byte(password + ":" + parts[1]))
	return hmac.Equal([]byte(parts[2]), []byte(hex.EncodeToString(sum[:])))
}

func passwordNeedsRehash(encoded string) bool {
	return !strings.HasPrefix(encoded, "argon2id$v=19$m=65536,t=3,p=2$")
}
