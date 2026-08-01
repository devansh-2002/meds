"use client";
import { useState, useEffect } from "react";
import s from "./page.module.css";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ═══════ HEADER ═══════ */}
      <header className={`${s.header} ${scrolled ? s.scrolled : ""}`}>
        <div className={s.headerInner}>
          <a href="/" className={s.logo} id="logo-link">
            <div className={s.logoIcon}>💊</div>
            <div className={s.logoText}>Dawai<span>Saathi</span></div>
          </a>

          <nav className={s.nav}>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#caregiver">For Caregivers</a>
          </nav>

          <div className={s.headerActions}>
            <a href="/dashboard" className="btn btn-secondary btn-sm" id="nav-dashboard">Dashboard</a>
            <a href="https://wa.me/919876543210?text=Hi%20DawaiSaathi" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" id="nav-start">Start Free →</a>
          </div>
        </div>
      </header>

      {/* ═══════ HERO ═══════ */}
      <section className={s.hero}>
        <div className={s.heroBg} aria-hidden="true" />
        <div className={s.heroInner}>
          <div className={s.heroContent}>
            <div className={`${s.heroBadge} animate-fade-in`}>
              <span className={s.pulseDot} />
              WhatsApp & Telegram &bull; 100% Free
            </div>

            <h1 className={`${s.heroTitle} animate-fade-in-up`}>
              Never miss a{" "}
              <span className={s.gradient}>medicine</span>{" "}
              again.
            </h1>

            <p className={`${s.heroDesc} animate-fade-in-up`}>
              DawaiSaathi sends timely WhatsApp & Telegram reminders to take your medicines
              and lets your family track adherence in real&#8209;time.
              No app download needed.
            </p>

            <div className={`${s.heroCtas} animate-fade-in-up`} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="https://wa.me/919876543210?text=Hi%20DawaiSaathi" target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg" id="hero-cta-wa">
                <WaIcon /> WhatsApp
              </a>
              <a href="https://t.me/DawaiSaathiBot" target="_blank" rel="noopener noreferrer" className="btn btn-telegram btn-lg" id="hero-cta-tg" style={{ background: '#0088cc', color: 'white' }}>
                <TgIcon /> Telegram
              </a>
              <a href="/dashboard" className="btn btn-secondary btn-lg" id="hero-cta-dash">
                Dashboard →
              </a>
            </div>

            <div className={s.heroProof}>
              <Proof value="101M+" label="Diabetics in India" />
              <Proof value="50–70%" label="Miss their medicines" />
              <Proof value="₹0" label="To get started" />
            </div>
          </div>

          <div className={s.phoneWrapper}>
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section className={s.section} id="features">
        <div className={s.sectionInner}>
          <div className={s.sectionEyebrow}>Features</div>
          <h2 className={s.sectionHeading}>Everything you need to stay on track</h2>
          <p className={s.sectionDesc}>
            Built for Indian patients and families. Works through WhatsApp — no new app to learn.
          </p>

          <div className={`${s.featuresGrid} stagger-children`}>
            <Feature emoji="🔔" color="c1" title="Smart Reminders" desc="WhatsApp messages at the right time. One-tap buttons to log taken, skipped, or snoozed." />
            <Feature emoji="👨‍👩‍👧" color="c2" title="Family Dashboard" desc="Your children see medication adherence in real-time. No more daily nagging calls." />
            <Feature emoji="🔥" color="c3" title="Streak Tracking" desc="Build habits with streaks and weekly summaries. Stay motivated day after day." />
            <Feature emoji="💊" color="c4" title="Refill Alerts" desc="Get alerted 5 days before you run out, with a one-tap link to reorder from 1mg." />
            <Feature emoji="🌐" color="c5" title="Multi-Language" desc="Hindi and English today. Tamil, Telugu, Kannada, Bengali coming soon." />
            <Feature emoji="📊" color="c6" title="Doctor Reports" desc="Generate PDF adherence reports. Share with your doctor via WhatsApp." />
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className={`${s.section} ${s.stepsSection}`} id="how-it-works">
        <div className={`${s.sectionInner} ${s.sectionCenter}`}>
          <div className={s.sectionEyebrow}>How It Works</div>
          <h2 className={s.sectionHeading}>Up and running in 2 minutes</h2>
          <p className={s.sectionDesc}>
            No downloads. No sign-ups. No complex setup. Just WhatsApp.
          </p>

          <div className={s.stepsRow}>
            <Step num="1" emoji="💬" title='Say "Hi" on WhatsApp' desc="Message our number. The bot guides you through setup in your language." />
            <Step num="2" emoji="💊" title="Add Your Medicines" desc="Share medicine names, dosages, and timings. Under a minute per medicine." />
            <Step num="3" emoji="✅" title="Get Reminders" desc="Receive timely reminders. Tap to confirm. Your family sees progress live." />
          </div>
        </div>
      </section>

      {/* ═══════ CAREGIVER ═══════ */}
      <section className={s.section} id="caregiver">
        <div className={s.sectionInner}>
          <div className={s.caregiverRow}>
            <div>
              <div className={s.sectionEyebrow}>For Caregivers &amp; Family</div>
              <h2 className={s.sectionHeading}>Peace of mind, from anywhere</h2>
              <p className={s.sectionDesc}>
                Managing your parents&apos; medication from another city? See exactly what&apos;s happening — in real-time.
              </p>

              <div className={s.caregiverPoints}>
                <Point icon="📱" title="Real-Time Adherence" desc="See the moment a dose is taken or missed. No waiting." />
                <Point icon="🚨" title="Missed Dose Alerts" desc="Instant notification if a dose is missed after 30 minutes." />
                <Point icon="👥" title="Multi-Patient" desc="Both parents on one dashboard. Switch seamlessly." />
                <Point icon="📄" title="Doctor Reports" desc="PDF adherence report, shareable via WhatsApp." />
              </div>
            </div>

            <DashPreview />
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className={s.cta}>
        <div className={s.ctaInner}>
          <h2>Start taking care, today.</h2>
          <p className={s.ctaDesc}>
            Free forever for patients. No app download. Just send a WhatsApp message and you&apos;re set.
          </p>
          <a href="https://wa.me/919999999999?text=Hi%20DawaiSaathi" target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg" id="cta-wa-btn">
            <WaIcon /> Start Free on WhatsApp
          </a>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div className={s.footerGrid}>
            <div className={s.footerAbout}>
              <a href="/" className={s.logo}>
                <div className={s.logoIcon}>💊</div>
                <div className={s.logoText}>Dawai<span>Saathi</span></div>
              </a>
              <p>India&apos;s first WhatsApp-based medication adherence platform. Built for patients and their families.</p>
            </div>
            <div className={s.footerCol}>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#caregiver">For Caregivers</a>
              <a href="/dashboard">Dashboard</a>
            </div>
            <div className={s.footerCol}>
              <h4>Legal</h4>
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms-of-service">Terms of Service</a>
              <a href="mailto:help@dawaisaathi.com">Contact Us</a>
            </div>
            <div className={s.footerCol}>
              <h4>Connect</h4>
              <a href="https://wa.me/919999999999?text=Hi" target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a href="https://twitter.com/dawaisaathi" target="_blank" rel="noopener noreferrer">Twitter / X</a>
              <a href="https://instagram.com/dawaisaathi" target="_blank" rel="noopener noreferrer">Instagram</a>
            </div>
          </div>
          <div className={s.footerBottom}>
            <span>© 2026 DawaiSaathi. All rights reserved.</span>
            <span>Made with ❤️ in India</span>
          </div>
        </div>
      </footer>
    </>
  );
}

