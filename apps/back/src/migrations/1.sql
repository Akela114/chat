-- Add password_salt column
ALTER TABLE users ADD COLUMN password_salt VARCHAR(255);

-- Set password_salt for existing users
UPDATE users SET password_salt = '';

-- Made password_salt not null
ALTER TABLE users ALTER COLUMN password_salt SET NOT NULL;

-- Delete password column
ALTER TABLE users DROP COLUMN password;
