import { NextResponse } from "next/server";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const DB_PATH = path.join(process.cwd(), "data.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// --- Helper Functions ---
function getCleanName(fullName) {
  if (!fullName) return "";
  let clean = fullName.split(" - ")[0].split("(")[0].trim();
  clean = clean.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}]/gu, '').trim();
  return clean;
}

async function readDB() {
  if (!fsSync.existsSync(DB_PATH)) return { sessions: {}, demoDoses: {}, userPrefs: {} };
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { sessions: {}, demoDoses: {}, userPrefs: {} };
  }
}

async function writeDB(data) {
  const tmp = `${DB_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, DB_PATH);
}

// --- API Handlers ---

export async function GET() {
  try {
    if (supabase) {
      try {
        // 1. Fetch from Supabase
        const { data: patients, error: pErr } = await supabase.from('patients').select('*');
        if (pErr) throw pErr;
        
        const { data: medications, error: mErr } = await supabase.from('medications').select('*');
        if (mErr) throw mErr;
        
        const { data: schedules, error: sErr } = await supabase.from('schedules').select('*');
        if (sErr) throw sErr;
        
        const { data: doses, error: dErr } = await supabase.from('doses_log').select('*');
        if (dErr) throw dErr;

        if (patients) {
          // Transform relational data into the format the dashboard expects (for backward compatibility)
          const demoDoses = {};
          const userPrefs = {};
          
          for (const p of patients) {
            demoDoses[p.phone] = [];
            userPrefs[p.phone] = p.language;
          }

          // Pre-compute daysConsumed per medication (distinct calendar days with 'taken' status)
          const daysConsumedMap = {};
          for (const d of doses || []) {
            if (d.status === "taken" && d.scheduled_datetime) {
              const day = new Date(d.scheduled_datetime).toISOString().slice(0, 10);
              if (!daysConsumedMap[d.medication_id]) daysConsumedMap[d.medication_id] = new Set();
              daysConsumedMap[d.medication_id].add(day);
            }
          }
          
          for (const d of doses || []) {
            const med = (medications || []).find(m => m.id === d.medication_id);
            const sched = (schedules || []).find(s => s.medication_id === med?.id);
            const patient = patients.find(p => p.id === med?.patient_id);
            
            if (patient && med) {
              const daysConsumed = daysConsumedMap[med.id]?.size ?? 0;

              demoDoses[patient.phone].push({
                id: d.id,
                name: med.name,
                time: sched ? sched.scheduled_time.substring(0, 5) : '00:00', // simple HH:MM
                status: d.status,
                logTime: d.logged_datetime ? new Date(d.logged_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null,
                inventory: med.inventory,
                dosage: med.dosage,
                duration: med.duration,      // prescription length in days (null = continuous)
                daysConsumed,                // distinct taken days so far
              });
            }
          }
          
          return NextResponse.json({ sessions: {}, demoDoses, userPrefs }, {
            headers: { "Cache-Control": "no-store" },
          });
        }
      } catch (sbErr) {
        console.warn("Supabase fetch failed, falling back to local data.json:", sbErr?.message || sbErr);
      }
    }

    // 2. Fallback to Local JSON
    const data = await readDB();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Dashboard GET error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Check if adding a medication
    if (body.type === "medication" || body.medication) {
      const { phone, name, dosage, time, inventory } = body.medication || body;
      if (!phone || !name) {
        return NextResponse.json({ error: "Phone and medication name are required" }, { status: 400 });
      }

      const normalizedPhone = phone.replace(/\s+/g, "");

      if (supabase) {
        // 1. Get or create patient
        const { data: patientData } = await supabase
          .from("patients")
          .upsert({ phone: normalizedPhone, name: "Patient", language: "en" }, { onConflict: "phone" })
          .select("id")
          .single();

        if (!patientData) {
          return NextResponse.json({ error: "Failed to resolve patient" }, { status: 500 });
        }

        // 2. Insert medication
        const { data: medData, error: medError } = await supabase
          .from("medications")
          .insert({
            patient_id: patientData.id,
            name,
            dosage: dosage || "1 Tab",
            inventory: parseInt(inventory, 10) || 30,
            instructions: "After Food"
          })
          .select("id")
          .single();

        if (medError) {
          return NextResponse.json({ error: medError.message }, { status: 500 });
        }

        // 3. Insert schedule
        if (time) {
          await supabase.from("schedules").insert({
            medication_id: medData.id,
            scheduled_time: time
          });
        }

        return NextResponse.json({ ok: true, medication: medData }, { status: 201 });
      } else {
        // Local JSON fallback
        const db = await readDB();
        if (!db.demoDoses) db.demoDoses = {};
        if (!db.demoDoses[normalizedPhone]) db.demoDoses[normalizedPhone] = [];

        const newDose = {
          id: Date.now(),
          name: `${name} ${dosage || ""}`.trim(),
          time: time || "8:00 AM",
          status: "pending",
          logTime: null,
          inventory: parseInt(inventory, 10) || 30
        };

        db.demoDoses[normalizedPhone].push(newDose);
        await writeDB(db);

        return NextResponse.json({ ok: true, dose: newDose }, { status: 201 });
      }
    }

    // Default: Add patient
    const { name, phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Normalize phone — strip spaces
    const normalizedPhone = phone.replace(/\s+/g, "");

    if (supabase) {
      const { data, error } = await supabase
        .from("patients")
        .upsert(
          { phone: normalizedPhone, name: name || "Patient", language: "en" },
          { onConflict: "phone" }
        )
        .select("*")
        .single();

      if (error) {
        console.error("Dashboard POST (create patient) error:", error);
        return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, patient: data }, { status: 201 });
    } else {
      // Local JSON fallback
      const db = await readDB();
      if (!db.demoDoses) db.demoDoses = {};
      if (!db.userPrefs) db.userPrefs = {};
      if (!db.demoDoses[normalizedPhone]) {
        db.demoDoses[normalizedPhone] = [];
        db.userPrefs[normalizedPhone] = "en";
        await writeDB(db);
      }
      return NextResponse.json({ ok: true, patient: { phone: normalizedPhone, name } }, { status: 201 });
    }
  } catch (error) {
    console.error("Dashboard POST error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { phone, id, cleanName, updates } = body;
    if (!phone || (!id && !cleanName) || !updates) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    if (supabase) {
      // Supabase Path
      const { data: patient } = await supabase.from('patients').select('id').eq('phone', phone).single();
      if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
      
      const { name, time, dosage, inventory } = updates;
      const { data: meds } = await supabase.from('medications').select('id, name').eq('patient_id', patient.id);
      const targetMeds = meds.filter(m => getCleanName(m.name) === cleanName);
      
      let updatedCount = 0;
      for (const med of targetMeds) {
        if (name !== undefined || dosage !== undefined || inventory !== undefined) {
          await supabase.from('medications').update({
            ...(name && { name }),
            ...(dosage && { dosage }),
            ...(inventory !== undefined && { inventory })
          }).eq('id', med.id);
        }
        if (time !== undefined) {
          await supabase.from('schedules').update({ scheduled_time: time }).eq('medication_id', med.id);
        }
        updatedCount++;
      }
      return NextResponse.json({ ok: true, updatedCount });
    } else {
      // Local JSON Path
      const db = await readDB();
      const doses = db.demoDoses?.[phone];
      if (!doses) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

      const { name, time, dosage, inventory } = updates;
      let updatedCount = 0;

      doses.forEach((d) => {
        const matchId = id && String(d.id) === String(id);
        const matchName = cleanName && getCleanName(d.name) === cleanName;
        
        if (matchId || matchName) {
          if (name !== undefined) d.name = name;
          if (time !== undefined) d.time = time;
          if (dosage !== undefined) d.dosage = dosage;
          if (inventory !== undefined) d.inventory = inventory;
          updatedCount++;
        }
      });
      if (updatedCount === 0) return NextResponse.json({ error: "Dose not found" }, { status: 404 });
      await writeDB(db);
      return NextResponse.json({ ok: true, updatedCount });
    }
  } catch (error) {
    console.error("Dashboard PATCH error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { phone, id, cleanName } = body;
    if (!phone || (!id && !cleanName)) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    if (supabase) {
      // Supabase Path
      const { data: patient } = await supabase.from('patients').select('id').eq('phone', phone).single();
      if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
      
      const { data: meds } = await supabase.from('medications').select('id, name').eq('patient_id', patient.id);
      const targetMeds = meds.filter(m => getCleanName(m.name) === cleanName);
      
      for (const med of targetMeds) {
        await supabase.from('medications').delete().eq('id', med.id);
        // Cascade will automatically delete schedules and doses_log
      }
      return NextResponse.json({ ok: true });
    } else {
      // Local JSON Path
      const db = await readDB();
      const doses = db.demoDoses?.[phone];
      if (!doses) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

      const before = doses.length;
      db.demoDoses[phone] = doses.filter((d) => {
        if (id && String(d.id) === String(id)) return false;
        if (cleanName && getCleanName(d.name) === cleanName) return false;
        return true;
      });

      if (db.demoDoses[phone].length === before) return NextResponse.json({ error: "Dose not found" }, { status: 404 });
      await writeDB(db);
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    console.error("Dashboard DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
