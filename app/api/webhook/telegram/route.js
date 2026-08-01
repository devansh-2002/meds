import { NextResponse } from "next/server";
import { processMessage } from "@/app/lib/bot-engine";

/**
 * Telegram Bot Webhook
 *
 * Setup:
 * 1. Message @BotFather on Telegram → /newbot → name it "DawaiSaathi"
 * 2. Copy the token → paste in .env.local as TELEGRAM_BOT_TOKEN
 * 3. Set webhook: curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<NGROK_URL>/api/webhook/telegram"
 * 4. Send /start to your bot on Telegram → you're live!
 */

export async function POST(request) {
  try {
    const body = await request.json();

    // Parse Telegram update
    const msg = parseTelegramUpdate(body);
    if (!msg) {
      return NextResponse.json({ ok: true });
    }

    console.log(`[Telegram] 💬 From: ${msg.name} (${msg.chatId}) | Text: "${msg.text}"`);

    // Process through shared conversation engine (async — uses Supabase)
    const reply = await processMessage(msg);

    if (reply) {
      // Fire-and-forget the outgoing message and callback answer so the incoming webhook is not blocked
      sendTelegramMessage(msg.chatId, reply.text, reply.buttons).catch(err => {
        console.error('[Telegram] Async send message failed:', err);
      });

      // Stop the loading spinner on Telegram buttons
      if (msg.isCallback && msg.callbackId) {
        fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: msg.callbackId }),
        }).catch(err => console.error('Failed to answer callback:', err));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Telegram] ❌ Error:', err.message);
    return NextResponse.json({ ok: true });
  }
}

/**
 * Parse Telegram Update
 *
 * Telegram sends:
 * {
 *   "update_id": 123,
 *   "message": {
 *     "message_id": 456,
 *     "from": { "id": 789, "first_name": "Devansh", "username": "devansh" },
 *     "chat": { "id": 789, "type": "private" },
 *     "date": 1778308000,
 *     "text": "Hi"
 *   }
 * }
 *
 * Callback queries (inline button clicks):
 * {
 *   "callback_query": {
 *     "data": "taken",
 *     "from": { ... },
 *     "message": { "chat": { "id": 789 } }
 *   }
 * }
 */
function parseTelegramUpdate(body) {
  // Regular message
  if (body.message?.text) {
    const m = body.message;
    return {
      chatId: m.chat.id,
      phone: String(m.from.id),
      text: m.text.trim(),
      name: m.from.first_name || "User",
      messageId: m.message_id,
      timestamp: m.date,
    };
  }

  // Callback query (inline button press)
  if (body.callback_query) {
    const cb = body.callback_query;
    return {
      chatId: cb.message.chat.id,
      phone: String(cb.from.id),
      text: cb.data || "",
      name: cb.from.first_name || "User",
      messageId: cb.message.message_id,
      timestamp: Date.now(),
      isCallback: true,
      callbackId: cb.id,
    };
  }

  return null;
}

/**
 * Send message via Telegram Bot API
 * Supports Markdown formatting and inline keyboard buttons
 */
async function sendTelegramMessage(chatId, text, buttons) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log("[Telegram] ⚠️ Token not set — preview:");
    console.log(`[Telegram] 📤 → ${chatId}: ${text.slice(0, 120)}...`);
    return;
  }

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown",
  };

  // Add quick-reply buttons for dose reminders
  if (buttons) {
    payload.reply_markup = {
      inline_keyboard: buttons,
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (result.ok) {
      console.log(`[Telegram] ✅ Sent to ${chatId} (msg: ${result.result.message_id})`);
    } else {
      console.error(`[Telegram] ⚠️ Error:`, result.description);
    }

    return result;
  } catch (err) {
    console.error(`[Telegram] ❌ Failed:`, err.message);
  }
}
