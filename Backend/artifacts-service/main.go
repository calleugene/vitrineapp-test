package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"artifactsservice/internal/artifacts"
	"artifactsservice/internal/web"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	dsn := envOr("ARTIFACTS_DB_DSN", "postgresql://viralabs:dev_password@localhost:5432/viralabs_artifacts?sslmode=disable")
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := artifacts.ApplyPostgresMigrations(context.Background(), db); err != nil {
		log.Fatalf("apply postgres migrations: %v", err)
	}
	assetStore, err := artifacts.NewLocalAssetStore(
		envOr("ARTIFACTS_ASSET_DIR", "/data/assets"),
		envOr("ARTIFACTS_ASSET_PUBLIC_URL", "http://localhost:8081/assets"),
	)
	if err != nil {
		log.Fatalf("configure asset storage: %v", err)
	}

	repo := artifacts.NewPostgresRepository(db)
	tokenSecret := os.Getenv("ARTIFACTS_TOKEN_SECRET")
	if tokenSecret == "" {
		log.Fatal("ARTIFACTS_TOKEN_SECRET must be configured; protected museum APIs cannot run without it")
	}
	service := artifacts.NewService(repo, artifacts.Config{
		PublicBaseURL:  envOr("ARTIFACTS_PUBLIC_BASE_URL", "http://localhost:5173"),
		AssetStore:     assetStore,
		TokenSecret:    tokenSecret,
		AuthServiceURL: envOr("AUTH_SERVICE_URL", "http://localhost:8080/api/v1"),
	})
	addr := envOr("ARTIFACTS_HTTP_ADDR", ":8081")
	log.Printf("artifacts service listening on %s", addr)
	apiHandler := artifacts.NewHandler(service)
	root := http.NewServeMux()
	root.Handle("/artifacts/", apiHandler)
	root.Handle("/artifacts", apiHandler)
	root.Handle("/api/v1/artifacts/", apiHandler)
	root.Handle("/api/v1/artifacts", apiHandler)
	root.Handle("/api/v1/internal/museums/", apiHandler)
	root.Handle("/api/v1/museums/", apiHandler)
	root.Handle("/api/v1/museums", apiHandler)
	root.Handle("/api/v1/public/", apiHandler)
	root.Handle("/media/", apiHandler)
	root.Handle("/media", apiHandler)
	root.Handle("/models/", apiHandler)
	root.Handle("/models", apiHandler)
	root.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.FS(assetStore.FS()))))
	root.Handle("/", web.Handler())

	server := &http.Server{Addr: addr, Handler: withCORS(root), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Museum-ID")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
