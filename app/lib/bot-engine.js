import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

/**
 * DawaiSaathi — Shared Conversation Engine (i18n)
 *
 * Platform-agnostic bot logic. Used by both WhatsApp and Telegram webhooks.
 *
 * Architecture:
 *  - Conversation state (sessions, userPrefs) → data.json (fast, ephemeral)
 *  - Medication data (medications, schedules, doses_log) → Supabase (persistent, relational)
 */

const DB_PATH = path.join(process.cwd(), 'data.json');

// ---------------------------------------------------------------------------
// Supabase Client
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: { transport: ws },
  });
}

// ---------------------------------------------------------------------------
// Local state (conversation only)
// ---------------------------------------------------------------------------
let sessions = {};
let userPrefs = {};

function loadLocalState() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      if (!raw || raw.trim() === '') return;
      const data = JSON.parse(raw);
      sessions = data.sessions || {};
      userPrefs = data.userPrefs || {};
    }
  } catch (e) {
    console.error('Failed to load local state:', e);
  }
}

function saveLocalState() {
  try {
    const tempPath = `${DB_PATH}.tmp`;
    // Preserve demoDoses for backward compat if Supabase is not connected
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); } catch {}
    const data = JSON.stringify({ ...existing, sessions, userPrefs }, null, 2);
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, DB_PATH);
  } catch (e) {
    console.error('Failed to save local state:', e);
  }
}

// Initial load
loadLocalState();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Strips dosage/meal info and emojis from stored medication names for clean display
function getCleanName(fullName) {
  if (!fullName) return '';
  let clean = fullName.split(' - ')[0].split('(')[0].trim();
  clean = clean.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}]/gu, '').trim();
  return clean;
}

// Helper for progress bar
const bar = (percent) => {
  const p = isNaN(percent) ? 0 : percent;
  const filled = Math.max(0, Math.min(10, Math.round(p / 10)));
  return '='.repeat(filled) + '-'.repeat(10 - filled);
};

