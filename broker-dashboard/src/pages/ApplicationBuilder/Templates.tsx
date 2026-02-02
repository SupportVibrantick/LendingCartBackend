import React, { useEffect, useState } from "react";
import { CheckCircle, ArrowRight } from "lucide-react";
import { LuLayoutTemplate } from "react-icons/lu";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

interface Template {
    id: string;
    name: string;
    code: string;
    description: string;
    version: string;
}

/* ================= AUTH ================= */

function getAuthHeaders() {
    const token = sessionStorage.getItem("broker_token");
    return {
        Authorization: `Bearer ${token}`,
    };
}

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        console.error("RAW RESPONSE:", text);
        throw new Error("Invalid server response");
    }
}

/* ================= CARD ================= */

const TemplateCard: React.FC<Template> = ({
    name,
    code,
    description,
    version,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isUsed, setIsUsed] = useState(false);

    const handleAction = () => {
        setIsUsed(true);
        setTimeout(() => setIsUsed(false), 2000);
    };

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-2 shadow-sm transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/40"
        >
            <div className="bg-slate-50 dark:bg-slate-800 rounded-[22px] p-6 h-full flex flex-col border border-transparent group-hover:border-white dark:group-hover:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-900 transition-all duration-500">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                        Version v{version}
                    </span>

                    <span className="text-xs font-mono border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
                        Code: {code}
                    </span>
                </div>

                {/* Content */}
                <div className="flex-grow">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {name}
                    </h3>

                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-3">
                        {description}
                    </p>
                </div>

                {/* Action */}
                <div className="mt-8">
                    <button
                        onClick={handleAction}
                        className={`w-full py-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${isUsed
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-500 shadow-lg"
                            }`}
                    >
                        {isUsed ? (
                            <>
                                <CheckCircle size={18} className="animate-bounce" /> Selected
                            </>
                        ) : (
                            <>
                                Use Template{" "}
                                <ArrowRight
                                    size={16}
                                    className={`transition-transform duration-300 ${isHovered ? "translate-x-1" : ""
                                        }`}
                                />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ================= PAGE ================= */

const TemplateMarketplace: React.FC = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    /* ================= LOAD TEMPLATES ================= */

    const loadTemplates = async () => {
        try {
            setLoading(true);

            const res = await fetch(`${API_BASE}/broker/templates`, {
                headers: getAuthHeaders(),
            });

            const json = await safeJson(res);

            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Failed to load templates");
            }

            const mapped: Template[] = (json.data || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                code: t.code,
                description: t.description || "No description",
                version: t.version,
            }));

            setTemplates(mapped);
        } catch (err: any) {
            toast.error(err.message || "Failed to load templates");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 py-20 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col items-center mb-16 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
                        <LuLayoutTemplate size={16} className="text-indigo-500" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            Templates
                        </span>
                    </div>

                    <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                        Choose{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                            Template
                        </span>
                    </h1>

                    <p className="text-slate-500 dark:text-slate-400 text-md max-w-xl">
                        Select a pre-built application template to streamline your customer onboarding process.
                    </p>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="text-center text-slate-400">Loading templates...</div>
                ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-slate-900 dark:to-slate-800">

                        {/* Icon */}
                        <div className="h-20 w-20 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-6 shadow">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-10 w-10"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4"
                                />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                            No Templates Found
                        </h3>

                        {/* Subtitle */}
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md">
                            There are no application templates available for your account yet. Please contact your administrator or create a new template to get started.
                        </p>

                        {/* Hint */}
                        <div className="mt-4 text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 5l7 7-7 7M5 12h14"
                                />
                            </svg>
                            Ask admin to assign templates
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {templates.map((tpl) => (
                            <TemplateCard key={tpl.id} {...tpl} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TemplateMarketplace;
