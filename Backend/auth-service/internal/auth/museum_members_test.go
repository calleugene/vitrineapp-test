package auth

import (
	"context"
	"net/http"
	"testing"
)

func TestMuseumTeamRemovalPermissionsAndStaleToken(t *testing.T) {
	s, repo := newTestService(t)
	owner := createTestUser(t, repo, "team-owner", "methodist")
	member := createTestUser(t, repo, "team-member", "methodist")
	admin := createTestUser(t, repo, "team-admin", "methodist")
	for id, role := range map[string]string{member.ID: "methodist", admin.ID: "museum_admin"} {
		if _, err := repo.db.Exec("UPDATE museum_memberships SET role=? WHERE user_id=?", role, id); err != nil {
			t.Fatal(err)
		}
	}
	ownerPair, err := s.issueSession(context.Background(), owner)
	if err != nil {
		t.Fatal(err)
	}
	memberPair, err := s.issueSession(context.Background(), member)
	if err != nil {
		t.Fatal(err)
	}
	if rec := profileRequest(t, s, ownerPair.AccessToken, "GET", "/auth/museums/members", ""); rec.Code != 200 {
		t.Fatalf("list: %d %s", rec.Code, rec.Body)
	}
	for _, target := range []string{owner.ID, admin.ID, "foreign-member"} {
		if rec := profileRequest(t, s, ownerPair.AccessToken, "DELETE", "/auth/museums/members/"+target, ""); rec.Code != http.StatusForbidden {
			t.Fatalf("protected %s: %d", target, rec.Code)
		}
	}
	if rec := profileRequest(t, s, memberPair.AccessToken, "DELETE", "/auth/museums/members/"+admin.ID, ""); rec.Code != 403 {
		t.Fatalf("methodist delete: %d", rec.Code)
	}
	if rec := profileRequest(t, s, ownerPair.AccessToken, "DELETE", "/auth/museums/members/"+member.ID, ""); rec.Code != 204 {
		t.Fatalf("remove: %d %s", rec.Code, rec.Body)
	}
	if rec := profileRequest(t, s, memberPair.AccessToken, "GET", "/auth/authorize-museum", ""); rec.Code != 403 {
		t.Fatalf("stale token: %d %s", rec.Code, rec.Body)
	}
	if _, err := repo.FindUserByID(context.Background(), member.ID); err != nil {
		t.Fatalf("account removed: %v", err)
	}
	if _, err := repo.MuseumRole(context.Background(), member.ID, "museum-1"); err == nil {
		t.Fatal("membership remains")
	}
}