// Convert AM/PM or 24hr time string to HH:MM:SS for Supabase TIME column
function normalizeTimeForDB(timeStr) {
  if (!timeStr) return null;
  const match24 = timeStr.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (match24) {
    return `${match24[1].padStart(2, '0')}:${match24[2]}:00`;
  }
  const matchAmPm = timeStr.match(/^(0?[1-9]|1[0-2]):?([0-5][0-9])?\s*([AaPp][Mm])$/i);
  if (matchAmPm) {
    let h = parseInt(matchAmPm[1]);
    const m = matchAmPm[2] || '00';
    const ampm = matchAmPm[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}:00`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supabase Data Access
// ---------------------------------------------------------------------------

async function ensurePatient(phone) {
  if (!supabase) return null;
  const lang = userPrefs[phone] || 'en';
  const { data, error } = await supabase
    .from('patients')
    .upsert({ phone, name: 'Patient ' + phone.slice(-4), language: lang }, { onConflict: 'phone' })
    .select('id')
    .single();
  if (error) { console.error('ensurePatient error:', error); return null; }
  return data.id;
}

async function getMedications(phone) {
  if (!supabase) return [];
  const { data: patient } = await supabase.from('patients').select('id').eq('phone', phone).single();
  if (!patient) return [];
  const { data: meds } = await supabase
    .from('medications')
    .select('*, schedules(scheduled_time)')
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: true });
  return meds || [];
}

async function getTodayDoses(phone) {
  if (!supabase) return [];
  const { data: patient } = await supabase.from('patients').select('id').eq('phone', phone).single();
  if (!patient) return [];
  const { data: meds } = await supabase
    .from('medications')
    .select('id, name, inventory, schedules(scheduled_time)')
    .eq('patient_id', patient.id);
  if (!meds || meds.length === 0) return [];

  const medIds = meds.map(m => m.id);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: logs } = await supabase
    .from('doses_log')
    .select('*')
    .in('medication_id', medIds)
    .gte('scheduled_datetime', startOfDay.toISOString());

  // Build unified dose view
  const medMap = Object.fromEntries(meds.map(m => [m.id, m]));
  return (logs || []).map(log => {
    const med = medMap[log.medication_id];
    const sched = med?.schedules?.[0];
    return {
      id: log.id,
      name: med?.name || 'Unknown',
      time: sched ? sched.scheduled_time.substring(0, 5) : '??:??',
      status: log.status,
      logTime: log.logged_datetime ? new Date(log.logged_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null,
      inventory: med?.inventory,
      medicationId: med?.id,
    };
  });
}

async function addMedication(phone, { name, dosage, time, mealChoice, duration, inventory }) {
  if (!supabase) return false;
  const patientId = await ensurePatient(phone);
  if (!patientId) return false;

  const finalName = mealChoice ? `${name} - ${dosage} (${mealChoice})` : `${name} - ${dosage}`;
  const dbTime = normalizeTimeForDB(time);

  const { data: med, error: medErr } = await supabase
    .from('medications')
    .insert({
      patient_id: patientId,
      name: finalName,
      dosage: dosage || '',
      inventory: parseInt(inventory) || 0,
      instructions: mealChoice || '',
      duration: duration || null,
    })
    .select('id')
    .single();

  if (medErr) { console.error('addMedication error:', medErr); return false; }

  if (dbTime) {
    await supabase.from('schedules').insert({ medication_id: med.id, scheduled_time: dbTime });
  }

  // Create today's pending dose log
  await supabase.from('doses_log').insert({
    medication_id: med.id,
    scheduled_datetime: new Date().toISOString(),
    status: 'pending',
    alert_sent: false,
  });

  return finalName;
}

async function removeMedication(phone, cleanName) {
  if (!supabase) return false;
  const { data: patient } = await supabase.from('patients').select('id').eq('phone', phone).single();
  if (!patient) return false;
  const { data: meds } = await supabase.from('medications').select('id, name').eq('patient_id', patient.id);
  const targets = (meds || []).filter(m => getCleanName(m.name) === cleanName);
  for (const med of targets) {
    await supabase.from('medications').delete().eq('id', med.id);
  }
  return targets.length > 0;
}

async function updatePendingDose(phone, status) {
  if (!supabase) return false;
  const { data: patient } = await supabase.from('patients').select('id').eq('phone', phone).single();
  if (!patient) return false;
  const { data: meds } = await supabase.from('medications').select('id').eq('patient_id', patient.id);
  if (!meds || meds.length === 0) return false;
  const medIds = meds.map(m => m.id);

  // Find most recent pending log for this patient
  const { data: pendingLog } = await supabase
    .from('doses_log')
    .select('id, medication_id')
    .in('medication_id', medIds)
    .eq('status', 'pending')
    .order('scheduled_datetime', { ascending: false })
    .limit(1)
    .single();

  if (!pendingLog) return false;

  const updates = {
    status,
    logged_datetime: new Date().toISOString(),
  };

  await supabase.from('doses_log').update(updates).eq('id', pendingLog.id);

  // Decrement inventory on "taken"
  if (status === 'taken') {
    const { data: med } = await supabase.from('medications').select('inventory').eq('id', pendingLog.medication_id).single();
    if (med && med.inventory > 0) {
      await supabase.from('medications').update({ inventory: med.inventory - 1 }).eq('id', pendingLog.medication_id);
      return { done: true, inventory: med.inventory - 1, medId: pendingLog.medication_id };
    }
  }
  return { done: true };
}

async function checkDuplicate(phone, medName, time) {
  if (!supabase) return false;
  const { data: patient } = await supabase.from('patients').select('id').eq('phone', phone).single();
  if (!patient) return false;
  const { data: meds } = await supabase.from('medications').select('id, name, schedules(scheduled_time)').eq('patient_id', patient.id);
  const dbTime = normalizeTimeForDB(time);
  return (meds || []).some(m => getCleanName(m.name) === getCleanName(medName) && m.schedules?.some(s => s.scheduled_time === dbTime));
}

// ---------------------------------------------------------------------------
// i18n strings
// ---------------------------------------------------------------------------
const i18n = {
  en: {
    welcome: (name) => `🙏 *Namaste ${name}! Welcome to DawaiSaathi*\n\nI help you take your medicines on time.\n\nWhat would you like to do?`,
    menuTitle: '📖 *DawaiSaathi — Main Menu*\n\nHere is what you can do:\n💊 *Add medicine*: Schedule a new reminder.\n📊 *Today*: Check what you\'ve taken or missed today.\n📋 *My meds*: View or remove your medicines.\n🔥 *Streak*: Check your adherence score.\n👨‍👩‍👧 *Add family*: Let your family monitor your meds.\n🌐 *Language*: Switch between English and Hindi.\n\nChoose an option below:',
    btn_addMed: '💊 Add medicine',
    btn_today: '📊 Today',
    btn_myMeds: '📋 My meds',
    btn_testRem: '🔔 Test reminder',
    btn_family: '👨‍👩‍👧 Add family',
    btn_help: '❓ Menu',
    btn_streak: '🔥 Streak',
    btn_stop: '⏸️ Stop',
    btn_lang: '🌐 Language',
    btn_cancel: '❌ Cancel',
    btn_skip: '⏭️ Skip',
    btn_confirmSave: '✅ Confirm & Save',
    btn_startOver: '🔄 Start Over',
    btn_3days: '3 Days',
    btn_5days: '5 Days',
    btn_continuous: 'Continuous',
    addMedPrompt: '💊 *Let\'s add a medicine!*\n\n`[■□□□□□□] Step 1/7: Medicine Name`\n\nWhat\'s the medicine name?\n(e.g. Metformin, Amlodipine, Dolo 650, Crocin)',
    addMedDosage: (name) => `Got it: *${name}*.\n\n` + '`[■■□□□□□] Step 2/7: Dosage`' + '\n\nWhat is the dosage amount? (e.g., 1 tablet, half tablet, 5ml)',
    addMedMeal: 'Should this be taken before or after food?\n\n`[■■■■□□□] Step 4/7: Meal Preference`',
    btn_beforeMeal: 'Before Food',
    btn_afterMeal: 'After Food',
    btn_anyMeal: 'Anytime',
    addMedTime: (name, dosage) => `When should I remind you to take *${name}* (${dosage})?\n\n` + '`[■■■□□□□] Step 3/7: Time`' + '\n\nReply with a time (e.g. 8:00 AM, 9 PM, 20:00):',
    invalidTime: '❌ Invalid time format. Please try again (e.g., 8:00 AM, 20:00).',
    addMedDuration: 'How many days are you prescribed to take this medicine?\n\n`[■■■■■□□] Step 5/7: Duration`\n\nSelect an option or type a custom number of days (e.g., 10).',
    invalidDuration: '❌ Please enter a valid number of days (e.g., 10).',
    addMedInventory: '📦 Want me to track your stock?\n\n`[■■■■■■□] Step 6/7: Inventory (Optional)`\n\nHow many pills do you currently have? (e.g., 30)\nOr select/type \'Skip\' to ignore.',
    confirmSummary: (name, dosage, time, meal, duration, inventory) => `📝 *Review Medicine Details*\n\n` + '`[■■■■■■■] Step 7/7: Confirm Details`' + `\n\n💊 *Name:* ${name}\n⚖️ *Dosage:* ${dosage}\n⏰ *Time:* ${time}\n🍽️ *Meal:* ${meal}\n📅 *Duration:* ${duration ? duration + ' days' : 'Continuous'}\n📦 *Stock:* ${inventory || 'Not tracked'}\n\nDoes everything look correct?`,
    lowInventoryAlert: (name, left) => `\n⚠️ *Low Stock Alert:* You only have ${left} pills of ${name} left. Time to order more!`,
    addMedSuccess: (name, time) => `✅ Success! I will remind you to take *${name}* at *${time}*.\n\nType *"Today"* to see your updated progress.`,
    cancel: '❌ Action cancelled. What would you like to do next?',
    myMedsTitle: '📋 *Your Scheduled Medicines*\n\n',
    myMedsFooter: '\nType *"Add medicine"* to add more\nType *"Remove <number>"* (e.g. Remove 1) to delete a medicine.',
    noMedsAdded: 'No medicines added yet.',
    streakStats: (month, taken, total) => `🔥 *Your Progress*\n\n📅 ${month}: ${taken} out of ${total} pills taken\n📈 Adherence: ${total > 0 ? Math.round((taken / total) * 100) : 0}%\n\nKeep it up!`,
    addFamily: '👨‍👩‍👧 *Invite a Caregiver*\n\nShare this link with your family:\n🔗 https://dawaisaathi.com/join/abc123\n\nThey can monitor your medicines on a live dashboard.\nThey *cannot* change your medicines.',
    stopMsg: '⏸️ *Reminders paused.*\n\nYou won\'t get reminders until you type *"Resume"*.\nYour data is safe.',
    resumeMsg: '▶️ *Reminders resumed!*\n\nYou\'ll receive reminders at your scheduled times.',
    testReminder: (name) => `⏰ *Time for your medicine!*\n\n💊 *${name}*\nAs Prescribed`,
    btn_taken: '✅ Taken',
    btn_snooze: '⏰ Snooze',
    btn_skip_dose: '❌ Skip',
    doseLogged: '✅ *Dose logged!* Great job! 💪\nYour caregiver has been notified.\n\n',
    doseSkipped: '❌ *Noted.* Your schedule has been updated.\nYour caregiver has been notified.\n\n',
    snoozePrompt: '⏰ How long would you like to snooze?',
    snoozedFor: (time) => `⏰ *Snoozed!* I\'ll remind you again in ${time}.`,
    progressTitle: (actioned, total, percent) => `📊 *Today\'s Progress*\n\`[${bar(percent)}]\` ${actioned}/${total} done (${percent}%)\n\n`,
    progressTaken: (name, logTime) => `✅ ~${name}~ — ${logTime}\n`,
    progressSkipped: (name) => `❌ ~${name}~ — Skipped\n`,
    progressPending: (name, time) => `⏳ *${name}* — ${time}\n`,
    streakFooter: '\n🔥 Keep up the streak!',
    fallback: '🤔 I didn\'t get that.\n\nType *"help"* to see the menu.',
    nextMeetingNote: (time, name) => `\n\n_We will meet again at ${time} for ${name}._`,
    duplicateAlert: (name, time) => `⚠️ You already consume ${name} at ${time} time, want me to add another dose?`,
    btn_yes: '✅ Yes',
    btn_no: '❌ No',
  },
  hi: {
    welcome: (name) => `🙏 *नमस्ते ${name}! दवाईसाथी में आपका स्वागत है*\n\nमैं आपको समय पर दवा लेने में मदद करता हूँ।\n\nआप क्या करना चाहेंगे?`,
    menuTitle: '📖 *दवाईसाथी — मुख्य मेनू*\n\nयहाँ आप क्या कर सकते हैं:\n💊 *दवा जोड़ें*: नया रिमाइंडर सेट करें।\n📊 *आज*: देखें आज आपने क्या लिया या छोड़ा।\n📋 *मेरी दवाएं*: अपनी दवाएं देखें या हटाएं।\n🔥 *स्ट्रीक*: अपना पालन स्कोर जांचें।\n👨‍👩‍👧 *परिवार जोड़ें*: परिवार को अपनी दवाएं ट्रैक करने दें।\n🌐 *भाषा*: अंग्रेजी और हिंदी के बीच बदलें।\n\nनीचे एक विकल्प चुनें:',
    btn_addMed: '💊 दवा जोड़ें',
    btn_today: '📊 आज',
    btn_myMeds: '📋 मेरी दवाएं',
    btn_testRem: '🔔 टेस्ट रिमाइंडर',
    btn_family: '👨‍👩‍👧 परिवार जोड़ें',
    btn_help: '❓ मेनू',
    btn_streak: '🔥 स्ट्रीक',
    btn_stop: '⏸️ रोकें',
    btn_lang: '🌐 भाषा',
    btn_cancel: '❌ रद्द करें',
    btn_skip: '⏭️ छोड़ें',
    btn_confirmSave: '✅ पुष्टि करें और सहेजें',
    btn_startOver: '🔄 फिर से शुरू करें',
    btn_3days: '3 दिन',
    btn_5days: '5 दिन',
    btn_continuous: 'लगातार',
    addMedPrompt: '💊 *चलिए एक दवा जोड़ते हैं!*\n\n`[■□□□□□□] चरण 1/7: दवा का नाम`\n\nदवा का नाम क्या है?\n(उदा. Metformin, Amlodipine, Dolo 650)',
    addMedDosage: (name) => `ठीक है: *${name}*।\n\n` + '`[■■□□□□□] चरण 2/7: खुराक`' + '\n\nखुराक की मात्रा क्या है? (उदा. 1 गोली, 5ml)',
    addMedMeal: 'क्या इसे खाने से पहले या खाने के बाद लेना चाहिए?\n\n`[■■■■□□□] चरण 4/7: भोजन का समय`',
    btn_beforeMeal: 'खाने से पहले',
    btn_afterMeal: 'खाने के बाद',
    btn_anyMeal: 'कभी भी',
    addMedTime: (name, dosage) => `मैं आपको *${name}* (${dosage}) लेने की याद कब दिलाऊं?\n\n` + '`[■■■□□□□] चरण 3/7: समय`' + '\n\nसमय के साथ उत्तर दें (उदा. 8:00 AM, 20:00):',
    invalidTime: '❌ अमान्य समय। कृपया फिर से प्रयास करें (उदा. 8:00 AM, 20:00)।',
    addMedDuration: 'आपको कितने दिनों तक यह दवा लेने की सलाह दी गई है?\n\n`[■■■■■□□] चरण 5/7: अवधि`\n\nएक विकल्प चुनें या दिनों की कस्टम संख्या टाइप करें (उदा. 10)।',
    invalidDuration: '❌ कृपया दिनों की एक वैध संख्या दर्ज करें (उदा. 10)।',
    addMedInventory: '📦 क्या आप चाहते हैं कि मैं आपके स्टॉक पर नज़र रखूँ?\n\n`[■■■■■■□] चरण 6/7: इन्वेंटरी (वैकल्पिक)`\n\nवर्तमान में आपके पास कितनी गोलियाँ हैं? (उदा. 30)\nया छोड़ने के लिए \'Skip\' चुनें/टाइप करें।',
    confirmSummary: (name, dosage, time, meal, duration, inventory) => `📝 *दवा के विवरण की समीक्षा करें*\n\n` + '`[■■■■■■■] चरण 7/7: विवरण की पुष्टि करें`' + `\n\n💊 *नाम:* ${name}\n⚖️ *खुराक:* ${dosage}\n⏰ *समय:* ${time}\n🍽️ *भोजन:* ${meal}\n📅 *अवधि:* ${duration ? duration + ' दिन' : 'लगातार'}\n📦 *स्टॉक:* ${inventory || 'ट्रैक नहीं किया गया'}\n\nक्या सब कुछ सही है?`,
    lowInventoryAlert: (name, left) => `\n⚠️ *लो स्टॉक अलर्ट:* आपके पास ${name} की केवल ${left} गोलियाँ बची हैं। और मंगाने का समय आ गया है!`,
    addMedSuccess: (name, time) => `✅ सफलता! मैं आपको *${time}* बजे *${name}* लेने की याद दिलाऊंगा।\n\nअपनी अद्यतन प्रगति देखने के लिए *"आज"* टाइप करें।`,
    cancel: '❌ रद्द कर दिया गया। आप आगे क्या करना चाहेंगे?',
    myMedsTitle: '📋 *आपकी निर्धारित दवाएं*\n\n',
    myMedsFooter: '\nऔर जोड़ने के लिए *"दवा जोड़ें"* टाइप करें\nहटाने के लिए *"Remove <number>"* टाइप करें।',
    noMedsAdded: 'अभी तक कोई दवा नहीं जोड़ी गई।',
    streakStats: (month, taken, total) => `🔥 *आपकी प्रगति*\n\n📅 ${month}: ${total} में से ${taken} दवाएं ली गईं\n📈 पालन: ${total > 0 ? Math.round((taken / total) * 100) : 0}%\n\nलगे रहो!`,
    addFamily: '👨‍👩‍👧 *देखभाल करने वाले को आमंत्रित करें*\n\nइस लिंक को अपने परिवार के साथ साझा करें:\n🔗 https://dawaisaathi.com/join/abc123\n\nवे लाइव डैशबोर्ड पर आपकी दवाओं की निगरानी कर सकते हैं।',
    stopMsg: '⏸️ *रिमाइंडर रोक दिए गए हैं।*\n\nजब तक आप *"फिर से शुरू करें"* टाइप नहीं करते तब तक आपको रिमाइंडर नहीं मिलेंगे।',
    resumeMsg: '▶️ *रिमाइंडर फिर से शुरू!*\n\nआपको निर्धारित समय पर रिमाइंडर प्राप्त होंगे।',
    testReminder: (name) => `⏰ *आपकी दवा का समय हो गया है!*\n\n💊 *${name}*\nनिर्देशानुसार`,
    btn_taken: '✅ ले ली',
    btn_snooze: '⏰ बाद में',
    btn_skip_dose: '❌ छोड़ दी',
    doseLogged: '✅ *दवा ले ली गई!* बहुत बढ़िया! 💪\nआपके देखभालकर्ता को सूचित कर दिया गया है।\n\n',
    doseSkipped: '❌ *दर्ज किया गया।* आपका शेड्यूल अपडेट कर दिया गया है।\nआपके देखभालकर्ता को सूचित कर दिया गया है।\n\n',
    snoozePrompt: '⏰ आप इसे कितने समय के लिए टालना चाहेंगे?',
    snoozedFor: (time) => `⏰ *टाल दिया गया!* मैं आपको ${time} में फिर याद दिलाऊंगा।`,
    progressTitle: (actioned, total, percent) => `📊 *आज की प्रगति*\n\`[${bar(percent)}]\` ${actioned}/${total} पूरी (${percent}%)\n\n`,
    progressTaken: (name, logTime) => `✅ ~${name}~ — ${logTime}\n`,
    progressSkipped: (name) => `❌ ~${name}~ — छोड़ी गई\n`,
    progressPending: (name, time) => `⏳ *${name}* — ${time}\n`,
    streakFooter: '\n🔥 लगे रहो!',
    fallback: '🤔 मुझे वह समझ नहीं आया।\n\nमेनू के लिए *"help"* टाइप करें।',
    nextMeetingNote: (time, name) => `\n\n_हम ${time} बजे ${name} के लिए फिर मिलेंगे।_`,
    duplicateAlert: (name, time) => `⚠️ आप पहले से ही ${time} बजे ${name} लेते हैं, क्या आप एक और खुराक जोड़ना चाहते हैं?`,
    btn_yes: '✅ हाँ',
    btn_no: '❌ नहीं',
  },
};

