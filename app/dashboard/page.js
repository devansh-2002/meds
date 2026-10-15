"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/* HELPERS & CONSTANTS */
function convertTo24(timeStr) {
  if (!timeStr) return "00:00";
  let [time, modifier] = timeStr.trim().split(' ');
  let [hours, minutes] = time.split(':');
  if (modifier) {
    if (hours === '12') {
      hours = modifier.toUpperCase() === 'PM' ? '12' : '00';
    } else if (modifier.toUpperCase() === 'PM') {
      hours = String(parseInt(hours, 10) + 12);
    }
  }
  return `${(hours || '00').padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}`;
}

function formatTime(timeStr) {
  if (!timeStr) return "00:00 AM";
  const [hours, minutes] = convertTo24(timeStr).split(':');
  const date = new Date();
  date.setHours(parseInt(hours, 10));
  date.setMinutes(parseInt(minutes, 10));
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getCleanName(fullName) {
  if (!fullName) return "";
  // Split at dosage separator, strip parenthetical instructions
  let clean = fullName.split(" - ")[0].split("(")[0].trim();
  // Remove all emoji / symbol ranges broadly
  clean = clean.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}]/gu, '').trim();
  return clean;
}

function generateCalendar(lang) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthName = today.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1);
  const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const d = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = i === today.getDate();
    const isFuture = i > today.getDate();
    const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    let status = "pending";
    if (!isFuture) {
      if (isToday) status = "partial"; 
      else if (i % 7 === 0) status = "missed";
      else if (i % 5 === 0) status = "partial";
      else status = "taken";
    }
    d.push({ day: i, status, isToday, isFuture, fullDate });
  }
  return { days: d, startingDayOfWeek, monthName };
}

function maskPhone(phone) {
  if (!phone || phone === "Not set") return "Not set";
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length >= 10) {
    const last4 = cleaned.slice(-4);
    const prefix = cleaned.slice(0, cleaned.length - 10);
    return `${prefix} ******${last4}`;
  }
  return phone;
}

function getTimeline(patientId, medications, demoDosesMap) {
  if (demoDosesMap && demoDosesMap[patientId]) {
    return demoDosesMap[patientId].map(d => {
      const medName = getCleanName(d.name);
      const medDetails = medications.find(m => getCleanName(m.name) === medName);
      return {
        id: d.id,
        name: medName,
        time: d.time,
        status: d.status,
        logTime: d.logTime,
        dosage: medDetails?.dosage || "1 Tab",
        instruction: "After Food"
      };
    });
  }
  return [];
}

function getLogsForDate(date, patientId, medications, demoDosesMap) {
  const allDoses = getTimeline(patientId, medications, demoDosesMap);
  // Sort by time chronologically
  allDoses.sort((a, b) => {
    const tA = convertTo24(a.time);
    const tB = convertTo24(b.time);
    return tA.localeCompare(tB);
  });
  const isToday = date === new Date().toLocaleDateString('en-CA');
  if (isToday) return allDoses;
  // For historical records without dedicated logs, return existing doses with their recorded status
  return allDoses;
}

const DAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAYS_HI = ["सो", "मं", "बु", "गु", "शु", "श", "र"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const dict = {
  en: {
    dashboardTitle: "'s Dashboard",
    lastActive: "Last active 2 min ago",
    downloadReport: "Download Report",
    todaysProgress: "Today's Progress",
    remaining: "remaining",
    adherenceRate: "Consistency Score",
    vsLastWeek: "vs last week",
    currentStreak: "Current Streak",
    days: "days",
    best: "Best",
    missedToday: "Missed Today",
    needsAttention: "Needs attention",
    allOnTrack: "All on track!",
    restockAlert: (count) => `Restock Required: ${count} item${count > 1 ? 's' : ''}`,
    pillsLeft: "pills left",
    timeline: "Timeline",
    taken: "Taken",
    missed: "Missed",
    upcoming: "Upcoming",
    noMedsDate: "No medications for this date.",
    adherenceTitle: "Consistency",
    monthlyConsistency: "Monthly Adherence",
    partial: "Partial",
    medications: "Medications",
    addMedicine: "+ Add Medicine",
    noMedsAdded: "No medications added yet.",
    todayLabel: "Today",
    scheduleDays: "Schedule Days",
    sourcedSuccess: "Marked as sourced locally!",
    reminderSent: "Offline reminder sent to phone!"
  },
  hi: {
    dashboardTitle: " का डैशबोर्ड",
    lastActive: "पिछली बार 2 मिनट पहले सक्रिय",
    downloadReport: "रिपोर्ट डाउनलोड",
    todaysProgress: "आज की प्रगति",
    remaining: "बाकी",
    adherenceRate: "नियमितता स्कोर",
    vsLastWeek: "पिछले सप्ताह से",
    currentStreak: "लगातार दिन",
    days: "दिन",
    best: "सर्वश्रेष्ठ",
    missedToday: "आज छूट गई",
    needsAttention: "ध्यान दें",
    allOnTrack: "सब सही चल रहा है!",
    restockAlert: (count) => `स्टॉक अलर्ट: ${count} दवाइयां`,
    pillsLeft: "गोलियां बची हैं",
    timeline: "टाइमलाइन",
    taken: "ले ली",
    missed: "छूट गई",
    upcoming: "आगामी",
    noMedsDate: "इस तारीख के लिए कोई दवा नहीं है।",
    adherenceTitle: "नियमितता",
    monthlyConsistency: "मासिक नियमितता",
    partial: "आंशिक",
    medications: "दवाएं",
    addMedicine: "+ दवा जोड़ें",
    noMedsAdded: "अभी तक कोई दवा नहीं जोड़ी गई है।",
    todayLabel: "आज",
    scheduleDays: "शेड्यूल दिन",
    sourcedSuccess: "स्थानीय रूप से प्राप्त!",
    reminderSent: "ऑफ़लाइन रिमाइंडर भेजा गया!"
  }
};

export default function DashboardPage() {
  const [lang, setLang] = useState("en");
  const t = dict[lang];
  const nextId = useRef(100);

  const [patients, setPatients] = useState([{ id: "p1", name: "Patient", phone: "Loading..." }]);
  const [meds, setMeds] = useState({});
  const [demoDosesMap, setDemoDosesMap] = useState({});
  const [selectedPatient, setSelectedPatient] = useState("p1");
  const [calData, setCalData] = useState({ days: [], startingDayOfWeek: 0, monthName: "" });
  const [selectedDate, setSelectedDate] = useState("");
  const [restockExpanded, setRestockExpanded] = useState(false);
  const [expandedMed, setExpandedMed] = useState(null);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dbKey, setDbKey] = useState(0);
  const lastDataRef = useRef("");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchLiveDB() {
      try {
        const res = await fetch("/api/dashboard/data");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (isMounted && data.demoDoses) {
          const newDataStr = JSON.stringify(data.demoDoses);
          if (lastDataRef.current === newDataStr) {
            setIsLoading(false);
            return;
          }
          lastDataRef.current = newDataStr;

          setDemoDosesMap(data.demoDoses);
          const newPatients = Object.keys(data.demoDoses).map((phone, idx) => ({ id: phone, name: `Patient ${idx + 1}`, phone }));
          if (newPatients.length > 0) {
            setPatients(newPatients);
            setSelectedPatient(prev => (newPatients.some(p => p.id === prev) ? prev : newPatients[0].id));
          }
          const newMeds = {};
          Object.entries(data.demoDoses).forEach(([phone, doses]) => {
            const medMap = {};
            doses.forEach(d => {
              const cleanName = getCleanName(d.name);
              if (!medMap[cleanName]) {
                const medDoses = doses.filter(dose => getCleanName(dose.name) === cleanName);
                const taken = medDoses.filter(dose => dose.status === "taken").length;
                const total = medDoses.length;
                const score = total > 0 ? Math.round((taken / total) * 100) : 100;
                medMap[cleanName] = { 
                  id: `m${d.id}`, 
                  name: cleanName, 
                  dosage: "", 
                  times: [], 
                  adherence: score, 
                  takenCount: taken,
                  pillsLeft: d.inventory || 0, 
                  scheduleDays: WEEKDAYS,
                  duration: d.duration ?? (medDoses.find(md => md.duration)?.duration || null),
                  daysConsumed: d.daysConsumed ?? 0,
                };
              }
              if (!medMap[cleanName].times.includes(d.time)) medMap[cleanName].times.push(d.time);
            });
            newMeds[phone] = Object.values(medMap);
          });
          setMeds(newMeds);
          setIsLoading(false);
        }
      } catch (e) { 
        if (isMounted) setError("Failed to load patient data. Ensure server is running."); 
        setIsLoading(false);
      }
    }
    fetchLiveDB();
    const interval = setInterval(fetchLiveDB, 3000); 
    return () => { isMounted = false; clearInterval(interval); };
  }, [dbKey]);

  const [showAddMed, setShowAddMed] = useState(false);
  const [editMed, setEditMed] = useState(null);
  const [showAddPatient, setShowAddPatient] = useState(false);

  useEffect(() => {
    const cal = generateCalendar(lang);
    setCalData(cal);
    setMounted(true);
  }, [lang]);

  useEffect(() => {
    if (!selectedDate) setSelectedDate(new Date().toLocaleDateString('en-CA'));
  }, [selectedDate]);

  const patient = patients?.find((p) => p?.id === selectedPatient) || patients?.[0];
  const medications = meds?.[selectedPatient] || [];
  const selectedDayName = selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }) : "";
  const filteredMeds = medications.filter(m => !m.scheduleDays || m.scheduleDays.includes(selectedDayName));

  const todayTimeline = getTimeline(selectedPatient, filteredMeds, demoDosesMap);
  const todayTakenCount = todayTimeline.filter((tx) => tx.status === "taken").length;
  const todayMissedCount = todayTimeline.filter((tx) => tx.status === "missed").length;
  const totalCount = todayTimeline.length;
  // Consistency Score = average of all individual medication monthly adherence scores
  const avgAdherence = medications.length ? Math.round(medications.reduce((s, m) => s + m.adherence, 0) / medications.length) : 0;
  // Streak: count consecutive days with at least one taken dose (using demoDoses status)
  const allDoses = demoDosesMap?.[selectedPatient] || [];
  const takenDoses = allDoses.filter(d => d.status === "taken").length;
  const streak = takenDoses > 0 ? Math.min(takenDoses, 30) : 0;
  const lowPillMeds = medications.filter((m) => m.pillsLeft <= 5);

  const logsForSelectedDate = selectedDate ? getLogsForDate(selectedDate, selectedPatient, filteredMeds, demoDosesMap) : [];
  const isToday = selectedDate === (mounted ? new Date().toLocaleDateString('en-CA') : "");
  const selectedDateLabel = isToday ? t?.todayLabel : selectedDate;
  const DAYS = lang === "hi" ? DAYS_HI : DAYS_EN;

  const addMedication = useCallback(async (med) => {
    const id = `m${nextId.current++}`;
    setMeds((prev) => ({ ...prev, [selectedPatient]: [...(prev[selectedPatient] || []), { ...med, id, adherence: 100 }] }));
    setShowAddMed(false);

    try {
      await fetch("/api/dashboard/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "medication",
          phone: selectedPatient,
          name: med.name,
          dosage: med.dosage,
          time: med.time,
          inventory: med.inventory || 30
        })
      });
      setDbKey(k => k + 1);
    } catch (e) {
      console.error("Failed to persist medication:", e);
    }
  }, [selectedPatient]);

  const addPatient = async ({ name, phone }) => {
    try {
      const res = await fetch("/api/dashboard/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Patient "${name}" added successfully`);
        setShowAddPatient(false);
        setDbKey(k => k + 1);
      } else {
        showToast(data.error || "Failed to add patient", "error");
      }
    } catch {
      showToast("Error adding patient", "error");
    }
  };

  const deleteMedication = async (medName) => {
    try {
      const res = await fetch("/api/dashboard/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedPatient, cleanName: medName })
      });
      if (res.ok) {
        showToast("Medicine deleted successfully");
        setDbKey(k => k + 1);
        setEditMed(null);
        setConfirmDelete(null);
      } else {
        showToast("Failed to delete medicine", "error");
      }
    } catch {
      showToast("Error deleting medicine", "error");
    }
  };

  const updateMedication = async (updated) => {
    try {
      const res = await fetch("/api/dashboard/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phone: selectedPatient, 
          cleanName: updated.originalName, 
          updates: { name: updated.name, dosage: updated.dosage, inventory: updated.pillsLeft }
        })
      });
      if (res.ok) {
        showToast("Changes saved successfully");
        setDbKey(k => k + 1);
        setEditMed(null);
      } else {
        showToast("Failed to save changes", "error");
      }
    } catch {
      showToast("Error saving changes", "error");
    }
  };

  const markSourcedLocally = async (medName) => {
    try {
      await fetch("/api/dashboard/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedPatient, cleanName: medName, updates: { inventory: 30 } })
      });
      setDbKey(k => k + 1);
      showToast(t?.sourcedSuccess);
    } catch {
      showToast("Failed to update inventory", "error");
    }
  };

  const sendOfflineReminder = (medName) => {
    showToast(t?.reminderSent);
  };

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-primary)', fontWeight: 600 }}>Loading Dashboard...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '80px' }}>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title" style={{ color: 'var(--color-primary)', fontSize: '28px', fontWeight: 800 }}>{patient?.name}</h1>
          <p className="dash-page-subtitle" style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{maskPhone(patient?.phone)} &bull; {t?.lastActive}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={() => setLang(lang === "en" ? "hi" : "en")} style={{ borderRadius: '20px', padding: '8px 20px' }}>{lang === "en" ? "Hindi" : "English"}</button>
          <button className="btn btn-secondary" onClick={() => setShowAddPatient(true)} style={{ borderRadius: '20px', padding: '8px 20px', borderColor: 'var(--color-primary)', color: 'var(--color-primary)', fontWeight: 700 }}>+ Add Patient</button>
          <button className="btn btn-primary" onClick={() => window.print()} style={{ borderRadius: '20px', padding: '8px 20px', background: 'var(--color-primary)', border: 'none' }}>{t?.downloadReport}</button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 18px', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fecaca' }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-secondary" onClick={() => { setError(null); setDbKey(k => k + 1); }} style={{ fontSize: '12px', padding: '4px 12px', background: 'white' }}>Retry</button>
        </div>
      )}

      {lowPillMeds.length > 0 && (
        <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', marginBottom: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <button onClick={() => setRestockExpanded(!restockExpanded)} style={{ background: 'none', border: 'none', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: '40px', height: '40px', background: '#fee2e2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22.08V12"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: "15px", fontWeight: 700, color: '#0f172a' }}>{t?.restockAlert(lowPillMeds.length)}</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Action required to avoid missing doses</div>
              </div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', background: '#fff', padding: '6px 14px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              {restockExpanded ? "Hide" : "Manage"}
            </div>
          </button>
          {restockExpanded && (
            <div style={{ padding: '0 24px 24px', borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '20px' }}>
              {lowPillMeds.map(m => (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: '12px', background: 'white', padding: '12px 16px', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{m.name}</span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Low Stock: {m.pillsLeft} pills left</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => sendOfflineReminder(m.name)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px', color: '#475569' }}>Remind Offline</button>
                    <a href={`https://www.1mg.com/search/all?name=${m.name}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px' }}>Buy Online</a>
                    <button onClick={() => markSourcedLocally(m.name)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px', background: '#10b981' }}>Mark Got It</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="dash-stats-grid">
        <Stat label={t?.todaysProgress} icon="bar-chart" value={`${todayTakenCount}/${totalCount}`} extra={`${totalCount - todayTakenCount - todayMissedCount} ${t?.remaining}`} type="neutral" />
        <Stat label={t?.adherenceRate} icon="target" value={`${avgAdherence}%`} extra={lang === 'en' ? 'This month' : 'इस महीने'} type={avgAdherence >= 80 ? "up" : "down"} />
        <Stat label={t?.currentStreak} icon="flame" value={`${streak} ${t?.days}`} extra={lang === 'en' ? 'Consecutive doses' : 'लगातार खुराक'} type="neutral" />
        <Stat label={t?.missedToday} icon="alert-circle" value={String(todayMissedCount)} extra={todayMissedCount > 0 ? t?.needsAttention : t?.allOnTrack} type={todayMissedCount > 0 ? "down" : "up"} />
      </div>

      {/* Visual Adherence Analytics Bar */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', marginBottom: '32px', background: 'white', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>
              {lang === 'en' ? '📊 Adherence Progress Analytics' : '📊 अनुपालन प्रगति विश्लेषण'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              {lang === 'en' ? 'Live breakdown of doses logged today across scheduled regimens' : 'आज के लिए निर्धारित खुराक का लाइव रिकॉर्ड'}
            </p>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: avgAdherence >= 80 ? '#10b981' : '#f59e0b' }}>
            {avgAdherence}%
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', display: 'flex', marginBottom: '16px' }}>
          <div style={{ width: `${totalCount > 0 ? (todayTakenCount / totalCount) * 100 : 0}%`, background: '#10b981', transition: 'width 0.4s ease' }} title="Taken" />
          <div style={{ width: `${totalCount > 0 ? (todayMissedCount / totalCount) * 100 : 0}%`, background: '#ef4444', transition: 'width 0.4s ease' }} title="Missed" />
          <div style={{ width: `${totalCount > 0 ? ((totalCount - todayTakenCount - todayMissedCount) / totalCount) * 100 : 0}%`, background: '#cbd5e1', transition: 'width 0.4s ease' }} title="Pending" />
        </div>

        {/* Legend metrics */}
        <div style={{ display: 'flex', gap: '24px', fontSize: '12px', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ color: '#334155' }}>{lang === 'en' ? 'Taken' : 'ली गई'}: <strong>{todayTakenCount}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ color: '#334155' }}>{lang === 'en' ? 'Missed' : 'छूटी'}: <strong>{todayMissedCount}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#cbd5e1' }} />
            <span style={{ color: '#334155' }}>{lang === 'en' ? 'Pending' : 'बाकी'}: <strong>{totalCount - todayTakenCount - todayMissedCount}</strong></span>
          </div>
        </div>
      </div>

      <div className="dash-content-grid">
        <div className="dash-main-col">
          <section className="dash-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="dash-section-title" style={{ margin: 0 }}>{t?.timeline}</h2>
              <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: '30px', padding: '4px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                <button className="btn-icon-simple" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toLocaleDateString('en-CA')); }} style={{ background: 'none', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div style={{ padding: '0 16px', textAlign: 'center', minWidth: '140px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary)' }}>{selectedDateLabel}</div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedDayName}</div>
                </div>
                <button className="btn-icon-simple" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toLocaleDateString('en-CA')); }} style={{ background: 'none', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
            
            <div className="timeline-bg" style={{ padding: '0' }}>
              {logsForSelectedDate.length === 0 ? (
                <div style={{ padding: "80px 40px", textAlign: "center", color: "var(--color-text-muted)" }}>
                  <div style={{ width: '64px', height: '64px', background: 'var(--color-bg-alt)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Free Day!</div>
                  <div style={{ fontSize: '14px' }}>{t?.noMedsDate}</div>
                </div>
              ) : logsForSelectedDate.map(log => (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '80px 40px 1.5fr 1fr 1fr 1fr', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'left' }}>{formatTime(log.time)}</div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div className={`timeline-dot ${log.status}`} style={{ margin: 0 }}></div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text)' }}>{log.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{log.dosage || "1 Tab"}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{log.instruction || "After Food"}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: log.status === 'taken' ? '#059669' : log.status === 'missed' ? '#ef4444' : '#94a3b8' }}>
                    {log.status === 'taken' ? t?.taken : log.status === 'missed' ? t?.missed : t?.upcoming}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="dash-side-col no-print">
          <section className="dash-section">
            <h2 className="dash-section-title" style={{ marginBottom: '16px' }}>{t?.adherenceTitle}</h2>
            <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-primary)' }}>{calData.monthName}</div>
              <div className="calendar-grid" style={{ gap: '8px' }}>
                {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px' }}>{d}</div>)}
                {Array.from({ length: calData.startingDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
                {calData.days.map(day => <button key={day.day} className={`day-cell ${day.status} ${day.isToday ? "today" : ""} ${day.fullDate === selectedDate ? "selected" : ""}`} onClick={() => setSelectedDate(day.fullDate)} style={{ borderRadius: '10px' }}>{day.day}</button>)}
              </div>
              <div className="legend" style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--status-taken)' }}></div><span>{t?.taken}</span></div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--status-missed)' }}></div><span>{t?.missed}</span></div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--status-partial)' }}></div><span>{t?.partial}</span></div>
              </div>
            </div>
          </section>

          <section className="dash-section" style={{ marginTop: '32px' }}>
            <div className="dash-section-header" style={{ marginBottom: '16px' }}>
              <h2 className="dash-section-title">{t?.medications}</h2>
              <button className="btn btn-primary" onClick={() => setShowAddMed(true)} style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '20px' }}>{t?.addMedicine}</button>
            </div>
            <div className="med-accordion" style={{ borderRadius: '16px', border: '1px solid var(--color-border)' }}>
              {medications.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <div style={{ width: '48px', height: '48px', background: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-primary)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>{t?.noMedsAdded}</div>
                  <button className="btn btn-secondary" onClick={() => setShowAddMed(true)} style={{ marginTop: '16px', fontSize: '12px', padding: '6px 14px' }}>{t?.addMedicine}</button>
                </div>
              ) : medications.map(med => (
                <div key={med.id} className="med-accordion-item">
                  <div className="med-accordion-header" onClick={() => setExpandedMed(expandedMed === med.id ? null : med.id)} style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '24px', height: '24px', background: '#e0f2fe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{med.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {med.duration ? (
                            <>
                              <span style={{
                                background: med.daysConsumed >= med.duration ? '#dcfce7' : '#eff6ff',
                                color: med.daysConsumed >= med.duration ? '#16a34a' : '#2563eb',
                                borderRadius: '6px', padding: '1px 7px', fontWeight: 700, fontSize: '10px'
                              }}>
                                {med.daysConsumed >= med.duration ? '✅ Completed' : `🔄 Day ${med.daysConsumed}/${med.duration}`}
                              </span>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span>{med.duration} day course</span>
                            </>
                          ) : (
                            <span style={{ background: '#f1f5f9', borderRadius: '6px', padding: '1px 7px', fontSize: '10px' }}>∞ Continuous • {med.daysConsumed} days taken</span>
                          )}
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span>{med.pillsLeft} pills left</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {med.pillsLeft <= 5 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m12 9 2 2-2 2-2-2 2-2Z"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>}
                      <span style={{ fontSize: '12px', color: '#94a3b8', transform: expandedMed === med.id ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▾</span>
                    </div>
                  </div>
                  {expandedMed === med.id && (
                    <div className="med-accordion-content" style={{ padding: '0 20px 20px', background: 'transparent' }}>
                      <div style={{ padding: '16px', background: 'var(--color-bg)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                        {/* Prescription Progress */}
                        {med.duration && (
                          <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Prescription Progress</div>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: med.daysConsumed >= med.duration ? '#16a34a' : '#2563eb' }}>
                                {med.daysConsumed} / {med.duration} days
                              </div>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(100, Math.round((med.daysConsumed / med.duration) * 100))}%`,
                                height: '100%',
                                background: med.daysConsumed >= med.duration
                                  ? 'linear-gradient(90deg, #10b981, #059669)'
                                  : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                                borderRadius: '4px',
                                transition: 'width 0.4s ease'
                              }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                              <span>Day 1</span>
                              <span style={{ fontWeight: 800, color: med.daysConsumed >= med.duration ? '#16a34a' : '#64748b' }}>
                                {med.daysConsumed >= med.duration ? '✅ Course Completed!' : `${med.duration - med.daysConsumed} days remaining`}
                              </span>
                              <span>Day {med.duration}</span>
                            </div>
                          </div>
                        )}
                        {!med.duration && (
                          <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Days Consumed</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>{med.daysConsumed} days</div>
                          </div>
                        )}
                        {/* Adherence */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{t?.monthlyConsistency}</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: med.adherence >= 80 ? '#059669' : '#d97706' }}>{med.adherence}%</div>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
                          <div style={{ width: `${med.adherence}%`, height: '100%', background: med.adherence >= 80 ? '#10b981' : '#f59e0b' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="med-inventory" style={{ background: 'white', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--color-border)' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: med.pillsLeft > 5 ? 'var(--status-taken)' : 'var(--status-missed)' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: 800 }}>{med.pillsLeft} pills left</span>
                          </div>
                          <button className="btn btn-secondary" onClick={() => setEditMed(med)} style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '10px' }}>Edit</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {showAddMed && <MedicationFormModal onSave={addMedication} onClose={() => setShowAddMed(false)} lang={lang} />}
      {editMed && <MedicationFormModal med={editMed} onSave={updateMedication} onDelete={() => setConfirmDelete(editMed.name)} onClose={() => setEditMed(null)} lang={lang} />}
      {showAddPatient && <AddPatientModal onSave={addPatient} onClose={() => setShowAddPatient(false)} />}
      
      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay" style={{ zIndex: 200, position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content animate-fade-in-up" style={{ padding: '32px', textAlign: 'center', maxWidth: '360px', width: '100%', background: 'white', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ width: '56px', height: '56px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 12px', color: '#0f172a' }}>Delete Medication?</h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 28px', lineHeight: 1.5 }}>Are you sure you want to permanently delete <strong>{confirmDelete}</strong>? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '14px' }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, padding: '12px', borderRadius: '14px', background: '#ef4444', border: 'none' }} onClick={() => deleteMedication(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: toast.type === 'error' ? '#ef4444' : '#10b981', color: 'white', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 999, animation: 'fadeUp 0.3s forwards' }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Stat({ label, icon, value, extra, type }) {
  const getIcon = (iconName) => {
    switch(iconName) {
      case 'bar-chart': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>;
      case 'target': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
      case 'flame': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.5 4 6.5 2 2 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;
      case 'alert-circle': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
      default: return null;
    }
  };
  return (
    <div className="dash-stat-card" style={{ borderRadius: '20px', padding: '24px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="dash-stat-header" style={{ marginBottom: '12px' }}><span className="dash-stat-label" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span><span className="dash-stat-icon" style={{ color: 'var(--color-primary)' }}>{getIcon(icon)}</span></div>
      <div className="dash-stat-value" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)' }}>{value}</div>
      {extra && <div className={`dash-stat-change ${type}`} style={{ fontWeight: 600, fontSize: '12px' }}>{extra}</div>}
    </div>
  );
}

function MedicationFormModal({ med, onSave, onDelete, onClose, lang }) {
  const [name, setName] = useState(med?.name || "");
  const [dosage, setDosage] = useState(med?.dosage || "");
  const [pillsLeft, setPillsLeft] = useState(med?.pillsLeft || 0);
  const [scheduleDays, setScheduleDays] = useState(med?.scheduleDays || WEEKDAYS);
  const toggleDay = (day) => setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ zIndex: 100, position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="modal-content animate-fade-in-up" style={{ borderRadius: '24px', maxWidth: '480px', width: '100%', background: 'white', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{med ? "Edit Medication" : "Add Medication"}</h3>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div className="input-group"><label>Medicine Name</label><input className="input" style={{ borderRadius: '12px' }} placeholder="e.g. Advil" value={name} onChange={(e) => setName(e.target.value)} disabled={!!med} /></div>
            <div className="input-group"><label>Dosage</label><input className="input" style={{ borderRadius: '12px' }} placeholder="e.g. 200mg" value={dosage} onChange={(e) => setDosage(e.target.value)} /></div>
          </div>
          <div className="input-group" style={{ marginBottom: "20px" }}><label>Pills Remaining</label><input className="input" style={{ borderRadius: '12px' }} type="number" value={pillsLeft} onChange={(e) => setPillsLeft(e.target.value)} /></div>
          <div className="input-group" style={{ marginBottom: "24px" }}>
            <label>Schedule Days</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
              {WEEKDAYS.map(day => (
                <button key={day} type="button" onClick={() => toggleDay(day)} style={{ padding: "8px 12px", fontSize: "11px", borderRadius: "10px", border: "1px solid", borderColor: scheduleDays.includes(day) ? "var(--color-primary)" : "#e2e8f0", background: scheduleDays.includes(day) ? "var(--color-primary)" : "white", color: scheduleDays.includes(day) ? "white" : "#475569", cursor: "pointer", fontWeight: 600 }}>{day.slice(0, 3)}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: 'space-between', marginTop: "32px" }}>
            {med ? <button className="btn" onClick={() => onDelete(med.name)} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '12px', padding: '10px 20px' }}>Delete</button> : <div></div>}
            <div style={{ display: "flex", gap: "10px" }}><button className="btn btn-secondary" onClick={onClose} style={{ borderRadius: '12px', padding: '10px 20px' }}>Cancel</button><button className="btn btn-primary" onClick={() => onSave({ ...med, originalName: med ? med.name : null, name, dosage, pillsLeft, scheduleDays })} style={{ borderRadius: '12px', padding: '10px 24px', background: 'var(--color-primary)', border: 'none' }}>Save</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPatientModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const handleSubmit = async () => {
    setPhoneError("");
    if (!phone.trim()) { setPhoneError("Phone number is required"); return; }
    // Basic validation: digits, +, spaces, dashes
    const cleaned = phone.replace(/[\s\-]/g, "");
    if (!/^\+?\d{10,15}$/.test(cleaned)) {
      setPhoneError("Enter a valid phone number (e.g. +919876543210)");
      return;
    }
    setSaving(true);
    await onSave({ name: name.trim() || "Patient", phone: cleaned });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ zIndex: 100, position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="modal-content animate-fade-in-up" style={{ borderRadius: '24px', maxWidth: '440px', width: '100%', background: 'white', boxShadow: 'var(--shadow-lg)' }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--color-primary-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Add New Patient</h3>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Add a patient to the dashboard. They can then use the Telegram bot with their phone number to manage medications.
          </p>

          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Patient Name</label>
            <input
              id="add-patient-name"
              className="input"
              style={{ borderRadius: '12px', width: '100%' }}
              placeholder="e.g. Ramesh Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="input-group" style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              id="add-patient-phone"
              className="input"
              style={{ borderRadius: '12px', width: '100%', borderColor: phoneError ? '#ef4444' : undefined }}
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {phoneError && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px', fontWeight: 600 }}>{phoneError}</div>}
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginTop: '16px', fontSize: '12px', color: '#92400e', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '14px' }}>💡</span>
            <span>The phone must match what the patient uses on Telegram (including country code, e.g. +91).</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '14px' }}>Cancel</button>
            <button
              id="add-patient-submit"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saving}
              style={{ flex: 2, padding: '12px', borderRadius: '14px', background: 'var(--color-primary)', border: 'none', fontWeight: 700, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Adding…' : 'Add Patient'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
