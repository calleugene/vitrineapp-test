package artifacts

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// AssetStore isolates binary storage from exhibit data. Production can replace
// LocalAssetStore with an S3-compatible implementation without changing API
// or publication snapshots.
type AssetStore interface {
	PutCover(ctx context.Context, artifactID, extension string, data []byte) (string, error)
	PutScreenImage(ctx context.Context, artifactID, screenID, extension string, data []byte) (string, error)
}

type LocalAssetStore struct {
	dir        string
	publicPath string
}

func NewLocalAssetStore(dir, publicPath string) (*LocalAssetStore, error) {
	if strings.TrimSpace(dir) == "" {
		return nil, fmt.Errorf("asset directory is required")
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("create asset directory: %w", err)
	}
	return &LocalAssetStore{dir: dir, publicPath: strings.TrimRight(publicPath, "/")}, nil
}

func (s *LocalAssetStore) PutCover(_ context.Context, artifactID, extension string, data []byte) (string, error) {
	return s.putImage(artifactID+"-"+newID("cover")+extension, data)
}

func (s *LocalAssetStore) PutScreenImage(_ context.Context, artifactID, screenID, extension string, data []byte) (string, error) {
	return s.putImage(artifactID+"-"+screenID+"-"+newID("screen")+extension, data)
}

func (s *LocalAssetStore) putImage(name string, data []byte) (string, error) {
	path := filepath.Join(s.dir, name)
	if err := os.WriteFile(path, data, 0o640); err != nil {
		return "", fmt.Errorf("write cover: %w", err)
	}
	return s.publicPath + "/" + name, nil
}

func (s *LocalAssetStore) FS() fs.FS { return os.DirFS(s.dir) }
