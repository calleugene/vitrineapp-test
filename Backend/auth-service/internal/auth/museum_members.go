package auth

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type museumMember struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Status   string `json:"status"`
}

func (r *profileRepository) MuseumMembers(ctx context.Context, museumID string) ([]museumMember, error) {
	rows, err := r.db.QueryContext(ctx, r.query(`SELECT u.id,u.full_name,u.email,m.role,u.status FROM museum_memberships m JOIN users u ON u.id=m.user_id WHERE m.museum_id=? AND LOWER(u.status)<>'deleted' ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'museum_admin' THEN 1 ELSE 2 END,u.full_name,u.id`), museumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []museumMember{}
	for rows.Next() {
		var m museumMember
		if err = rows.Scan(&m.ID, &m.FullName, &m.Email, &m.Role, &m.Status); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

// Lock and recheck both memberships in the same transaction, so a concurrent
// promotion cannot turn a methodist removal into an administrator removal.
func (r *profileRepository) RemoveMuseumMember(ctx context.Context, actorID, museumID, targetID string, now time.Time) error {
	if actorID == targetID {
		return ErrForbidden
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, r.query(`UPDATE museum_memberships SET role=role WHERE museum_id=? AND user_id=? AND role IN ('owner','museum_admin')`), museumID, actorID)
	if err != nil {
		return err
	}
	if err = ensureRows(res); err != nil {
		return ErrForbidden
	}
	res, err = tx.ExecContext(ctx, r.query(`DELETE FROM museum_memberships WHERE museum_id=? AND user_id=? AND role='methodist'`), museumID, targetID)
	if err != nil {
		return err
	}
	if err = ensureRows(res); err != nil {
		return ErrForbidden
	}
	// Clear only this active context. Account and other museum memberships survive.
	_, err = tx.ExecContext(ctx, r.query(`UPDATE users SET museum_id=NULL,updated_at=? WHERE id=? AND museum_id=?`), now.UTC().Format(time.RFC3339), targetID, museumID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) museumMembers(w http.ResponseWriter, r *http.Request) {
	claims, user, err := s.Authenticate(r.Context(), bearerToken(r.Header.Get("Authorization")))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if !strings.EqualFold(user.Status, "active") || claims.MuseumID == "" {
		writeServiceError(w, ErrForbidden)
		return
	}
	role, err := s.repo.MuseumRole(r.Context(), user.ID, claims.MuseumID)
	if err != nil {
		writeServiceError(w, ErrForbidden)
		return
	}
	canManage := role == "owner" || role == "museum_admin"
	if r.Method == http.MethodDelete {
		if !canManage {
			writeServiceError(w, ErrForbidden)
			return
		}
		if err = s.repo.RemoveMuseumMember(r.Context(), user.ID, claims.MuseumID, r.PathValue("userId"), s.config.now()); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	members, err := s.repo.MuseumMembers(r.Context(), claims.MuseumID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeServiceError(w, ErrForbidden)
		} else {
			writeServiceError(w, err)
		}
		return
	}
	writeJSON(w, 200, map[string]any{"members": members, "can_manage": canManage})
}
