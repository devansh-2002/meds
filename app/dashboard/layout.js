import "./dashboard.css";
import Sidebar from "./Sidebar";

export const metadata = {
  title: "Dashboard — DawaiSaathi",
  description: "Monitor your family's medication adherence in real-time.",
};

export default function DashboardLayout({ children }) {
  return (
    <div className="dash-layout">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main Content ── */}
      <main className="dash-main">
        {children}
      </main>
    </div>
  );
}
