export const metadata = {
  title: "Privacy Policy — DawaiSaathi",
  description: "Minimal privacy policy for DawaiSaathi MVP.",
};

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-16) var(--space-6)" }}>
      <a href="/" style={{ fontSize: "var(--text-sm)", display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-8)", color: "var(--color-text-secondary)" }}>
        ← Back to Home
      </a>

      <h1 style={{ marginBottom: "var(--space-2)" }}>Privacy Policy</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-10)", fontSize: "var(--text-sm)" }}>
        Last updated: May 8, 2026
      </p>

      <article className="policy-content" style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-relaxed)", color: "var(--color-text-secondary)" }}>
        <p style={{ marginBottom: "var(--space-4)" }}>
          DawaiSaathi collects the absolute minimum data required to function. We only collect the phone number you use to chat with us and the names/schedules of the medicines you provide.
        </p>
        <p style={{ marginBottom: "var(--space-4)" }}>
          We <strong>do not</strong> sell, rent, or share this data with third-parties. We <strong>do not</strong> use your data for advertising.
        </p>
        <p>
          If you wish to remove your data at any time, simply contact us at <a href="mailto:privacy@dawaisaathi.com">privacy@dawaisaathi.com</a>.
        </p>
      </article>
    </div>
  );
}
