/*
# Add bot_status table for health monitoring

1. New Tables
- `bot_status` — Single-row table tracking bot health and webhook state.
  Columns: id (int, always 1), status (text), webhook_active (boolean),
  last_heartbeat (timestamptz), last_error (text), telegram_api_ok (boolean),
  bot_username (text), updated_at (timestamptz).

2. Security
- Enable RLS. No-auth panel — anon + authenticated full CRUD.

3. Important Notes
- Always exactly one row with id=1, seeded on creation.
- Updated by edge functions (telegram-webhook, bot-health) and the frontend.
*/

CREATE TABLE IF NOT EXISTS bot_status (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','error','starting')),
  webhook_active boolean NOT NULL DEFAULT false,
  last_heartbeat timestamptz,
  last_error text,
  telegram_api_ok boolean NOT NULL DEFAULT false,
  bot_username text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bot_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_status" ON bot_status;
CREATE POLICY "anon_select_bot_status" ON bot_status FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bot_status" ON bot_status;
CREATE POLICY "anon_insert_bot_status" ON bot_status FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bot_status" ON bot_status;
CREATE POLICY "anon_update_bot_status" ON bot_status FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bot_status" ON bot_status;
CREATE POLICY "anon_delete_bot_status" ON bot_status FOR DELETE
  TO anon, authenticated USING (true);

-- Seed the single status row
INSERT INTO bot_status (id, status, webhook_active, telegram_api_ok)
VALUES (1, 'offline', false, false)
ON CONFLICT (id) DO NOTHING;
