import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { MaintenanceAnimation } from "@/components/maintenance-animation";
import { getCachedSiteConfig } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const config = await getCachedSiteConfig();
  if (!config.maintenanceMode) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center space-y-6">
        {/* Branding */}
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-6 w-6 text-yellow-500 fill-yellow-400" />
          <span className="text-lg font-bold text-gray-900">Oasis Venetia Heights</span>
        </div>

        {/* AI animation */}
        <MaintenanceAnimation />

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Under Maintenance</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            We&apos;re making improvements to Oasis Venetia Heights.
            Please check back soon.
          </p>
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-400 border-t pt-4">
          For urgent queries, contact the society office.
        </p>
      </div>
    </div>
  );
}
