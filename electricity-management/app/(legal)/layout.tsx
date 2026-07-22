import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 text-lg">Oasis Venetia Heights</p>
            <p className="text-xs text-gray-500">Electricity Management Portal</p>
          </div>
          <nav className="flex gap-6 text-sm">
            <Link href="/about" className="text-gray-600 hover:text-gray-900 transition-colors">
              About Us
            </Link>
            <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">
              Terms &amp; Conditions
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-10">
          {children}
        </div>
      </main>

      <footer className="bg-gray-50 border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-900 mb-1">© 2025 Oasis Group of Companies</p>
              <p>All rights reserved.</p>
            </div>
            <div className="text-center">
              <p>A-77, Sector 2, Noida</p>
              <p>+91-8010-111-777</p>
              <p>
                <a href="mailto:info@oasis.in" className="hover:underline">
                  info@oasis.in
                </a>
              </p>
            </div>
            <div className="md:text-right space-y-1">
              <p>
                <Link href="/login" className="hover:underline">
                  Resident Portal
                </Link>
              </p>
              <p>
                <a
                  href="https://www.oasis.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Oasis Group Website
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
