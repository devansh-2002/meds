"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="dash-sidebar no-print">
      <div className="dash-sidebar-header">
        <div className="logo">
          <span className="logo-icon">💊</span>
          <span className="logo-text">DawaiSaathi</span>
        </div>
      </div>

      <nav className="dash-nav">
        <div className="dash-nav-label">Overview</div>
        <Link href="/dashboard" className={`dash-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
          <span className="dash-nav-icon">📊</span>
          Dashboard
        </Link>

        <div className="dash-nav-label">Patients</div>
        <button className="dash-nav-item add-patient-btn" style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          <span className="dash-nav-icon">＋</span>
          Add Patient
        </button>

        <div className="dash-nav-label">Tools</div>
        <Link href="/dashboard" className={`dash-nav-item ${pathname === '/dashboard/reports' ? 'active' : ''}`}>
          <span className="dash-nav-icon">📄</span>
          Reports
        </Link>
        <Link href="/dashboard/settings" className={`dash-nav-item ${pathname === '/dashboard/settings' ? 'active' : ''}`}>
          <span className="dash-nav-icon">⚙️</span>
          Settings
        </Link>
      </nav>

      <div className="dash-user-profile">
        <div className="avatar">RS</div>
        <div className="user-info">
          <div className="user-name">Rahul Sharma</div>
          <div className="user-role">Caregiver</div>
        </div>
      </div>
    </aside>
  );
}
