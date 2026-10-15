import { NextResponse } from "next/server";
import { processMessage } from "@/app/lib/bot-engine";

/**
 * WhatsApp Webhook — Supports BOTH Gupshup and Meta Cloud API
 *
 * Auto-detects the provider from the payload format.
 * Configure which provider to use via WHATSAPP_PROVIDER env var.
 *
 * GET  → Webhook verification (Meta requires this)
 * POST → Incoming messages
 */

const PROVIDER = process.env.WHATSAPP_PROVIDER || "meta"; // "meta" or "gupshup"

/* ═══════════════════════════════════
   GET — Webhook Verification (Meta)
   ═══════════════════════════════════ */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "dawaisaathi_verify_2026";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] ✅ Verified");
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ status: "ok", service: "DawaiSaathi Webhook" });
}

/* ═══════════════════════════════════
   POST — Incoming Messages
   ═══════════════════════════════════ */
export async function POST(request) {
  try {
    const body = await request.json();

    // Auto-detect provider from payload
    let msg;
    if (body.object === "whatsapp_business_account" && body.entry) {
      msg = parseMetaMessage(body);
    } else if (body.type === "message" && body.payload) {
      msg = parseGupshupMessage(body);
    } else {
      console.log("[Webhook] ⏭️ Skipped (unknown format)");
      return NextResponse.json({ status: "skipped" }, { status: 200 });
    }

    if (!msg) {
      return NextResponse.json({ status: "skipped" }, { status: 200 });
    }

    console.log(`[Bot] 💬 From: ${msg.phone} | Name: ${msg.name} | Text: "${msg.text}"`);

    // Process through conversation engine
    const reply = await processMessage(msg);

    // Send reply via the configured provider
    if (reply) {
      if (PROVIDER === "meta") {
        await sendMetaMessage(msg.phone, reply.text).catch(err => {
          console.error("[Webhook] Async sendMetaMessage failed:", err);
        });
      } else {
        await sendGupshupMessage(msg.phone, reply.text).catch(err => {
          console.error("[Webhook] Async sendGupshupMessage failed:", err);
        });
      }
    }

    return NextResponse.json({ status: "processed" }, { status: 200 });
  } catch (err) {
    console.error("[Webhook] ❌ Error:", err.message);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}

/* ═══════════════════════════════════
   PARSE — Meta Cloud API
   ═══════════════════════════════════
   {
     "object": "whatsapp_business_account",
     "entry": [{
       "changes": [{
         "value": {
           "messages": [{ "from": "91...", "type": "text", "text": { "body": "Hi" } }],
           "contacts": [{ "profile": { "name": "User" } }]
         }
       }]
     }]
   }
*/
function parseMetaMessage(body) {
  try {
    const change = body.entry?.[0]?.changes?.[0];
    if (change?.field !== "messages") return null;

    const value = change.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    let text = "";
    if (message.type === "text") {
      text = message.text?.body || "";
    } else if (message.type === "interactive") {
      text = message.interactive?.button_reply?.title
        || message.interactive?.list_reply?.title
        || "";
    } else if (message.type === "button") {
      text = message.button?.text || "";
    } else {
      text = "[unsupported]";
    }

    return {
      phone: message.from,
      text: text.trim(),
      name: value.contacts?.[0]?.profile?.name || "User",
      messageId: message.id,
      timestamp: message.timestamp,
    };
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════
   PARSE — Gupshup
   ═══════════════════════════════════ */
function parseGupshupMessage(body) {
  if (body.type !== "message") return null;
  const payload = body.payload;
  if (!payload?.source) return null;

  let text = "";
  if (payload.type === "text") text = payload.payload?.text || "";
  else if (payload.type === "button_reply") text = payload.payload?.title || "";
  else if (payload.type === "list_reply") text = payload.payload?.title || "";
  else text = "[unsupported]";

  return {
    phone: payload.source,
    text: text.trim(),
    name: payload.sender?.name || "User",
    messageId: payload.id,
    timestamp: body.timestamp,
  };
}

/* ═══════════════════════════════════
   CONVERSATION ENGINE
   ═══════════════════════════════════ */

/* ═══════════════════════════════════
   SEND — Meta Cloud API
   ═══════════════════════════════════
   POST https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages
   Authorization: Bearer <ACCESS_TOKEN>
*/
async function sendMetaMessage(phone, text) {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log("[Meta] ⚠️ Not configured — message preview:");
    console.log(`[Meta] 📤 → ${phone}: ${text.slice(0, 100)}...`);
    return { status: "skipped" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });

    const result = await res.json();

    if (result.messages?.[0]?.id) {
      console.log(`[Meta] ✅ Sent to ${phone} (id: ${result.messages[0].id})`);
    } else {
      console.error(`[Meta] ⚠️ Response:`, JSON.stringify(result));
    }
    return result;
  } catch (err) {
    console.error(`[Meta] ❌ Failed:`, err.message);
    return { status: "error" };
  }
}

/* ═══════════════════════════════════
   SEND — Gupshup API
   ═══════════════════════════════════ */
async function sendGupshupMessage(phone, text) {
  const apiKey = process.env.GUPSHUP_API_KEY;
  const appName = process.env.GUPSHUP_APP_NAME || "DawaiSaathi";
  const sourcePhone = process.env.GUPSHUP_SOURCE_PHONE;

  if (!apiKey || !sourcePhone) {
    console.log("[Gupshup] ⚠️ Not configured — message preview:");
    console.log(`[Gupshup] 📤 → ${phone}: ${text.slice(0, 100)}...`);
    return { status: "skipped" };
  }

  try {
    const res = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", apikey: apiKey },
      body: new URLSearchParams({
        channel: "whatsapp", source: sourcePhone, destination: phone,
        "src.name": appName,
        message: JSON.stringify({ isHSM: "false", type: "text", text }),
      }),
    });
    const result = await res.json();
    if (result.status === "submitted") console.log(`[Gupshup] ✅ Sent to ${phone}`);
    else console.error(`[Gupshup] ⚠️`, result);
    return result;
  } catch (err) {
    console.error(`[Gupshup] ❌`, err.message);
    return { status: "error" };
  }
}
