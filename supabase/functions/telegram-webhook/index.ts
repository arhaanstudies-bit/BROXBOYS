import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface TelegramUpdate {
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      language_code?: string;
    };
    chat: { id: number };
    text?: string;
  };
}

async function updateStatus(partial: Record<string, unknown>): Promise<void> {
  try {
    await supabase
      .from("bot_status")
      .update({ ...partial, updated_at: new Date().toISOString() })
      .eq("id", 1);
  } catch { /* never let status update crash the handler */ }
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET = health probe from the panel
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "telegram-webhook", time: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: TelegramUpdate = await req.json();
    const msg = update.message;

    if (!msg || !msg.from) {
      // Still record a heartbeat — Telegram sends empty bodies as connection tests
      await updateStatus({ status: "online", last_heartbeat: new Date().toISOString(), last_error: null });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track user (no message content stored — chats stay in Telegram only)
    await supabase.from("bot_users").upsert({
      id: msg.from.id,
      username: msg.from.username ?? null,
      first_name: msg.from.first_name ?? null,
      last_name: msg.from.last_name ?? null,
      language_code: msg.from.language_code ?? null,
      last_activity: new Date().toISOString(),
    }, { onConflict: "id" });

    const text = msg.text ?? "";

    // Mark heartbeat — bot is alive and receiving
    await updateStatus({ status: "online", last_heartbeat: new Date().toISOString(), last_error: null });

    if (text.startsWith("/")) {
      const commandName = text.slice(1).split(" ")[0].split("@")[0].toLowerCase();

      if (commandName === "start") {
        const { data: welcomeSetting } = await supabase
          .from("bot_settings")
          .select("value")
          .eq("key", "welcome_message")
          .maybeSingle();

        const welcomeText = welcomeSetting?.value
          ? typeof welcomeSetting.value === "string"
            ? welcomeSetting.value
            : String(welcomeSetting.value)
          : "Welcome!";

        await sendTelegramMessage(msg.chat.id, welcomeText);
      } else {
        const { data: cmd } = await supabase
          .from("bot_commands")
          .select("*")
          .eq("command", commandName)
          .eq("is_enabled", true)
          .maybeSingle();

        if (cmd) {
          await sendTelegramMessage(msg.chat.id, cmd.response);
        } else {
          await sendTelegramMessage(
            msg.chat.id,
            "I didn't understand that command. Use /help to see available commands."
          );
        }
      }
    } else {
      const { data: autoSetting } = await supabase
        .from("bot_settings")
        .select("value")
        .eq("key", "auto_reply_enabled")
        .maybeSingle();

      if (autoSetting?.value === true) {
        await sendTelegramMessage(
          msg.chat.id,
          "Thanks for your message! Use /help to see available commands."
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Record the error but still return 200 so Telegram doesn't retry flood
    await updateStatus({ status: "error", last_error: String(err.message ?? err), last_heartbeat: new Date().toISOString() });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = await getBotToken();
  if (!token) return;

  // Retry up to 3 times with exponential backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (res.ok) return;
      // 429 = rate limited — respect retry_after
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const wait = (body.parameters?.retry_after ?? 1) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // 5xx — retry
      if (res.status >= 500) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      // 4xx (non-429) — don't retry
      return;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
}
