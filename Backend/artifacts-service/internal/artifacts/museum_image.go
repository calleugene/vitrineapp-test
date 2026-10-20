package artifacts

import (
	"bytes"
	"encoding/binary"
	"image"
	"io"
	"net/http"
)

// A draft image is stored first; updating the profile publishes its stable URL.
// Keep logo_url as the storage field for compatibility with existing clients.
func (s *Service) uploadMuseumImage(w http.ResponseWriter, r *http.Request) {
	const limit = 10 << 20
	r.Body = http.MaxBytesReader(w, r.Body, limit+(1<<20))
	if err := r.ParseMultipartForm(limit); err != nil {
		writeError(w, 400, "invalid_image_form")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, 400, "file_required")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil || len(data) == 0 {
		writeError(w, 400, "invalid_image")
		return
	}
	if len(data) > limit {
		writeError(w, 413, "file_too_large")
		return
	}
	extension := ""
	switch http.DetectContentType(data) {
	case "image/jpeg":
		extension = ".jpg"
	case "image/png":
		extension = ".png"
	case "image/webp":
		extension = ".webp"
	default:
		writeError(w, 400, "unsupported_image_type")
		return
	}
	if !validMuseumImage(data, extension) {
		writeError(w, 400, "invalid_image")
		return
	}
	museumID, _ := r.Context().Value(ArtifactMuseumIDKey).(string)
	if s.config.AssetStore == nil {
		writeError(w, 503, "asset_storage_unavailable")
		return
	}
	url, err := s.config.AssetStore.PutCover(r.Context(), "museum-"+museumID, extension, data)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"image_url": url})
}

func validMuseumImage(data []byte, extension string) bool {
	if extension != ".webp" {
		cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
		return err == nil && cfg.Width > 0 && cfg.Height > 0 && int64(cfg.Width)*int64(cfg.Height) <= 25_000_000
	}
	// Parse the standard WebP dimension headers; reject a MIME-only spoof.
	if len(data) < 30 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" || int64(binary.LittleEndian.Uint32(data[4:8]))+8 != int64(len(data)) {
		return false
	}
	var width, height int64
	switch string(data[12:16]) {
	case "VP8X":
		width = 1 + int64(data[24]) + int64(data[25])<<8 + int64(data[26])<<16
		height = 1 + int64(data[27]) + int64(data[28])<<8 + int64(data[29])<<16
	case "VP8L":
		if data[20] != 0x2f {
			return false
		}
		bits := binary.LittleEndian.Uint32(data[21:25])
		width = int64(bits&0x3fff) + 1
		height = int64((bits>>14)&0x3fff) + 1
	case "VP8 ":
		if !bytes.Equal(data[23:26], []byte{0x9d, 0x01, 0x2a}) {
			return false
		}
		width = int64(binary.LittleEndian.Uint16(data[26:28]) & 0x3fff)
		height = int64(binary.LittleEndian.Uint16(data[28:30]) & 0x3fff)
	default:
		return false
	}
	return width > 0 && height > 0 && width*height <= 25_000_000
}
