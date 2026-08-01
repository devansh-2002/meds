import { createClient } from '@supabase/supabase-js';
import fsSync from 'fs';
import path from 'path';
import ws from 'ws';

// --- Configuration ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    transport: ws,
  },
}) : null;

const DB_PATH = path.join(process.cwd(), 'data.json');

// --- Helper Functions ---
function getCleanName(fullName) {
  if (!fullName) return '';
  let clean = fullName.split(' - ')[0].split('(')[0].trim();
  clean = clean.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}]/gu, '').trim();
  return clean;
}

async function readLocalDB() {
  if (!fsSync.existsSync(DB_PATH)) return { sessions: {}, demoDoses: {}, userPrefs: {} };
  try {
    const raw = fsSync.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { sessions: {}, demoDoses: {}, userPrefs: {} };
  }
}

// --- Main Migration Script ---
async function migrateData() {
  if (!supabase) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local');
    process.exit(1);
  }

  console.log('Starting migration from data.json to Supabase...');
  const localDb = await readLocalDB();
  const demoDoses = localDb.demoDoses || {};
  const userPrefs = localDb.userPrefs || {};

  for (const phone of Object.keys(demoDoses)) {
    console.log(`Processing patient: ${phone}`);
    
    // 1. Insert or Get Patient
    const lang = userPrefs[phone] || 'en';
    let { data: patientData, error: patientError } = await supabase
      .from('patients')
      .upsert({ phone, name: 'Patient ' + phone.slice(-4), language: lang }, { onConflict: 'phone' })
      .select('id')
      .single();

    if (patientError) {
      console.error('Failed to upsert patient:', patientError);
      continue;
    }
    const patientId = patientData.id;

    // 2. Process Medications
    const doses = demoDoses[phone];
    const medMap = {}; // name -> medId
    
    for (const dose of doses) {
      const cleanName = getCleanName(dose.name);
      
      if (!medMap[cleanName]) {
        // Create medication record
        const { data: medData, error: medError } = await supabase
          .from('medications')
          .insert({
            patient_id: patientId,
            name: cleanName,
            dosage: dose.dosage || '',
            inventory: parseInt(dose.inventory) || 0,
            instructions: '',
            duration: dose.duration || null
          })
          .select('id')
          .single();
          
        if (medError) {
          console.error(`Failed to insert medication ${cleanName}:`, medError);
          continue;
        }
        medMap[cleanName] = medData.id;
      }
      
      const medId = medMap[cleanName];

      // 3. Create Schedule Record
      // Convert time like "8:00 AM" to "08:00:00"
      let timeVal = dose.time;
      if (timeVal && timeVal.includes('AM') || timeVal.includes('PM')) {
        let [timeStr, modifier] = timeVal.split(' ');
        let [hours, minutes] = timeStr.split(':');
        if (!minutes) minutes = '00';
        if (hours === '12') hours = modifier === 'PM' ? '12' : '00';
        else if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
        timeVal = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
      } else if (timeVal && !timeVal.includes(':')) {
        timeVal = `${timeVal.padStart(2, '0')}:00:00`;
      }
      
      await supabase
        .from('schedules')
        .insert({
          medication_id: medId,
          scheduled_time: timeVal
        });

      // 4. Create Dose Log for this instance
      const logStatus = dose.status || 'pending';
      const logTime = dose.logTime ? new Date().toISOString() : null; // simplified mapping
      
      await supabase
        .from('doses_log')
        .insert({
          medication_id: medId,
          scheduled_datetime: new Date().toISOString(),
          logged_datetime: logTime,
          status: logStatus,
          alert_sent: dose.alertSent || false
        });
    }
  }
  console.log('Migration complete!');
}

migrateData().catch(console.error);
