package artifacts

import (
	"crypto/rand"
	"encoding/hex"
)

func newID(prefix string) string {
	buf := make([]byte, 8)
	_, _ = rand.Read(buf)
	return prefix + "_" + hex.EncodeToString(buf)
}

func newPublicCode() string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	buf := make([]byte, 5)
	for index := range buf {
		for {
			var randomByte [1]byte
			if _, err := rand.Read(randomByte[:]); err != nil {
				return "AAAAA"
			}
			if randomByte[0] < 252 {
				buf[index] = alphabet[int(randomByte[0])%len(alphabet)]
				break
			}
		}
	}
	return string(buf)
}