// ---------------------------------------------------------------------------
// Progress Report (uses Supabase data)
// ---------------------------------------------------------------------------

async function generateProgressReport(phone, t) {
  const doses = await getTodayDoses(phone);
  const total = doses.length;
  const actioned = doses.filter(d => d.status !== 'pending').length;
  const percentText = total > 0 ? Math.round((actioned / total) * 100) : 0;

  let report = t.progressTitle(actioned, total, percentText);

  if (doses.length === 0) {
    return report + (t.noMedsAdded || 'No medicines scheduled for today.') + '\n';
  }

  doses.forEach(d => {
    if (d.status === 'taken') {
      report += t.progressTaken(getCleanName(d.name), d.logTime);
    } else if (d.status === 'skipped' || d.status === 'missed') {
      report += t.progressSkipped(getCleanName(d.name));
    } else {
      report += t.progressPending(getCleanName(d.name), d.time);
    }
  });

  return report;
}

async function getNextDoseNote(phone, t) {
  const doses = await getTodayDoses(phone);
  const nextDose = doses.find(d => d.status === 'pending');
  if (nextDose) {
    return t.nextMeetingNote(nextDose.time, getCleanName(nextDose.name));
  }
  return '';
}

// ---------------------------------------------------------------------------
// Main processMessage (now async)
// ---------------------------------------------------------------------------

