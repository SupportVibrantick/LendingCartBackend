import { SiteConfig } from "../../../types/siteBuilder";

export default function ContactCTA({ config }: { config: SiteConfig }) {
  return (
    <div className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center">
      <h2 className="text-2xl font-bold">Contact Us Today</h2>
      <p className="mt-2 text-md">Call Now: {config.contact.phone}</p>

      <button className="text-sm mt-6 bg-white text-black px-6 py-3 rounded-xl font-semibold">
        Get in Touch 
      </button>
    </div>
  );
}
