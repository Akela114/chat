-- Make chat name nullable
ALTER TABLE chats 
ALTER COLUMN name DROP NOT NULL;