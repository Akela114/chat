-- Add password_hash column
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);

-- Set password_hash for existing users
UPDATE users SET password_hash = '';

-- Made password_hash not null
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- Delete password_salt column
ALTER TABLE users DROP COLUMN password_salt;
