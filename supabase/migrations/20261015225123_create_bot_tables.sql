/*
# Telegram Bot Panel — Database Schema

1. New Tables
- `bot_users` — Telegram users who have interacted with the bot. Columns: id (bigint, Telegram user ID), username, first_name, last_name, language_code, is_blocked, is_active, joined_at, last_activity.
- `broadcasts` — Broadcast messages sent from the panel. Columns: id (uuid), text, status (draft/scheduled/sent/failed), target_count, sent_count, failed_count, created_at, sent_at, scheduled_for.
- `messages` — Individual messages sent/received through the bot. Columns: id (uuid), bot_user_id (bigint FK), direction (incoming/outgoing), text, status, created_at.
- `bot_settings` — Key-value settings for the bot (bot token, welcome message, etc.). Columns: id (uuid), key (unique), value (jsonb), description, updated_at.
- `bot_commands` — Custom bot commands manageable from the panel. Columns: id (uuid), command, description, response, is_enabled, created_at.

2. Security
- Enable RLS on all tables.
- This is a no-auth admin panel (single-tenant) — allow anon + authenticated full CRUD on all tables so the anon-key frontend can operate.

3. Important Notes
- All tables use idempotent IF NOT EXISTS.
- bot_users.id is the Telegram numeric user ID (bigint) rather than a UUID PK.
- bot_settings uses a jsonb value column to support different setting types.
*/

-- Bot users table
CREATE TABLE IF NOT EXISTS bot_users (
  id bigint PRIMARY KEY,
  username text,
  first_name text,
  last_name text,
  language_code text,
  is_blocked boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_users" ON bot_users;
CREATE POLICY "anon_select_bot_users" ON bot_users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bot_users" ON bot_users;
CREATE POLICY "anon_insert_bot_users" ON bot_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bot_users" ON bot_users;
CREATE POLICY "anon_update_bot_users" ON bot_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bot_users" ON bot_users;
CREATE POLICY "anon_delete_bot_users" ON bot_users FOR DELETE
  TO anon, authenticated USING (true);

-- Broadcasts table
CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  target_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  scheduled_for timestamptz
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_broadcasts" ON broadcasts;
CREATE POLICY "anon_select_broadcasts" ON broadcasts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_broadcasts" ON broadcasts;
CREATE POLICY "anon_insert_broadcasts" ON broadcasts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_broadcasts" ON broadcasts;
CREATE POLICY "anon_update_broadcasts" ON broadcasts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_broadcasts" ON broadcasts;
CREATE POLICY "anon_delete_broadcasts" ON broadcasts FOR DELETE
  TO anon, authenticated USING (true);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id bigint REFERENCES bot_users(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  text text,
  status text NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending','delivered','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_messages" ON messages;
CREATE POLICY "anon_update_messages" ON messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
CREATE POLICY "anon_delete_messages" ON messages FOR DELETE
  TO anon, authenticated USING (true);

-- Bot settings table (key-value with JSONB)
CREATE TABLE IF NOT EXISTS bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_settings" ON bot_settings;
CREATE POLICY "anon_select_bot_settings" ON bot_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bot_settings" ON bot_settings;
CREATE POLICY "anon_insert_bot_settings" ON bot_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bot_settings" ON bot_settings;
CREATE POLICY "anon_update_bot_settings" ON bot_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bot_settings" ON bot_settings;
CREATE POLICY "anon_delete_bot_settings" ON bot_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Bot commands table
CREATE TABLE IF NOT EXISTS bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command text NOT NULL,
  description text NOT NULL,
  response text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bot_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_commands" ON bot_commands;
CREATE POLICY "anon_select_bot_commands" ON bot_commands FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bot_commands" ON bot_commands;
CREATE POLICY "anon_insert_bot_commands" ON bot_commands FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bot_commands" ON bot_commands;
CREATE POLICY "anon_update_bot_commands" ON bot_commands FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bot_commands" ON bot_commands;
CREATE POLICY "anon_delete_bot_commands" ON bot_commands FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_bot_users_active ON bot_users(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_users_joined ON bot_users(joined_at);
CREATE INDEX IF NOT EXISTS idx_messages_bot_user_id ON messages(bot_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);

-- Insert default settings
INSERT INTO bot_settings (key, value, description) VALUES
  ('bot_token', '""', 'Telegram Bot Token from @BotFather'),
  ('welcome_message', '"Welcome to BROXBOYS Bot! How can I help you today?"', 'Message sent when a user starts the bot'),
  ('bot_name', '"BROXBOYS"', 'Display name for the bot'),
  ('maintenance_mode', 'false', 'When true, bot only responds to admins'),
  ('auto_reply_enabled', 'true', 'When true, bot auto-replies to unhandled messages')
ON CONFLICT (key) DO NOTHING;

-- Insert default commands
INSERT INTO bot_commands (command, description, response) VALUES
  ('start', 'Start the bot', 'Welcome to BROXBOYS Bot! Use /help to see available commands.'),
  ('help', 'Show available commands', 'Available commands:\n/start - Start the bot\n/help - Show this help\n/about - About this bot'),
  ('about', 'About the bot', 'BROXBOYS Bot - Your friendly Telegram assistant.')
ON CONFLICT DO NOTHING;