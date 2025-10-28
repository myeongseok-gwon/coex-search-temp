-- Add consent columns to existing user table (idempotent)
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS consent_test_participation BOOLEAN DEFAULT FALSE;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS consent_privacy_collection BOOLEAN DEFAULT FALSE;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS consent_third_party_sharing BOOLEAN DEFAULT FALSE;


