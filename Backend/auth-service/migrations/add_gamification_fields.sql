-- Add gamification fields to users table
ALTER TABLE users ADD COLUMN level VARCHAR(50) DEFAULT 'новичок';
ALTER TABLE users ADD COLUMN is_guest BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN locale VARCHAR(10) DEFAULT 'ru';
