package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"authservice/internal/auth"
	"authservice/internal/web"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

func main() {
	dsn := os.Getenv("AUTH_DB_DSN")
	if dsn == "" {
		dsn = "file:auth.db?_pragma=foreign_keys(1)"
	}

	driver := detectDriver(dsn)
	db, err := sql.Open(driver, dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := auth.InitSchema(context.Background(), db, driver); err != nil {
		log.Fatalf("init schema: %v", err)
	}

	var repo auth.Repository
	if driver == "pgx" {
		repo = auth.NewPostgresRepository(db)
	} else {
		repo = auth.NewSQLiteRepository(db)
	}

	tokenSecret, err := requiredSecret("AUTH_TOKEN_SECRET")
	if err != nil {
		log.Fatal(err)
	}
	service := auth.NewService(repo, auth.Config{
		TrustedProxyCIDRs: strings.Split(os.Getenv("AUTH_TRUSTED_PROXY_CIDRS"), ","),
		SendEmailChange:   auth.EmailChangeSenderFromEnv(),
		AccessTokenTTL:    15 * time.Minute,
		RefreshTokenTTL:   7 * 24 * time.Hour,
		ResetTokenTTL:     30 * time.Minute,
		SendPasswordReset: auth.PasswordResetSenderFromEnv(),
		VerifyTokenTTL:    24 * time.Hour,
		TokenSecret:       tokenSecret,
		ExposeDebugTokens: envOr("AUTH_EXPOSE_DEBUG_TOKENS", "false") == "true",
		MuseumServiceURL:  envOr("MUSEUM_SERVICE_URL", "http://localhost:8081/api/v1"),
	})

	go func() {
		for {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			err := service.RunAccountDeletion(ctx)
			cancel()
			if err != nil {
				log.Printf("account deletion: %v", err)
			}
			time.Sleep(time.Minute)
		}
	}()
	if os.Getenv("AUTH_SMTP_ADDR") != "" {
		log.Printf("SMTP configured: server=%s tls_max=%s", os.Getenv("AUTH_SMTP_ADDR"), envOr("AUTH_SMTP_TLS_MAX_VERSION", "default"))
	}
	go service.RunPasswordResetDelivery(context.Background())
	addr := envOr("AUTH_HTTP_ADDR", ":8080")
	log.Printf("auth service listening on %s", addr)

	authHandler := auth.NewHandler(service)
	root := http.NewServeMux()
	root.Handle("/auth/", authHandler)
	root.Handle("/api/v1/auth/", authHandler)
	root.Handle("/users/", authHandler)
	root.Handle("/api/v1/users/", authHandler)
	root.Handle("/", web.Handler())

	if err := http.ListenAndServe(addr, withCORS(root, allowedOrigins(os.Getenv("AUTH_CORS_ORIGINS")))); err != nil {
		log.Fatal(err)
	}
}

func requiredSecret(key string) (string, error) {
	value := os.Getenv(key)
	if len(value) < 32 {
		return "", fmt.Errorf("%s must be at least 32 bytes", key)
	}
	return value, nil
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func detectDriver(dsn string) string {
	lowered := strings.ToLower(dsn)
	if strings.HasPrefix(lowered, "postgres://") || strings.HasPrefix(lowered, "postgresql://") || strings.Contains(lowered, "host=") {
		return "pgx"
	}
	return "sqlite"
}

func allowedOrigins(raw string) map[string]struct{} {
	origins := make(map[string]struct{})
	for _, origin := range strings.Split(raw, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			origins[origin] = struct{}{}
		}
	}
	return origins
}

func withCORS(next http.Handler, origins map[string]struct{}) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if _, allowed := origins[origin]; origin != "" && allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
