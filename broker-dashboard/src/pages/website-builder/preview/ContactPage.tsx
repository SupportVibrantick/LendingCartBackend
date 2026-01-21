import { useState } from "react";
import { SiteConfig } from "../../../types/siteBuilder";
import {
  MapPin,
  Phone,
  Mail,
  User,
  MessageSquare,
  Play,
  Clock,
  ChevronDown,
  Landmark,
  MessageCircle,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";

export default function ContactPage({ config }: { config: SiteConfig }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    loanType: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const update = (k: string, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.message) {
      alert("Please fill required fields");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess("Thank you! We will contact you shortly.");
      setForm({
        name: "",
        email: "",
        phone: "",
        loanType: "",
        message: "",
      });
    }, 1000);
  };

  const { contact } = config;

  return (
    <div className="bg-[#f7f3ed] dark:bg-slate-950 min-h-screen py-20 px-6 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* ================= HEADER ================= */}
        <div className="mb-16">
          <h1 className="text-2xl md:text-5xl font-serif text-[#193B3A] dark:text-slate-100 mb-12">
            Let's Get In Touch
          </h1>

          {/* INFO GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 border-b border-gray-300 dark:border-slate-700 pb-16">

            <Info icon={<Phone size={18} />} title="Phone" lines={[contact.phone]} />
            <Info
              icon={<MessageCircle size={18} />}
              title="WhatsApp"
              lines={[contact.whatsapp]}
              action={
                <a
                  href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  className="text-green-700 dark:text-green-400 text-sm underline"
                >
                  Chat on WhatsApp →
                </a>
              }
            />
            <Info icon={<Mail size={18} />} title="Email" lines={[contact.email]} />
            <Info icon={<MapPin size={18} />} title="Office" lines={[contact.address]} />
            <Info icon={<Clock size={18} />} title="Working Hours" lines={[contact.workingHours]} />

          </div>

          {/* SOCIAL */}
          <div className="flex items-center gap-4 mt-8">
            <span className="text-sm text-[#11302b] dark:text-slate-300 font-medium">
              Follow us:
            </span>

            {contact.social?.facebook && <Social href={contact.social.facebook} icon={<Facebook size={18} />} />}
            {contact.social?.instagram && <Social href={contact.social.instagram} icon={<Instagram size={18} />} />}
            {contact.social?.linkedin && <Social href={contact.social.linkedin} icon={<Linkedin size={18} />} />}
            {contact.social?.twitter && <Social href={contact.social.twitter} icon={<Twitter size={18} />} />}
          </div>
        </div>

        {/* ================= FORM ================= */}
        <div className="mt-16 max-w-4xl">
          <h2 className="text-3xl font-serif text-[#11302b] dark:text-slate-100 mb-10">
            Or fill out the form below
          </h2>

          {success && (
            <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-sm">
              {success}
            </div>
          )}

          <form
            onSubmit={submit}
            className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10"
          >

            <Input label="Full Name" placeholder="Enter your full name" icon={<User size={18} />} value={form.name} onChange={(v: string) => update("name", v)} />
            <Input label="Email Address" placeholder="Enter your email address" icon={<Mail size={18} />} value={form.email} onChange={(v: string) => update("email", v)} />
            <Input label="Phone Number" placeholder="Enter your phone number" icon={<Phone size={18} />} value={form.phone} onChange={(v: string) => update("phone", v)} />
            <Select label="Loan Type" value={form.loanType} onChange={(v: string) => update("loanType", v)} />
            <Textarea label="Message" placeholder="How can we help you?" value={form.message} onChange={(v: string) => update("message", v)} />

            <div className="md:col-span-2 flex justify-end">
              <button
                disabled={loading}
                className="text-sm bg-[#11302b] dark:bg-emerald-700 text-white px-10 py-2 rounded-md flex items-center gap-4 hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Sending..." : "Submit Form"}
                <Play size={12} className="fill-orange-400 text-orange-400" />
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

/* ================== UI PARTS ================== */

function Info({ icon, title, lines, action }: any) {
  return (
    <div className="space-y-4">
      <div className="w-10 h-10 border border-gray-400 dark:border-slate-600 rounded-lg flex items-center justify-center text-gray-600 dark:text-slate-300">
        {icon}
      </div>
      <div className="text-gray-700 dark:text-slate-300 text-sm space-y-1">
        <p className="font-medium text-[#11302b] dark:text-slate-100 text-[16px]">
          {title}
        </p>
        {lines.map((l: string, i: number) => (
          <p key={i} className="text-[14px] whitespace-pre-line">
            {l}
          </p>
        ))}
        {action}
      </div>
    </div>
  );
}

function Social({ href, icon }: any) {
  return (
    <a
      href={href}
      target="_blank"
      className="w-10 h-10 border border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
    >
      {icon}
    </a>
  );
}

/* Inputs */

function Input({ label, placeholder, icon, value, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[#11302b] dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 py-2.5 pl-12 rounded-lg text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#11302b] dark:focus:ring-emerald-600 shadow-sm"
        />
      </div>
    </div>
  );
}

function Textarea({ label, placeholder, value, onChange }: any) {
  return (
    <div className="md:col-span-2 space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[#11302b] dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-6 text-gray-400">
          <MessageSquare size={18} />
        </div>
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 py-5 pl-12 rounded-lg text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#11302b] dark:focus:ring-emerald-600 shadow-sm"
        />
      </div>
    </div>
  );
}

function Select({ label, value, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[#11302b] dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <Landmark size={18} />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm w-full bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 py-2.5 pl-12 pr-10 rounded-lg text-gray-700 dark:text-slate-200 focus:ring-2 focus:ring-[#11302b] dark:focus:ring-emerald-600 shadow-sm appearance-none"
        >
          <option value="">Select Loan Type</option>
          <option value="personal">Personal Loan</option>
          <option value="business">Business Loan</option>
          <option value="home">Home Loan</option>
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <ChevronDown size={16} />
        </div>
      </div>
    </div>
  );
}
