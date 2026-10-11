ALTER TABLE exhibits ADD COLUMN IF NOT EXISTS public_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS exhibits_public_code_unique_idx ON exhibits(public_code) WHERE public_code IS NOT NULL;
