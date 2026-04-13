-- Add last_read_message_id column to chat_participants table
ALTER TABLE chat_participants ADD COLUMN last_read_message_id INTEGER;

ALTER TABLE chat_participants ADD CONSTRAINT chat_participants_last_read_message_id_fkey
FOREIGN KEY (last_read_message_id) REFERENCES messages(id) ON DELETE CASCADE;