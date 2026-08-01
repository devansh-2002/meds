# DawaiSaathi: Project Context & Progress Report

**Project Overview:**
DawaiSaathi is a comprehensive medication adherence platform designed primarily for Indian users, supporting both English and Hindi. The system operates through two main interfaces:
1. **Chatbot Interface (WhatsApp/Telegram)**: Where the patient receives timely reminders, logs doses as taken/skipped/snoozed, and configures their medication schedules via a conversational flow.
2. **Web Dashboard**: A Next.js-based application intended for caregivers to monitor adherence in real-time, generate reports, and remotely manage the patient's medication schedule and settings.

---

## 🏗 System Architecture & Technology Stack

- **Framework**: Next.js (App Router).
- **Styling**: Custom CSS Modules (`dashboard.css`, `page.module.css`) backed by global design tokens (`globals.css`).
- **Database**: Currently using a flat-file JSON database (`data.json` and `settings.json`) with atomic write capabilities (rename-based) to handle concurrent reads/writes without corruption.
- **Bot Engine**: A shared platform-agnostic conversational engine (`app/lib/bot-engine.js`) that handles state machines for user sessions, i18n localization, and logic for both WhatsApp and Telegram webhooks.
- **Sync Mechanism**: Real-time bi-directional sync achieved via aggressive API polling (every 3 seconds) from the dashboard frontend to the Next.js API routes (`/api/dashboard/data`), ensuring cross-platform consistency.
- **Background Tasks**: A standalone `cron.mjs` script manages the actual dispatching of scheduled reminders.

---

## 🚀 Key Features Implemented (Chronological Progress)

### 1. Bidirectional Data Synchronization (CRUD API)
- Upgraded the backend from a read-only data fetcher to a full CRUD system.
- Built `PATCH` (update doses) and `DELETE` (remove doses by ID or name) endpoints in `/api/dashboard/data/route.js`.
- Implemented "clean name" matching logic to support bulk updates/deletions. Deleting a medication from the dashboard now atomically deletes all scheduled instances (e.g., morning and night doses) simultaneously from `data.json`.

### 2. Dashboard UX & Frontend Overhaul
- **Polled Sync**: Implemented a 3-second data polling loop in `app/dashboard/page.js` to ensure changes made in WhatsApp immediately reflect on the web UI.
- **Medical-Grade Feedback**: Replaced standard browser `window.confirm` dialogs with a custom-styled, accessible confirmation modal.
- **Toast Notifications**: Built a custom Toast Notification system to provide non-blocking success/error feedback when saving or deleting schedules.
- **Loading States**: Integrated global loading spinners and error boundaries to prevent rendering empty structures during initial fetch.

### 3. Settings Page Integration
- Developed a fully functional Settings interface (`/app/dashboard/settings/page.js`) for caregivers/patients.
- Added controls for **Profile Name**, **Dashboard Language (en/hi)**, and **Reminder Timing Offset** (allowing users to get pinged 5-15 minutes before the actual dose time).
- Backed by a new API route `/api/dashboard/settings/route.js`.
- Fixed Next.js Server Component metadata issues in the layout by correctly isolating the layout sidebar into a dedicated Client Component (`Sidebar.js`).

### 4. Bot Engine Hardening (`bot-engine.js`)
- **Session Auto-Expiry**: Implemented a 10-minute timeout for conversational states to prevent users from getting stuck in multi-step flows like "Add Medicine".
- **Deduplicated Array Logic**: The `Remove N` command was refactored. The bot groups identical medicines into a unique list, and deleting an item correctly filters and removes all underlying doses via `cleanName` matching rather than blindly splicing array indices.
- **Strict Time Validation**: Enhanced Regular Expressions to reject conflicting input strings (e.g., "1am, 3pm") to enforce atomic scheduling per dose.
- **Dynamic Adherence Tracking**: The 'Streak' feature was upgraded from mock data to calculate live adherence percentages based on actual `status === 'taken'` histories.
- **Menu Explanations**: Added brief, clear descriptions of what each button does inside the main menu payload to help onboard new users.

### 5. Landing Page Aesthetics & Polish
- Addressed severe rendering issues caused by missing design tokens.
- Populated `globals.css` with a comprehensive medical design system: variables for typography (`--text-sm`, `--font-display`), spacing, extended health palettes (`--color-primary-darkest`), and custom keyframe animations (`fadeInUp`, `pulse-soft`).
- Updated the primary hero CTAs in `page.js` to feature both **WhatsApp** and **Telegram** buttons, complete with custom SVG icons.
- Purged local `data.json` of all stale, garbage testing inputs to ensure a clean default state for demo presentations.

---

## 📂 Key File Map
- **`app/page.js`**: Public landing page featuring the hero section and Telegram/WhatsApp CTAs.
- **`app/globals.css`**: Master stylesheet holding all CSS variables/tokens and utility animation classes.
- **`app/dashboard/page.js`**: Main caregiver dashboard view (reads meds, handles modals, toasts, polling).
- **`app/dashboard/Sidebar.js`**: Client component managing dashboard navigation and active route highlighting.
- **`app/dashboard/settings/page.js`**: Settings view for profile, language, and reminder offsets.
- **`app/api/dashboard/data/route.js`**: Core CRUD API reading/writing to `data.json`.
- **`app/lib/bot-engine.js`**: The conversational brain processing incoming texts, managing session state machines, and generating localized chat replies.
- **`data.json`**: Flat-file DB holding all user medication schedules and chat state tracking.

---

## 🔮 Next Steps & Considerations for Future Models
1. **Database Migration**: The platform currently uses `data.json` for rapid iteration. When moving to production, migrate the atomic file logic to a proper relational DB (e.g., Supabase/PostgreSQL) and update the `/api/` endpoints accordingly.
2. **Authentication**: The dashboard currently lacks strict login auth (relies on local state/demo mode). Integration of NextAuth or Clerk is required for production.
3. **Cron Reliability**: Local development relies on `cron.mjs`. In a serverless deployment (like Vercel), this will need to be replaced with a reliable external cron trigger (e.g., Vercel Cron Jobs, Upstash QStash, or AWS EventBridge) pinging a specific API route to check for and send pending reminders.
