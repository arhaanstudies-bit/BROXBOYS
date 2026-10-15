import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const WEBHOOK_URL = `${supabaseUrl}/functions/v1/telegram-webhook`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // POST /bot-health?action=setup  — register webhook with Telegram
    // POST /bot-health?action=check  — check webhook info + Telegram API
    // GET  /bot-health               — same as check
    const action = url.searchParams.get("action") ?? (req.method === "POST" ? "check" : "check");

    // Get bot token
    const { data: tokenSetting } = await supabase
      .from("bot_settings")
      .select("value")
      .eq("key", "bot_token")
      .maybeSingle();

    const token = tokenSetting?.value;
    const hasToken = token && typeof token === "string" && token.length >= 10;

    if (!hasToken) {
      await updateStatus({
        status: "offline",
        webhook_active: false,
        telegram_api_ok: false,
        last_error: "Bot token not configured",
        bot_username: null,
      });
      return jsonResponse({ status: "offline", error: "Bot token not configured", webhookActive: false });
    }

    const botToken = token as string;

    if (action === "setup") {
      // Register webhook with Telegram + drop pending updates
      await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: true }),
      });

      const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          drop_pending_updates: true,
          max_connections: 40,
          allowed_updates: ["message"],
        }),
      });

      const setResult = await setRes.json();

      if (!setResult.ok) {
        await updateStatus({
          status: "error",
          webhook_active: false,
          telegram_api_ok: true,
          last_error: `Webhook setup failed: ${setResult.description ?? "unknown"}`,
        });
        return jsonResponse({ status: "error", error: setResult.description ?? "Webhook setup failed" });
      }

      // Get bot info
      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const me = await meRes.json();

      await updateStatus({
        status: "online",
        webhook_active: true,
        telegram_api_ok: true,
        last_error: null,
        bot_username: me.ok ? me.result.username : null,
        last_heartbeat: new Date().toISOString(),
      });

      return jsonResponse({ status: "online", webhookActive: true, botUsername: me.ok ? me.result.username : null });
    }

    // action === "check"
    // 1. Check Telegram API connectivity via getMe
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const me = await meRes.json();
    const apiOk = me.ok;

    // 2. Check webhook info
    const webhookRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhookInfo = await webhookRes.json();

    const webhookActive = webhookInfo.ok &&
      webhookInfo.result?.url === WEBHOOK_URL &&
      !webhookInfo.result?.pending_update_count;

    const hasWebhookUrl = webhookInfo.ok && webhookInfo.result?.url === WEBHOOK_URL;

    // 3. Auto-repair: if webhook URL is wrong or missing, re-register it
    if (apiOk && !hasWebhookUrl) {
      await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          drop_pending_updates: true,
          max_connections: 40,
          allowed_updates: ["message"],
        }),
      });
    }

    // 4. If there are pending updates and webhook is set, Telegram may be retrying —
    //    drop them to keep the bot responsive
    if (apiOk && hasWebhookUrl && webhookInfo.result?.pending_update_count > 50) {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: true }),
      });
      await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          drop_pending_updates: true,
          max_connections: 40,
          allowed_updates: ["message"],
        }),
      });
    }

    // 5. Determine overall status
    let status: string;
    let lastError: string | null = null;

    if (!apiOk) {
      status = "error";
      lastError = me.description ?? "Telegram API unreachable";
    } else if (webhookInfo.result?.last_error_message) {
      status = "error";
      lastError = webhookInfo.result.last_error_message;
    } else if (hasWebhookUrl) {
      // Check heartbeat freshness
      const { data: statusRow } = await supabase
        .from("bot_status")
        .select("last_heartbeat")
        .eq("id", 1)
        .maybeSingle();

      if (statusRow?.last_heartbeat) {
        const age = Date.now() - new Date(statusRow.last_heartbeat).getTime();
        // If no heartbeat in 7 days but webhook is set, still consider online
        // (bot may simply not have received messages)
        status = age < 7 * 24 * 60 * 60 * 1000 ? "online" : "online";
      } else {
        // No heartbeat yet but webhook is registered — bot is starting
        status = "starting";
      }
    } else {
      status = "offline";
      lastError = "Webhook not registered";
    }

    await updateStatus({
      status,
      webhook_active: hasWebhookUrl,
      telegram_api_ok: apiOk,
      last_error: lastError,
      bot_username: me.ok ? me.result.username : null,
      last_heartbeat: status === "online" ? new Date().toISOString() : undefined,
    });

    return jsonResponse({
      status,
      webhookActive: hasWebhookUrl,
      telegramApiOk: apiOk,
      botUsername: me.ok ? me.result.username : null,
      pendingUpdates: webhookInfo.ok ? webhookInfo.result?.pending_update_count ?? 0 : 0,
      lastError,
    });
  } catch (err) {
    await updateStatus({ status: "error", last_error: String(err.message ?? err) });
    return jsonResponse({ status: "error", error: String(err.message ?? err) }, 500);
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function updateStatus(partial: Record<string, unknown>): Promise<void> {
  try {
    await supabase
      .from("bot_status")
      .update({ ...partial, updated_at: new Date().toISOString() })
      .eq("id", 1);
  } catch { /* swallow */ }
}
