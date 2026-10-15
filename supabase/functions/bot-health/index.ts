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

async function getBotToken(): Promise<string | null> {
  const { data } = await supabase
    .from("bot_settings")
    .select("value")
    .eq("key", "bot_token")
    .maybeSingle();
  const token = data?.value;
  if (!token || typeof token !== "string" || token.length < 10) return null;
  return token;
}

async function registerWebhook(botToken: string): Promise<boolean> {
  // Delete any existing webhook + drop pending updates
  await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: true }),
  });

  // Register the webhook
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
  return setResult.ok === true;
}

async function updateStatus(partial: Record<string, unknown>): Promise<void> {
  try {
    await supabase
      .from("bot_status")
      .update({ ...partial, updated_at: new Date().toISOString() })
      .eq("id", 1);
  } catch { /* swallow */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "check";

    const botToken = await getBotToken();

    if (!botToken) {
      await updateStatus({
        status: "offline",
        webhook_active: false,
        telegram_api_ok: false,
        last_error: "Bot token not configured",
        bot_username: null,
      });
      return jsonResponse({ status: "offline", error: "Bot token not configured", webhookActive: false });
    }

    // Check Telegram API connectivity
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const me = await meRes.json();
    const apiOk = me.ok;

    if (!apiOk) {
      await updateStatus({
        status: "error",
        webhook_active: false,
        telegram_api_ok: false,
        last_error: me.description ?? "Telegram API unreachable",
        bot_username: null,
      });
      return jsonResponse({ status: "error", error: me.description ?? "Telegram API unreachable", webhookActive: false });
    }

    const botUsername = me.result?.username ?? null;

    // Check current webhook info
    const webhookRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhookInfo = await webhookRes.json();
    const hasWebhookUrl = webhookInfo.ok && webhookInfo.result?.url === WEBHOOK_URL;
    const pendingCount = webhookInfo.ok ? (webhookInfo.result?.pending_update_count ?? 0) : 0;
    const hasLastError = !!webhookInfo.result?.last_error_message;

    // AUTO-REPAIR: Always re-register webhook on explicit setup, or if missing/broken
    let needsRepair = false;
    if (action === "setup") {
      needsRepair = true;
    } else if (!hasWebhookUrl) {
      needsRepair = true;
    } else if (hasLastError && pendingCount > 10) {
      needsRepair = true;
    } else if (pendingCount > 100) {
      needsRepair = true;
    }

    let webhookActive = hasWebhookUrl;
    if (needsRepair) {
      const repaired = await registerWebhook(botToken);
      webhookActive = repaired;
    }

    // Determine status
    let status: string = "online";
    let lastError: string | null = null;

    if (!webhookActive) {
      status = "offline";
      lastError = "Webhook could not be registered";
    } else if (hasLastError && pendingCount > 0 && !needsRepair) {
      // Webhook had a recent error but we did not repair — note it
      status = "error";
      lastError = webhookInfo.result?.last_error_message ?? "Unknown webhook error";
    }

    await updateStatus({
      status,
      webhook_active: webhookActive,
      telegram_api_ok: apiOk,
      last_error: lastError,
      bot_username: botUsername,
      last_heartbeat: new Date().toISOString(),
    });

    return jsonResponse({
      status,
      webhookActive,
      telegramApiOk: apiOk,
      botUsername,
      pendingUpdates: needsRepair ? 0 : pendingCount,
      lastError,
      repaired: needsRepair,
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
