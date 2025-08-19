-- Add avatar_url and preferences columns to users table
ALTER TABLE users ADD COLUMN avatar_url VARCHAR;
ALTER TABLE users ADD COLUMN preferences JSON;

-- Add order_index and is_featured columns to packages table  
ALTER TABLE packages ADD COLUMN order_index INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE packages ADD COLUMN is_featured BOOLEAN DEFAULT FALSE NOT NULL;