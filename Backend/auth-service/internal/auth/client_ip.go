package auth

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

func (s *Service) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer, err := netip.ParseAddr(host)
	if err != nil {
		return host
	}
	for _, cidr := range s.config.TrustedProxyCIDRs {
		prefix, err := netip.ParsePrefix(strings.TrimSpace(cidr))
		if err != nil || !prefix.Contains(peer) {
			continue
		}
		forwarded := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		// Walk from the trusted proxy toward the first untrusted hop.
		for i := len(forwarded) - 1; i >= 0; i-- {
			candidate, err := netip.ParseAddr(strings.TrimSpace(forwarded[i]))
			if err != nil {
				return host
			}
			trusted := false
			for _, allowed := range s.config.TrustedProxyCIDRs {
				p, e := netip.ParsePrefix(strings.TrimSpace(allowed))
				if e == nil && p.Contains(candidate) {
					trusted = true
					break
				}
			}
			if !trusted {
				return candidate.String()
			}
		}
	}
	return peer.String()
}
