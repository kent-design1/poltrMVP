-- Migration: Store arguments in governance repo instead of user repos.
--
-- 1. Add author_did column
-- 2. Backfill from existing did (which was the user's DID)
-- 3. Drop obsolete columns (original_uri, governance_uri)
-- 4. Add index on author_did

BEGIN;

-- Add author_did column (nullable first for backfill)
ALTER TABLE app_arguments ADD COLUMN IF NOT EXISTS author_did text;

-- Backfill: for existing rows, the did was the actual author
UPDATE app_arguments SET author_did = did WHERE author_did IS NULL;

-- Make it NOT NULL
ALTER TABLE app_arguments ALTER COLUMN author_did SET NOT NULL;

-- Drop obsolete columns from the dual-record pattern
ALTER TABLE app_arguments DROP COLUMN IF EXISTS original_uri;
ALTER TABLE app_arguments DROP COLUMN IF EXISTS governance_uri;

-- Add index
CREATE INDEX IF NOT EXISTS app_arguments_author_did_idx ON app_arguments (author_did);

COMMIT;
