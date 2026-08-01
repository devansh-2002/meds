import { NextResponse } from "next/server";

/**
 * Health Check API
 * Used to verify the server is running and can be pinged by monitoring tools.
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    app: "DawaiSaathi",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    features: {
      whatsapp_bot: true,
      caregiver_dashboard: true,
      pharmacy_affiliate: false, // V2
      multi_language: false, // V2
    },
  });
}
