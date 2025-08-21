-- Social Features Migration
-- Run this migration to add friendship and social features to the database

-- Add privacy_settings column to users table
ALTER TABLE users ADD COLUMN privacy_settings JSON NULL;

-- Create friendships table
CREATE TABLE friendships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT _user_friend_uc UNIQUE (user_id, friend_id),
    CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

-- Create class_invitations table
CREATE TABLE class_invitations (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_instance_id INTEGER NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
    booking_id INTEGER NULL REFERENCES bookings(id) ON DELETE SET NULL,
    is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT no_self_invitation CHECK (sender_id != recipient_id)
);

-- Create indexes for better performance
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_class_invitations_sender_id ON class_invitations(sender_id);
CREATE INDEX idx_class_invitations_recipient_id ON class_invitations(recipient_id);
CREATE INDEX idx_class_invitations_class_instance_id ON class_invitations(class_instance_id);

-- Set default privacy settings for existing users
UPDATE users SET privacy_settings = '{"show_in_attendees": true, "allow_profile_viewing": true, "show_stats": true}' 
WHERE privacy_settings IS NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_invitations_updated_at BEFORE UPDATE ON class_invitations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some sample data for testing (optional - remove in production)
-- INSERT INTO friendships (user_id, friend_id, status, accepted_at) 
-- VALUES (1, 2, 'accepted', NOW()) ON CONFLICT DO NOTHING;