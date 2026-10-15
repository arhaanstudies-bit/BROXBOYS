/*
# Schedule automatic bot health check every 5 minutes

1. New Functions
- call_bot_health(): A plpgsql function that uses pg_net.http_post to call
  the bot-health edge function with action=setup. This re-registers the
  webhook if it has drifted, drops pending updates, and verifies the
  Telegram API is reachable.

2. Scheduled Jobs
- bot_keepalive: Runs call_bot_health every 5 minutes using pg_cron.
  This ensures the bot webhook is continuously maintained 24/7 without
  requiring the admin panel to be open.

3. Security
- No RLS changes. The function runs as the security definer (postgres).

4. Important Notes
- The job name is bot_keepalive.
- The schedule is every 5 minutes.
- Uses pg_net to make an HTTP POST to the edge function URL.
- The Supabase URL and anon key are read from environment.
*/

CREATE OR REPLACE FUNCTION public.call_bot_health()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_url text;
  anon_key text;
  req_id integer;
BEGIN
  SELECT current_setting('app.supabase_url', true) INTO base_url;
  IF base_url IS NULL OR base_url = '' THEN
    base_url := 'https://qxsdmqpwpnxrormpnucy.supabase.co';
  END IF;

  SELECT current_setting('app.supabase_anon_key', true) INTO anon_key;
  IF anon_key IS NULL OR anon_key = '' THEN
    anon_key := '';
  END IF;

  SELECT id INTO req_id FROM net.http_post(
    url := base_url || '/functions/v1/bot-health?action=setup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule the job every 5 minutes
SELECT cron.schedule(
  'bot_keepalive',
  '*/5 * * * *',
  $$ SELECT public.call_bot_health() $$
);
