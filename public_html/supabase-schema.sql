-- ============================================
-- AnonChat Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Drop existing tables if they exist (clean slate)
-- ============================================
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS signals CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS banned_users CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

-- ============================================
-- Tables
-- ============================================

-- Rooms Table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id TEXT NOT NULL,
    partner_id TEXT,
    is_video BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'waiting',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Messages Table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Signals Table (WebRTC Signaling)
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports Table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id TEXT NOT NULL,
    reported_id TEXT NOT NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by TEXT
);

-- Banned Users Table
CREATE TABLE banned_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    reason TEXT,
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    banned_by TEXT
);

-- ============================================
-- Create Indexes
-- ============================================

-- Rooms indexes
CREATE INDEX idx_rooms_creator ON rooms(creator_id);
CREATE INDEX idx_rooms_partner ON rooms(partner_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_expires ON rooms(expires_at);
CREATE INDEX idx_rooms_video ON rooms(is_video);

-- Messages indexes
CREATE INDEX idx_messages_room ON messages(room_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Signals indexes
CREATE INDEX idx_signals_sender ON signals(sender_id);
CREATE INDEX idx_signals_receiver ON signals(receiver_id);
CREATE INDEX idx_signals_created ON signals(created_at);

-- Reports indexes
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_reported ON reports(reported_id);
CREATE INDEX idx_reports_status ON reports(status);

-- Banned users indexes
CREATE INDEX idx_banned_user ON banned_users(user_id);
CREATE INDEX idx_banned_expires ON banned_users(expires_at);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anonymous access
CREATE POLICY "Allow all on rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on signals" ON signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reports" ON reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on banned_users" ON banned_users FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Functions
-- ============================================

-- Function to cleanup expired rooms
CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM rooms WHERE expires_at < NOW();
    DELETE FROM signals WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(p_user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_banned BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM banned_users 
        WHERE user_id = p_user_id 
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO is_banned;
    
    RETURN is_banned;
END;
$$ LANGUAGE plpgsql;

-- Function to find waiting room
CREATE OR REPLACE FUNCTION find_waiting_room(p_user_id TEXT, p_is_video BOOLEAN)
RETURNS UUID AS $$
DECLARE
    waiting_room_id UUID;
BEGIN
    SELECT id INTO waiting_room_id
    FROM rooms
    WHERE creator_id != p_user_id
      AND partner_id IS NULL
      AND is_video = p_is_video
      AND status = 'waiting'
      AND expires_at > NOW()
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    RETURN waiting_room_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Realtime Configuration
-- ============================================

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE signals;

-- ============================================
-- Scheduled Jobs (Optional - requires pg_cron extension)
-- ============================================

-- Uncomment if pg_cron is available
-- SELECT cron.schedule('cleanup_expired_rooms', '* * * * *', 'SELECT cleanup_expired_rooms();');

-- ============================================
-- Verification
-- ============================================

-- Verify tables were created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('rooms', 'messages', 'signals', 'reports', 'banned_users');

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- 
-- Next steps:
-- 1. Go to Project Settings > API in Supabase
-- 2. Copy your Project URL and anon/public key
-- 3. Update the CONFIG in app.js with your credentials
-- 4. Deploy the files to your hosting
--
-- ============================================