ALTER TABLE museum_profiles ADD COLUMN IF NOT EXISTS admin_state TEXT NOT NULL DEFAULT 'active'
    CHECK (admin_state IN ('active', 'archived', 'deleted'));
ALTER TABLE museum_profiles ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';
ALTER TABLE museum_profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';
