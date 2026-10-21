package artifacts

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
)

var ErrScreenIncomplete = errors.New("screen content incomplete")

type legacyQuestion struct {Q string `json:"q"`; A []string `json:"a"`; Correct int `json:"correct"`}

type screenContent struct {
	Body          string   `json:"body"`
	ImageURL      string   `json:"image_url"`
	ModelURL      string   `json:"model_url"`
	Options       []string `json:"options"`
	CorrectAnswer string   `json:"correct_answer"`
	Explanation   string   `json:"explanation"`
	LegacyQuestions []legacyQuestion `json:"legacy_questions,omitempty"`
}

func safeAssetURL(value string) bool {
	if value == "" {
		return true
	}
	if strings.ContainsAny(value, "\r\n\\") {
		return false
	}
	u, err := url.Parse(value)
	return err == nil && u.User == nil && ((u.Scheme == "https" && u.Host != "") || (u.Scheme == "" && u.Host == "" && strings.HasPrefix(value, "/") && !strings.HasPrefix(value, "//")))
}

func validateScreenContent(kind, payload string, ready bool) error {
	if kind == "text" {
		return nil
	}
	var envelope struct {
		Content   *screenContent `json:"content"`
		Questions []struct {
			Q       string   `json:"q"`
			A       []string `json:"a"`
			Correct int      `json:"correct"`
		} `json:"questions"`
	}
	if len(payload) > 1<<20 || json.Unmarshal([]byte(payload), &envelope) != nil {
		return ErrBadRequest
	}
	if envelope.Content == nil && kind == "quiz" && len(envelope.Questions) > 0 {
		for _, q := range envelope.Questions {
			if q.Correct < 0 || q.Correct >= len(q.A) || strings.TrimSpace(q.Q) == "" {
				return ErrBadRequest
			}
			data, _ := json.Marshal(map[string]any{"content": screenContent{Options: q.A, CorrectAnswer: q.A[q.Correct]}})
			if err := validateScreenContent("quiz", string(data), ready); err != nil {
				return err
			}
		}
		return nil
	}
	if envelope.Content == nil {
		return ErrBadRequest
	}
	c := envelope.Content
	if len(c.LegacyQuestions)>0 {
		legacy,_:=json.Marshal(map[string]any{"questions":c.LegacyQuestions})
		if err:=validateScreenContent("quiz",string(legacy),ready);err!=nil {return err}
	}
	if !safeAssetURL(c.ImageURL) || !safeAssetURL(c.ModelURL) {
		return ErrBadRequest
	}
	if kind == "model" {
		if ready && c.ModelURL == "" {
			return ErrScreenIncomplete
		}
		return nil
	}
	if len(c.Options) > 6 {
		return ErrBadRequest
	}
	seen := map[string]bool{}
	for _, option := range c.Options {
		clean := strings.TrimSpace(option)
		if clean == "" || seen[strings.ToLower(clean)] || len([]rune(clean)) > 300 {
			return ErrBadRequest
		}
		seen[strings.ToLower(clean)] = true
	}
	matched := false
	for _, option := range c.Options {
		if option == c.CorrectAnswer {
			matched = true
		}
	}
	if c.CorrectAnswer != "" && !matched {
		return ErrBadRequest
	}
	if ready && (len(c.Options) < 2 || !matched) {
		return ErrScreenIncomplete
	}
	return nil
}

// Validate the complete GLB envelope and prohibit external resource requests.
func validGLB(data []byte) bool {
	if len(data) < 20 || string(data[:4]) != "glTF" || binary.LittleEndian.Uint32(data[4:8]) != 2 || uint64(binary.LittleEndian.Uint32(data[8:12])) != uint64(len(data)) {
		return false
	}
	var manifest struct {
		Asset struct {
			Version string `json:"version"`
		} `json:"asset"`
		Buffers []struct {
			URI string `json:"uri"`
		} `json:"buffers"`
		Images []struct {
			URI string `json:"uri"`
		} `json:"images"`
	}
	offset := 12
	first := true
	for offset < len(data) {
		if len(data)-offset < 8 {
			return false
		}
		length := uint64(binary.LittleEndian.Uint32(data[offset : offset+4]))
		end := uint64(offset) + 8 + length
		if length%4 != 0 || end > uint64(len(data)) {
			return false
		}
		if first {
			if string(data[offset+4:offset+8]) != "JSON" || json.Unmarshal(bytes.TrimRight(data[offset+8:int(end)], " \x00"), &manifest) != nil || manifest.Asset.Version != "2.0" {
				return false
			}
			first = false
		}
		offset = int(end)
	}
	for _, b := range manifest.Buffers {
		if b.URI != "" && !strings.HasPrefix(b.URI, "data:") {
			return false
		}
	}
	for _, i := range manifest.Images {
		if i.URI != "" && !strings.HasPrefix(i.URI, "data:") {
			return false
		}
	}
	return !first
}

func (s *Service) uploadScreenModel(w http.ResponseWriter, r *http.Request) {
	artifactID, screenID := r.PathValue("artifactId"), r.PathValue("screenId")
	screen, err := s.repo.GetScreen(r.Context(), artifactID, screenID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if screen.Type != "model" {
		writeError(w, 400, "model_screen_required")
		return
	}
	const limit = 50 << 20
	r.Body = http.MaxBytesReader(w, r.Body, limit+(1<<20))
	if err = r.ParseMultipartForm(limit); err != nil {
		writeError(w, 400, "invalid_model_form")
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
	if err != nil {
		writeError(w, 400, "invalid_model")
		return
	}
	if len(data) > limit {
		writeError(w, 413, "file_too_large")
		return
	}
	if !validGLB(data) {
		writeError(w, 400, "invalid_glb")
		return
	}
	if s.config.AssetStore == nil {
		writeError(w, 503, "asset_storage_unavailable")
		return
	}
	assetURL, err := s.config.AssetStore.PutScreenImage(r.Context(), artifactID, screenID, ".glb", data)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"model_url": assetURL})
}
