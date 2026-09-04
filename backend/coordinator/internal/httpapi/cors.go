package httpapi

import (
	"net/http"
	"net/netip"
	"net/url"
	"strings"
)

// WithCORS allows browser clients from localhost and private LAN addresses by
// default. Public or custom origins must be explicitly listed in
// COORDINATOR_CORS_ORIGINS. It never combines a wildcard origin with cookies.
func WithCORS(next http.Handler, allowedOrigins []string) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		origin := request.Header.Get("Origin")
		allowed := origin != "" && isAllowedOrigin(origin, allowedOrigins)
		if allowed {
			writer.Header().Set("Access-Control-Allow-Origin", origin)
			writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			writer.Header().Add("Vary", "Origin")
		}
		if request.Method == http.MethodOptions {
			if origin != "" && !allowed {
				http.Error(writer, "CORS origin is not allowed", http.StatusForbidden)
				return
			}
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func isAllowedOrigin(origin string, allowedOrigins []string) bool {
	normalized := strings.TrimRight(origin, "/")
	for _, allowed := range allowedOrigins {
		if normalized == strings.TrimRight(allowed, "/") {
			return true
		}
	}
	parsed, err := url.Parse(normalized)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" {
		return true
	}
	address, err := netip.ParseAddr(host)
	return err == nil && (address.IsLoopback() || address.IsPrivate())
}
