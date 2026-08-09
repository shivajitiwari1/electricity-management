import { Zap } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center space-y-6">
        {/* Branding */}
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-6 w-6 text-yellow-500 fill-yellow-400" />
          <span className="text-lg font-bold text-gray-900">Oasis Venetia Heights</span>
        </div>

        {/* Animated GIF */}
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif"
            alt="Under maintenance animation"
            width={200}
            height={200}
            className="rounded-lg"
          />
        </div>

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
