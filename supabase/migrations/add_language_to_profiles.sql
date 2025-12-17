-- Add language column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language VARCHAR(2) DEFAULT 'en';

-- Add a check constraint to ensure only valid language codes
ALTER TABLE profiles ADD CONSTRAINT valid_language_code
  CHECK (language IN ('en', 'tr'));

-- Create an index on the language column for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_language ON profiles(language);

-- Add a comment to document the column
COMMENT ON COLUMN profiles.language IS 'User preferred language (ISO 639-1 code): en (English), tr (Turkish)';
