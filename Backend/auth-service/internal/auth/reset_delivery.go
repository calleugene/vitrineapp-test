package auth

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"time"
)

type resetMailJob struct{ ID, Email, ExpiresAt string }

func (r *profileRepository) QueuePasswordReset(ctx context.Context, id, email string, now time.Time) error {
	if _, err := r.db.ExecContext(ctx, r.query(`DELETE FROM password_reset_mail WHERE expires_at<=?`), now.Format(time.RFC3339)); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, r.query(`DELETE FROM password_reset_limits WHERE window_start<?`), now.Add(-24*time.Hour).Format(time.RFC3339)); err != nil {
		return err
	}
	_, err := r.db.ExecContext(ctx, r.query(`INSERT INTO password_reset_mail(id,email,expires_at,available_at) VALUES(?,?,?,?)`), id, email, now.Add(30*time.Minute).Format(time.RFC3339), now.Format(time.RFC3339))
	return err
}
func (r *profileRepository) LeasePasswordReset(ctx context.Context, now time.Time) (resetMailJob, error) {
	var job resetMailJob
	// One atomic lease works for SQLite and PostgreSQL, including concurrent workers.
	err := r.db.QueryRowContext(ctx, r.query(`UPDATE password_reset_mail SET available_at=?,attempts=attempts+1
 WHERE id=(SELECT id FROM password_reset_mail WHERE available_at<=? AND expires_at>? AND attempts<5 ORDER BY available_at LIMIT 1)
 AND available_at<=? RETURNING id,email,expires_at`), now.Add(time.Minute).Format(time.RFC3339), now.Format(time.RFC3339), now.Format(time.RFC3339), now.Format(time.RFC3339)).Scan(&job.ID, &job.Email, &job.ExpiresAt)
	return job, err
}
func (r *profileRepository) FinishPasswordReset(ctx context.Context, id string, now time.Time, success bool) error {
	if success {
		_, err := r.db.ExecContext(ctx, r.query(`DELETE FROM password_reset_mail WHERE id=?`), id)
		return err
	}
	_, err := r.db.ExecContext(ctx, r.query(`UPDATE password_reset_mail SET available_at=? WHERE id=?`), now.Add(time.Minute).Format(time.RFC3339), id)
	return err
}
func (s *Service) deliverPasswordReset(ctx context.Context) error {
	job, err := s.repo.LeasePasswordReset(ctx, s.config.now())
	if err != nil {
		return err
	}
	user, err := s.repo.FindUserByEmail(ctx, job.Email)
	if errors.Is(err, sql.ErrNoRows) {
		return s.repo.FinishPasswordReset(ctx, job.ID, s.config.now(), true)
	}
	if err == nil {
		token, hash, tokenErr := generateOpaqueToken()
		err = tokenErr
		if err == nil {
			expiry, parseErr := time.Parse(time.RFC3339, job.ExpiresAt)
			err = parseErr
			if err == nil {
				err = s.repo.CreatePasswordResetToken(ctx, newID("prt"), user.ID, hash, expiry, s.config.now())
			}
			if err == nil {
				err = s.config.SendPasswordReset(ctx, user.Email, token)
				if err == nil {
					log.Print("password reset message accepted by SMTP")
				}
			}
		}
	}
	finishErr := s.repo.FinishPasswordReset(ctx, job.ID, s.config.now(), err == nil)
	if err != nil {
		return err
	}
	return finishErr
}
func (s *Service) RunPasswordResetDelivery(ctx context.Context) {
	if s.config.SendPasswordReset == nil {
		log.Print("password reset mail disabled: SMTP configuration required")
		return
	}
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for i := 0; i < 10; i++ {
				jobCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
				err := s.deliverPasswordReset(jobCtx)
				cancel()
				if errors.Is(err, sql.ErrNoRows) {
					break
				}
				if err != nil {
					var smtpErr *smtpDeliveryError
					if errors.As(err, &smtpErr) {
						log.Printf("password reset delivery failed; retry scheduled: %s", smtpErr.Error())
					} else {
						log.Printf("password reset delivery failed; retry scheduled (%T)", err)
					}
					break
				}
			}
		}
	}
}