/* ════════ Micro-components ════════ */

function Proof({ value, label }) {
  return (
    <div className={s.proofItem}>
      <div className={s.proofValue}>{value}</div>
      <div className={s.proofLabel}>{label}</div>
    </div>
  );
}

function Feature({ emoji, color, title, desc }) {
  return (
    <div className={s.featureCard}>
      <div className={`${s.featureEmoji} ${s[color]}`}>{emoji}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function Step({ num, emoji, title, desc }) {
  return (
    <div className={s.step}>
      <div className={s.stepNum}>{num}</div>
      <div className={s.stepEmoji}>{emoji}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function Point({ icon, title, desc }) {
  return (
    <div className={s.point}>
      <div className={s.pointIcon}>{icon}</div>
      <div>
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function TgIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function PhoneMockup() {
  return (
    <div className={s.phone}>
      <div className={s.phoneNotch} />
      <div className={s.phoneScreen}>
        <div className={s.waHeader}>
          <span className={s.waBackArrow}>‹</span>
          <div className={s.waAvatar}>💊</div>
          <div>
            <div className={s.waName}>DawaiSaathi</div>
            <div className={s.waStatus}>online</div>
          </div>
        </div>
        <div className={s.waChat}>
          <div className={`${s.bubble} ${s.bubbleIn}`}>
            🕐 Good morning! Time for your medicines:<br/><br/>
            1. <strong>Metformin 500mg</strong><br/>
            2. <strong>Amlodipine 5mg</strong>
            <div className={s.waQuickBtns}>
              <span className={s.waQuickBtn}>✅ Taken</span>
              <span className={s.waQuickBtn}>⏰ Snooze</span>
              <span className={s.waQuickBtn}>❌ Skip</span>
            </div>
            <div className={s.bubbleTime}>8:00 AM</div>
          </div>

          <div className={`${s.bubble} ${s.bubbleOut}`}>
            ✅ Taken
            <div className={s.bubbleTime}>8:02 AM ✓✓</div>
          </div>

          <div className={`${s.bubble} ${s.bubbleIn}`}>
            🎉 Great! 2/2 morning medicines taken.<br/><br/>
            🔥 <strong>12-day streak!</strong> Keep going!
            <div className={s.bubbleTime}>8:02 AM</div>
          </div>

          <div className={`${s.bubble} ${s.bubbleIn}`}>
            ⚠️ Refill alert: <strong>~4 days</strong> of Metformin left.<br/><br/>
            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>🛒 Reorder from 1mg →</span>
            <div className={s.bubbleTime}>8:03 AM</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashPreview() {
  return (
    <div className={s.dashPreview}>
      <div className={s.dashTitleBar}>
        <span className={`${s.tbDot} ${s.r}`} />
        <span className={`${s.tbDot} ${s.y}`} />
        <span className={`${s.tbDot} ${s.g}`} />
        <span className={s.tbUrl}>dawaisaathi.com/dashboard</span>
      </div>
      <div className={s.dashBody}>
        <div className={s.dashRow1}>
          <div>
            <div className={s.dashPatient}>👩‍🦳 Maa</div>
            <div className={s.dashSub}>Last dose: 2 min ago</div>
          </div>
          <span className="streak-badge"><span className="streak-icon">🔥</span> 12 days</span>
        </div>

        <div className={s.dashMiniStats}>
          <div className={s.miniStat}>
            <div className={`${s.miniStatVal} ${s.green}`}>92%</div>
            <div className={s.miniStatLabel}>Adherence</div>
          </div>
          <div className={s.miniStat}>
            <div className={`${s.miniStatVal} ${s.amber}`}>1</div>
            <div className={s.miniStatLabel}>Missed</div>
          </div>
          <div className={s.miniStat}>
            <div className={`${s.miniStatVal} ${s.teal}`}>4</div>
            <div className={s.miniStatLabel}>Medicines</div>
          </div>
        </div>

        <div className={s.dashMedLabel}>Today&apos;s Medicines</div>
        {[
          { dot: "taken", name: "Metformin 500mg", badge: "badge-taken", label: "✅ Taken" },
          { dot: "taken", name: "Amlodipine 5mg", badge: "badge-taken", label: "✅ Taken" },
          { dot: "missed", name: "Atorvastatin 10mg", badge: "badge-missed", label: "❌ Missed" },
          { dot: "pending", name: "Thyronorm 50mcg", badge: "badge-pending", label: "⏳ 8 PM" },
        ].map((m) => (
          <div className={s.dashMedRow} key={m.name}>
            <span className={s.dashMedName}><span className={`status-dot ${m.dot}`} />{m.name}</span>
            <span className={`badge ${m.badge}`}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
