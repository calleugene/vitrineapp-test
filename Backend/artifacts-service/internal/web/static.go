package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed ui/*
var staticFS embed.FS

func Handler() http.Handler {
	sub, err := fs.Sub(staticFS, "ui")
	if err != nil {
		panic(err)
	}
	return http.FileServer(http.FS(sub))
}
