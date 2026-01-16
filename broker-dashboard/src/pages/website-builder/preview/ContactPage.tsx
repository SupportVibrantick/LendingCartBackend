import { SiteConfig } from "../../../types/siteBuilder";
import { MapPin, Phone, MessageCircle, Clock } from "lucide-react";

export default function ContactPage({ config }: { config: SiteConfig }) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Heading */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-slate-900 dark:text-white">
          Contact Us
        </h2>
        <p className="text-slate-500 mt-2 text-sm">
          We’d love to hear from you. Reach us using any of the methods below.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Phone */}
        <div className="group bg-white dark:bg-slate-800 rounded-2xl border p-6 text-center hover:shadow-lg transition overflow-hidden">
          <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-4 group-hover:scale-110 transition">
            <Phone />
          </div>
          <div className="font-semibold">Phone</div>
          <div className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            {config.contact.phone}
          </div>
        </div>

        {/* WhatsApp */}
        <div className="group bg-white dark:bg-slate-800 rounded-2xl border p-6 text-center hover:shadow-lg transition overflow-hidden">
          <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-green-50 text-green-600 mb-4 group-hover:scale-110 transition">
            <MessageCircle />
          </div>
          <div className="font-semibold">WhatsApp</div>
          <div className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            {config.contact.whatsapp}
          </div>
        </div>

        {/* Address */}
        <div className="group bg-white dark:bg-slate-800 rounded-2xl border p-6 text-center hover:shadow-lg transition overflow-hidden">
          <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-red-50 text-red-600 mb-4 group-hover:scale-110 transition">
            <MapPin />
          </div>
          <div className="font-semibold">Address</div>
          <div className="text-slate-600 dark:text-slate-400 text-sm mt-1 whitespace-pre-line break-words overflow-hidden">
            {config.contact.address}
          </div>
        </div>

        {/* Working Hours */}
        <div className="group bg-white dark:bg-slate-800 rounded-2xl border p-6 text-center hover:shadow-lg transition overflow-hidden">
          <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4 group-hover:scale-110 transition">
            <Clock />
          </div>
          <div className="font-semibold">Working Hours</div>
          <div className="text-slate-600 dark:text-slate-400 text-sm mt-1 break-words overflow-hidden">
            {config.contact.workingHours}
          </div>
        </div>
      </div>
    </div>
  );
}
