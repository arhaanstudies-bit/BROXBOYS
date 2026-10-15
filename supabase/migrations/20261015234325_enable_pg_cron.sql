/*
# Enable pg_cron and pg_net for scheduled bot health checks

1. New Extensions
- pg_cron: PostgreSQL job scheduler for running periodic tasks.
- pg_net: HTTP client for making outbound requests from the database.

2. Purpose
- Schedule a recurring job that calls the bot-health edge function
  every 5 minutes to keep the Telegram webhook alive and auto-repaired,
  even when the admin panel is not open in a browser.

3. Security
- No RLS changes. pg_cron runs as the postgres superuser.

4. Important Notes
- The cron schedule expression is star-slash-5 space star space star space star space star
  which means every 5 minutes.
- The edge function checks Telegram API, verifies webhook registration,
  and re-registers if missing.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
