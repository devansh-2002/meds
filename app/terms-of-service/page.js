import Link from "next/link";

export const metadata = {
  title: "Terms of Service — DawaiSaathi",
  description: "Terms of Service for DawaiSaathi MVP.",
};

export default function TermsOfService() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-16) var(--space-6)" }}>
      <Link href="/" style={{ fontSize: "var(--text-sm)", display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-8)", color: "var(--color-text-secondary)" }}>
        ← Back to Home
      </Link>

      <h1 style={{ marginBottom: "var(--space-2)" }}>Terms of Service</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-10)", fontSize: "var(--text-sm)" }}>
        Last updated: May 8, 2026
      </p>

      <article className="policy-content" style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-relaxed)", color: "var(--color-text-secondary)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <section>
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>1. Introduction</h2>
          <p>
            Welcome to DawaiSaathi. By using our automated messaging service, you agree to these Terms of Service.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>2. Not Medical Advice</h2>
          <p>
            DawaiSaathi is a reminder application. It is <strong>not</strong> a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Do not disregard professional medical advice or delay in seeking it because of something you have read on DawaiSaathi.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>3. MVP Disclaimer</h2>
          <p>
            This service is currently provided &quot;as is&quot; as a Minimum Viable Product (MVP). We do not guarantee 100% uptime, reliability, or that reminders will be delivered exactly on time due to potential third-party network delays (e.g. WhatsApp/Telegram).
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>4. User Responsibility</h2>
          <p>
            It is your sole responsibility to ensure you take your medications as prescribed by your doctor. DawaiSaathi assumes no liability for missed medications or any health consequences resulting from missed medications.
          </p>
        </section>
      </article>
    </div>
  );
}
