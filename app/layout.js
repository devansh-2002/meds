import "./globals.css";

export const metadata = {
  title: "DawaiSaathi — Your Medicine Companion",
  description:
    "Never miss a dose again. DawaiSaathi reminds you to take your medicines on time via WhatsApp and lets your family stay informed with a real-time adherence dashboard.",
  keywords: [
    "medicine reminder",
    "dawai saathi",
    "medication tracker India",
    "pill reminder WhatsApp",
    "caregiver dashboard",
    "diabetes medication",
    "health app India",
  ],
  openGraph: {
    title: "DawaiSaathi — Your Medicine Companion",
    description:
      "WhatsApp-based medicine reminders + family caregiver dashboard. Built for India.",
    type: "website",
    locale: "en_IN",
  },
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#0D9488",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
