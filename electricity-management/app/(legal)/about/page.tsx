import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About Us – Oasis Venetia Heights",
  description: "About Oasis Venetia Heights and the electricity management portal",
};

export default function AboutPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          About Oasis Venetia Heights
        </h1>
        <p className="text-lg text-gray-600">
          A residential community in Greater Noida, managed by Oasis Group of Companies
        </p>
      </div>

      {/* Legal entity callout */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-blue-900 mb-2">Legal Entity</h2>
        <p className="text-blue-800 font-medium">Oasis Buildmart India Pvt. Ltd.</p>
        <p className="text-blue-700 text-sm mt-1">Plot No. HRA-12-A, Site-C, Greater Noida – 201306, Uttar Pradesh, India</p>
        <p className="text-blue-700 text-sm">CIN: Available on request · Email: info@oasis.in</p>
      </section>

      {/* About the Project */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">About the Project</h2>
        <p className="text-gray-700 leading-relaxed">
          Oasis Venetia Heights offers 1, 2 &amp; 3 BHK ready-to-move homes in the heart of
          Greater Noida, with 350+ families currently residing. The project is registered under
          the Real Estate (Regulation and Development) Act, 2016.
        </p>
        <p className="text-sm text-gray-500 mt-2">RERA Registration: UPRERAPRJ1646</p>
      </section>

      {/* About This Portal */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">About This Portal</h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          The Oasis Venetia Heights Electricity Management Portal enables residents to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700">
          <li>View their monthly electricity bills</li>
          <li>Make secure online payments via Razorpay</li>
          <li>Track payment history</li>
        </ul>
        <p className="text-gray-700 mt-3">
          This portal is operated by Oasis Group of Companies on behalf of Oasis Venetia Heights
          residents.
        </p>
      </section>

      {/* About Oasis Group */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">About Oasis Group</h2>
        <p className="text-gray-700 leading-relaxed">
          Oasis Group of Companies —{" "}
          <em>Spaces for Life</em> — is a real estate developer with over 25 years of experience.
          We have delivered more than 2.2 million sq ft of residential spaces across projects
          including Oasis Venetia Heights, Oasis Homes, and Oasis Grandstand.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Information</h2>
        <div className="space-y-1 text-gray-700">
          <p className="font-medium">Oasis Buildmart India Pvt. Ltd.</p>
          <p>(Trading as Oasis Group of Companies)</p>
          <p>Plot No. HRA-12-A, Site-C, Greater Noida – 201306</p>
          <p>A-77, Sector 2, Noida</p>
          <p>+91-8010-111-777</p>
          <p>
            <a href="mailto:info@oasis.in" className="text-blue-600 hover:underline">
              info@oasis.in
            </a>
          </p>
          <p>
            <a
              href="https://www.oasis.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              www.oasis.in
            </a>
          </p>
        </div>
      </section>

      {/* Payment Partner */}
      <section className="bg-gray-50 rounded-lg p-4 border">
        <p className="text-gray-700 text-sm">
          Online payments on this portal are processed securely by{" "}
          <strong>Razorpay Payment Gateway</strong>.
        </p>
      </section>
    </div>
  );
}
