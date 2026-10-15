/*
# Drop unused messages table

The messages table stored copies of individual chat messages. Per user request,
chat data should NOT be backed up in the cloud — it stays in Telegram only.

1. Removed Tables
- `messages` — all message logging has been removed. The webhook no longer
  stores incoming/outgoing messages. Broadcasts still track delivery counts
  in the `broadcasts` table, but individual message content is not stored.

2. Security
- No security changes — only removing an unused table.
*/

DROP TABLE IF EXISTS messages CASCADE;