export async function processMessage(msg) {
  // Reload local state (sessions + userPrefs) from disk on every message
  loadLocalState();

  const phone = msg.phone;
  let text = msg.text ? msg.text.trim().toLowerCase() : '';
  const rawText = msg.text ? msg.text.trim() : '';

  if (!text) return { text: '🤔 Please send a valid text message.' };

  // ═══════════════════════════════════════
  // 0. LANGUAGE SELECTION
  // ═══════════════════════════════════════
  if (text.startsWith('lang_')) {
    userPrefs[phone] = text.split('_')[1]; // 'en' or 'hi'
    // Sync language preference to Supabase
    if (supabase) {
      await supabase.from('patients').upsert({ phone, language: userPrefs[phone] }, { onConflict: 'phone' });
    }
    saveLocalState();
    text = 'hi'; // trigger welcome message
  }

  if (!userPrefs[phone]) {
    return {
      text: 'Welcome to DawaiSaathi! Please choose your language:\n\nदवाईसाथी में आपका स्वागत है! कृपया अपनी भाषा चुनें:',
      buttons: [
        [{ text: '🇬🇧 English', callback_data: 'lang_en' }, { text: '🇮🇳 हिंदी', callback_data: 'lang_hi' }],
      ],
    };
  }

  const t = i18n[userPrefs[phone]];
  const backToMenuBtn = [[{ text: t.btn_help, callback_data: 'help' }]];

  // ═══════════════════════════════════════
  // 1. ACTIVE CONVERSATION STATE
  // ═══════════════════════════════════════
  if (sessions[phone]) {
    const state = sessions[phone];

    // 10-minute session timeout
    if (state.timestamp && Date.now() - state.timestamp > 10 * 60 * 1000) {
      delete sessions[phone];
      saveLocalState();
      return { text: '⏳ Session expired. Let\'s start over.', buttons: backToMenuBtn };
    }

    if (['cancel', 'stop', 'abort', 'exit', 'रद्द', 'बंद'].includes(text)) {
      delete sessions[phone];
      saveLocalState();
      return { text: t.cancel, buttons: backToMenuBtn };
    }

    if (text === 'restart_add') {
      sessions[phone] = { step: 'ADD_MED_NAME', timestamp: Date.now() };
      saveLocalState();
      return { text: t.addMedPrompt, buttons: [[{ text: t.btn_cancel, callback_data: 'cancel' }]] };
    }

    if (state.step === 'ADD_MED_NAME') {
      sessions[phone] = { step: 'ADD_MED_DOSAGE', medName: rawText, timestamp: Date.now() };
      saveLocalState();
      return { text: t.addMedDosage(rawText), buttons: [[{ text: t.btn_cancel, callback_data: 'cancel' }]] };
    }

    if (state.step === 'ADD_MED_DOSAGE') {
      sessions[phone] = { step: 'ADD_MED_TIME', medName: state.medName, medDosage: rawText, timestamp: Date.now() };
      saveLocalState();
      return { text: t.addMedTime(state.medName, rawText), buttons: [[{ text: t.btn_cancel, callback_data: 'cancel' }]] };
    }

    if (state.step === 'ADD_MED_TIME') {
      const timeRegex = /^(0?[1-9]|1[0-2])\s*:?\s*([0-5][0-9])?\s*([AaPp][Mm])$|^(0?[0-9]|1[0-9]|2[0-3]):([0-5][0-9])$/i;
      if (!timeRegex.test(rawText)) {
        return { text: t.invalidTime, buttons: [[{ text: t.btn_cancel, callback_data: 'cancel' }]] };
      }
      sessions[phone] = { step: 'ADD_MED_MEAL', medName: state.medName, medDosage: state.medDosage, medTime: rawText, timestamp: Date.now() };
      saveLocalState();
      return {
        text: t.addMedMeal,
        buttons: [
          [{ text: t.btn_beforeMeal, callback_data: 'meal_before' }, { text: t.btn_afterMeal, callback_data: 'meal_after' }],
          [{ text: t.btn_anyMeal, callback_data: 'meal_any' }],
          [{ text: t.btn_cancel, callback_data: 'cancel' }],
        ],
      };
    }

    if (state.step === 'ADD_MED_MEAL') {
      let mealChoice = text;
      if (text === 'meal_before') mealChoice = t.btn_beforeMeal;
      else if (text === 'meal_after') mealChoice = t.btn_afterMeal;
      else if (text === 'meal_any') mealChoice = null;

      sessions[phone] = { ...state, step: 'ADD_MED_DURATION', mealChoice, timestamp: Date.now() };
      saveLocalState();
      return {
        text: t.addMedDuration,
        buttons: [
          [{ text: t.btn_3days, callback_data: 'duration_3' }, { text: t.btn_5days, callback_data: 'duration_5' }],
          [{ text: t.btn_continuous, callback_data: 'duration_cont' }],
          [{ text: t.btn_cancel, callback_data: 'cancel' }],
        ],
      };
    }

    if (state.step === 'ADD_MED_DURATION') {
      let duration = null;
      if (text === 'duration_3') duration = 3;
      else if (text === 'duration_5') duration = 5;
      else if (text === 'duration_cont') duration = null;
      else {
        const parsed = parseInt(text);
        if (isNaN(parsed) || parsed <= 0) return { text: t.invalidDuration, buttons: [] };
        duration = parsed;
      }

      sessions[phone] = { ...state, step: 'ADD_MED_INVENTORY', medDuration: duration, timestamp: Date.now() };
      saveLocalState();
      return {
        text: t.addMedInventory,
        buttons: [
          [{ text: t.btn_skip, callback_data: 'skip' }],
          [{ text: t.btn_cancel, callback_data: 'cancel' }],
        ],
      };
    }

    if (state.step === 'ADD_MED_INVENTORY') {
      let inventory = parseInt(text);
      if (isNaN(inventory) || text === 'skip' || text === 'छोड़ें') inventory = null;

      sessions[phone] = { ...state, step: 'ADD_MED_CONFIRM', medInventory: inventory, timestamp: Date.now() };
      saveLocalState();
      return {
        text: t.confirmSummary(state.medName, state.medDosage, state.medTime, state.mealChoice || t.btn_anyMeal, state.medDuration, inventory),
        buttons: [
          [{ text: t.btn_confirmSave, callback_data: 'confirm_save' }],
          [{ text: t.btn_startOver, callback_data: 'restart_add' }],
          [{ text: t.btn_cancel, callback_data: 'cancel' }],
        ],
      };
    }

    if (state.step === 'ADD_MED_CONFIRM') {
      if (text === 'confirm_save' || ['save', 'confirm', 'yes', 'हाँ'].includes(text)) {
        const { medName, medDosage, medTime, mealChoice, medDuration, medInventory } = state;

        // Check for duplicates
        const isDuplicate = await checkDuplicate(phone, medName, medTime);
        if (isDuplicate) {
          sessions[phone] = { step: 'CONFIRM_DUPLICATE', medName, medDosage, medTime, mealChoice, medDuration, medInventory, timestamp: Date.now() };
          saveLocalState();
          return {
            text: t.duplicateAlert(getCleanName(medName), medTime),
            buttons: [[{ text: t.btn_yes, callback_data: 'confirm_yes' }, { text: t.btn_no, callback_data: 'confirm_no' }]],
          };
        }

        delete sessions[phone];
        saveLocalState();
        const finalName = await addMedication(phone, { name: medName, dosage: medDosage, time: medTime, mealChoice, duration: medDuration, inventory: medInventory });
        return { text: t.addMedSuccess(finalName || medName, medTime), buttons: backToMenuBtn };
      } else {
        return {
          text: 'Please confirm using the buttons:\n\nकृपया बटनों का उपयोग करके पुष्टि करें:',
          buttons: [
            [{ text: t.btn_confirmSave, callback_data: 'confirm_save' }],
            [{ text: t.btn_startOver, callback_data: 'restart_add' }],
            [{ text: t.btn_cancel, callback_data: 'cancel' }],
          ],
        };
      }
    }

    if (state.step === 'CONFIRM_DUPLICATE') {
      if (text === 'confirm_yes' || ['yes', 'हाँ', 'ya'].includes(text)) {
        const { medName, medDosage, medTime, mealChoice, medDuration, medInventory } = state;
        delete sessions[phone];
        saveLocalState();
        const finalName = await addMedication(phone, { name: medName, dosage: medDosage, time: medTime, mealChoice, duration: medDuration, inventory: medInventory });
        return { text: t.addMedSuccess(finalName || medName, medTime), buttons: backToMenuBtn };
      } else {
        delete sessions[phone];
        saveLocalState();
        return { text: t.cancel, buttons: backToMenuBtn };
      }
    }
  }

  // ═══════════════════════════════════════
  // 2. DOSE RESPONSE BUTTONS
  // ═══════════════════════════════════════
  if (text === 'taken') {
    const result = await updatePendingDose(phone, 'taken');
    let alertMsg = '';
    if (result && result.inventory !== undefined && result.inventory <= 5) {
      alertMsg = t.lowInventoryAlert('your medicine', result.inventory);
    }
    const report = await generateProgressReport(phone, t);
    const nextNote = await getNextDoseNote(phone, t);
    return { text: t.doseLogged + report + alertMsg + nextNote, buttons: backToMenuBtn };
  }

  if (text === 'snooze' || ['⏰', 'later', 'बाद में'].includes(text)) {
    return {
      text: t.snoozePrompt,
      buttons: [
        [{ text: '15 mins', callback_data: 'snooze_15' }, { text: '30 mins', callback_data: 'snooze_30' }],
        [{ text: '45 mins', callback_data: 'snooze_45' }, { text: '1 hour', callback_data: 'snooze_60' }],
      ],
    };
  }

  if (text.startsWith('snooze_')) {
    const mins = text.split('_')[1];
    // Mark as snoozed in DB
    await updatePendingDose(phone, 'snoozed');
    const timeText = mins === '60' ? '1 hour' : `${mins} minutes`;
    return { text: t.snoozedFor(timeText), buttons: backToMenuBtn };
  }

  if (text === 'skip' || ['❌', 'छोड़ दी'].includes(text)) {
    await updatePendingDose(phone, 'missed');
    const report = await generateProgressReport(phone, t);
    const nextNote = await getNextDoseNote(phone, t);
    return { text: t.doseSkipped + report + nextNote, buttons: backToMenuBtn };
  }

  // ═══════════════════════════════════════
  // 3. STANDARD COMMANDS
  // ═══════════════════════════════════════
  if (['hi', 'hello', 'hey', 'start', '/start', 'namaste', 'hii', 'hiii', 'नमस्ते', 'हाय'].includes(text)) {
    return {
      text: t.welcome(msg.name),
      buttons: [
        [{ text: t.btn_addMed, callback_data: 'add medicine' }, { text: t.btn_today, callback_data: 'today' }],
        [{ text: t.btn_myMeds, callback_data: 'my medicines' }, { text: t.btn_testRem, callback_data: 'test reminder' }],
        [{ text: t.btn_family, callback_data: 'add family' }, { text: t.btn_help, callback_data: 'help' }],
      ],
    };
  }

  if (['help', '?', 'commands', 'menu', '/help', 'मदद', 'मेनू'].includes(text)) {
    return {
      text: t.menuTitle,
      buttons: [
        [{ text: t.btn_addMed, callback_data: 'add medicine' }, { text: t.btn_today, callback_data: 'today' }],
        [{ text: t.btn_myMeds, callback_data: 'my medicines' }, { text: t.btn_streak, callback_data: 'streak' }],
        [{ text: t.btn_testRem, callback_data: 'test reminder' }, { text: t.btn_family, callback_data: 'add family' }],
        [{ text: t.btn_lang, callback_data: 'language' }],
      ],
    };
  }

  if (['language', 'lang', 'भाषा', 'change language', 'bhasha'].includes(text)) {
    return {
      text: 'Please choose your language:\n\nकृपया अपनी भाषा चुनें:',
      buttons: [
        [{ text: '🇬🇧 English', callback_data: 'lang_en' }, { text: '🇮🇳 हिंदी', callback_data: 'lang_hi' }],
      ],
    };
  }

  if (['add medicine', 'add med', 'add', 'new medicine', 'new med', '/add', 'दवा जोड़ें'].includes(text)) {
    sessions[phone] = { step: 'ADD_MED_NAME', timestamp: Date.now() };
    saveLocalState();
    return { text: t.addMedPrompt, buttons: [[{ text: t.btn_cancel, callback_data: 'cancel' }]] };
  }

  if (['test reminder', 'reminder', 'test', '/test', 'टेस्ट', 'रिमाइंडर'].includes(text)) {
    const meds = await getMedications(phone);
    const nextMed = meds[0] || { name: 'Medicine' };
    return {
      text: t.testReminder(getCleanName(nextMed.name)),
      buttons: [
        [{ text: t.btn_taken, callback_data: 'taken' }],
        [{ text: t.btn_snooze, callback_data: 'snooze' }],
        [{ text: t.btn_skip_dose, callback_data: 'skip' }],
      ],
    };
  }

  if (['my medicines', 'medicines', 'meds', 'list', 'my meds', 'मेरी दवाएं'].includes(text)) {
    const meds = await getMedications(phone);
    if (meds.length === 0) return { text: t.myMedsTitle + t.noMedsAdded, buttons: backToMenuBtn };

    const seen = new Set();
    const uniqueMeds = meds.filter(m => {
      const n = getCleanName(m.name);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });

    let medList = t.myMedsTitle;
    uniqueMeds.forEach((m, i) => {
      const sched = m.schedules?.[0];
      const time = sched ? sched.scheduled_time.substring(0, 5) : '—';
      medList += `${i + 1}. *${getCleanName(m.name)}* — ${time}\n`;
    });
    medList += t.myMedsFooter;
    return { text: medList, buttons: backToMenuBtn };
  }

  if (text.startsWith('remove ') || text.startsWith('delete ')) {
    const num = parseInt(text.split(' ')[1]);
    const meds = await getMedications(phone);
    const seen = new Set();
    const uniqueMeds = meds.filter(m => {
      const n = getCleanName(m.name);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });

    if (isNaN(num) || num < 1 || num > uniqueMeds.length) {
      return { text: '❌ Please specify a valid medicine number from your list. (e.g. \'Remove 1\')', buttons: backToMenuBtn };
    }

    const targetCleanName = getCleanName(uniqueMeds[num - 1].name);
    await removeMedication(phone, targetCleanName);
    return { text: `🗑️ Removed all doses for *${targetCleanName}* from your schedule.`, buttons: backToMenuBtn };
  }

  if (['today', 'progress', 'status', 'check', '/today', 'आज'].includes(text)) {
    const report = await generateProgressReport(phone, t);
    return { text: report + t.streakFooter, buttons: backToMenuBtn };
  }

  if (['streak', 'score', 'stats', '/streak', 'स्ट्रीक'].includes(text)) {
    const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const doses = await getTodayDoses(phone);
    const takenPills = doses.filter(d => d.status === 'taken').length;
    const totalPills = doses.length;
    return { text: t.streakStats(month, takenPills, totalPills), buttons: backToMenuBtn };
  }

  if (['add family', 'family', 'invite', 'caregiver', 'add caregiver', 'परिवार जोड़ें'].includes(text)) {
    return { text: t.addFamily, buttons: backToMenuBtn };
  }

  if (['stop', 'pause', 'unsubscribe', 'band karo', 'रोकें'].includes(text)) {
    return { text: t.stopMsg, buttons: backToMenuBtn };
  }

  if (['resume', 'start again', 'chalu karo', 'restart', 'फिर से शुरू करें'].includes(text)) {
    return { text: t.resumeMsg, buttons: backToMenuBtn };
  }

  return { text: t.fallback, buttons: backToMenuBtn };
}
