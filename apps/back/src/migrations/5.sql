-- Add disabled column to chat_participants table
ALTER TABLE chat_participants ADD COLUMN disabled BOOLEAN DEFAULT FALSE;