import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data.json");
const SETTINGS_PATH = path.join(process.cwd(), "settings.json");

function readSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { profileName: "Caregiver", language: "en", reminderOffset: 0 };
  }
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    return { profileName: "Caregiver", language: "en", reminderOffset: 0 };
  }
}

function writeSettings(data) {
  const tmp = `${SETTINGS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, SETTINGS_PATH);
}

export async function GET() {
  try {
    const settings = readSettings();
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Settings GET error:", err);
    return NextResponse.json({ error: "Failed to read settings" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const current = readSettings();

    // Only allow known fields
    const allowed = ["profileName", "language", "reminderOffset"];
    const updated = { ...current };
    for (const key of allowed) {
      if (body[key] !== undefined) updated[key] = body[key];
    }

    writeSettings(updated);
    return NextResponse.json({ ok: true, settings: updated });
  } catch (err) {
    console.error("Settings PATCH error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
