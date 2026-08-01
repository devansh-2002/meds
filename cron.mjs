import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Load environment variables for Telegram Token & Supabase
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!TOKEN) {
  console.error("❌ CRITICAL ERROR: TELEGRAM_BOT_TOKEN is not set in .env.local!");
  console.error("Cron cannot send messages without it. Exiting...");
  process.exit(1);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ CRITICAL ERROR: Supabase credentials missing in .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: ws },
});

console.log("⏰ DawaiSaathi Cron Worker Started...");
console.log(`Monitoring Supabase for scheduled reminders...`);

/**
 * Send message via Telegram Bot API
 */
async function sendTelegramMessage(chatId, text, buttons) {
  const payload = { chat_id: chatId, text: text, parse_mode: "Markdown" };
  if (buttons) {
    payload.reply_markup = { inline_keyboard: buttons };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (result.ok) {
      console.log(`✅ [${new Date().toLocaleTimeString()}] Sent reminder to ${chatId}`);
    } else {
      console.error(`⚠️ Failed to send:`, result.description);
    }
  } catch (err) {
    console.error(`❌ Network Error:`, err.message);
  }
}

// Loop every 60 seconds
setInterval(async () => {
  const now = new Date();
  const currentNormalized = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' }) + ':00';
  
  // 1. Fetch schedules that match the current time
  const { data: schedules, error: scheduleError } = await supabase
    .from('schedules')
    .select(`
      id,
      medication_id,
      scheduled_time,
      medications (
        id,
        name,
        patient_id,
        patients (
          phone,
          language
        )
      )
    `)
    .eq('scheduled_time', currentNormalized);

  if (scheduleError) {
    console.error("❌ Failed to fetch schedules:", scheduleError);
    return;
  }

  if (!schedules || schedules.length === 0) return;

  for (const schedule of schedules) {
    const med = schedule.medications;
    const patient = med.patients;
    
    // Check if we already created a pending log for this medication today
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const { data: existingLog } = await supabase
      .from('doses_log')
      .select('id')
      .eq('medication_id', med.id)
      .eq('scheduled_datetime', now.toISOString())
      .single();
      
    if (existingLog) continue; // Already processed

    // 2. Create the dose log
    const { data: logEntry, error: logError } = await supabase
      .from('doses_log')
      .insert({
        medication_id: med.id,
        scheduled_datetime: now.toISOString(),
        status: 'pending',
        alert_sent: true
      })
      .select('id')
      .single();

    if (logError) {
      console.error(`❌ Failed to log dose for ${med.name}:`, logError);
      continue;
    }

    // 3. Send Telegram Alert
    const lang = patient.language || 'en';
    const text = lang === 'en' 
       ? `⏰ *Time for your medicine!*\n\n💊 *${med.name}*\n🍽️ As Prescribed`
       : `⏰ *आपकी दवा का समय हो गया है!*\n\n💊 *${med.name}*\n🍽️ निर्देशानुसार`;
    
    const buttons = [
      [{ text: lang === 'en' ? "✅ Taken" : "✅ ले ली", callback_data: "taken" }],
      [{ text: lang === 'en' ? "⏰ Snooze" : "⏰ बाद में", callback_data: "snooze" }],
      [{ text: lang === 'en' ? "❌ Skip" : "❌ छोड़ दी", callback_data: "skip" }]
    ];
    
    await sendTelegramMessage(patient.phone, text, buttons);
  }
}, 60 * 1000);
