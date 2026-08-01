"use client";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({ profileName: "", language: "en", reminderOffset: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/dashboard/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        showToast("Settings saved successfully!");
      } else {
        showToast("Failed to save settings", "error");
      }
    } catch (e) {
      showToast("Error saving settings", "error");
    }
  };

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-primary)', fontWeight: 600 }}>Loading Settings...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '80px', maxWidth: '600px' }}>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title" style={{ color: 'var(--color-primary)', fontSize: '28px', fontWeight: 800 }}>Settings</h1>
          <p className="dash-page-subtitle" style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Manage your profile and notification preferences</p>
        </div>
      </div>

      <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div className="input-group">
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'block' }}>Profile Name</label>
          <input 
            type="text" 
            className="input" 
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border)' }}
            value={settings.profileName || ""} 
            onChange={(e) => setSettings({ ...settings, profileName: e.target.value })} 
            placeholder="Enter your name"
          />
        </div>

        <div className="input-group">
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'block' }}>Dashboard Language</label>
          <select 
            className="input"
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'white' }}
            value={settings.language || "en"} 
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
          >
            <option value="en">English</option>
            <option value="hi">Hindi (हिन्दी)</option>
          </select>
        </div>

        <div className="input-group">
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'block' }}>Reminder Timing Offset</label>
          <select 
            className="input"
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'white' }}
            value={settings.reminderOffset || 0} 
            onChange={(e) => setSettings({ ...settings, reminderOffset: parseInt(e.target.value) })}
          >
            <option value={0}>Exactly on time</option>
            <option value={5}>5 minutes before</option>
            <option value={10}>10 minutes before</option>
            <option value={15}>15 minutes before</option>
          </select>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>When should the bot send you the reminder?</p>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'var(--color-primary)' }}>
            Save Changes
          </button>
        </div>

      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: toast.type === 'error' ? '#ef4444' : '#10b981', color: 'white', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 999, animation: 'fadeUp 0.3s forwards' }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
