import { NextResponse } from "next/server";
import { getCachedSiteConfig } from "@/lib/server-cache";

export async function GET() {
  const config = await getCachedSiteConfig();
  return NextResponse.json({ maintenanceMode: config.maintenanceMode });
}
