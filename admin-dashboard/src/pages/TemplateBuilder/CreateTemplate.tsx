import React, { useState } from "react";
import { Sparkles, ArrowRight, LayoutTemplate, MessageSquareText, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders() {
    const token = sessionStorage.getItem("admin_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

const CreateTemplateImproved: React.FC = () => {
    const [name, setName] = useState<string>("");
    const [desc, setDesc] = useState<string>("");
    const [isSaved, setIsSaved] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const handleSave = async () => {
        if (!name.trim() || !desc.trim()) {
            toast.error("Please enter template name and description");
            return;
        }

        try {
            setLoading(true);

            const res = await fetch(`${API_BASE}/admin/applications/templates`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: name.trim(),
                    description: desc.trim(),
                }),
            });

            const json = await res.json();

            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Failed to create template");
            }

            setIsSaved(true);
            toast.success("Template created successfully!");

            setTimeout(() => setIsSaved(false), 2500);

            setName("");
            setDesc("");
        } catch (err: any) {
            toast.error(err.message || "Failed to create template");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center p-6">

            {/* Background Effects */}
            <div className="fixed top-20 left-20 w-64 h-64 bg-blue-200 dark:bg-indigo-500/20 rounded-full blur-[100px] opacity-60 animate-pulse" />
            <div className="fixed bottom-20 right-20 w-64 h-64 bg-indigo-200 dark:bg-purple-500/20 rounded-full blur-[100px] opacity-60" />

            <div className="relative w-full max-w-5xl bg-white/70 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-slate-800 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col md:flex-row">

                {/* LEFT */}
                <div className="flex-1 p-10 lg:p-16 border-r border-slate-100 dark:border-slate-800">
                    <div className="mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold mb-4">
                            <Sparkles size={12} /> CREATE TEMPLATE
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            Design your application template
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                            Create reusable application templates for brokers.
                        </p>
                    </div>

                    <div className="space-y-10">

                        {/* NAME */}
                        <div className="group">
                            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-4 block group-focus-within:text-indigo-600">
                                Template Name
                            </label>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white dark:bg-slate-800 shadow-sm rounded-lg text-slate-400 group-focus-within:text-indigo-500 border border-slate-100 dark:border-slate-700">
                                    <LayoutTemplate size={15} />
                                </div>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. SBA Standard Application"
                                    className="flex-1 bg-transparent text-md font-medium text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 border-b border-slate-200 dark:border-slate-700 focus:border-indigo-500 pb-2"
                                />
                            </div>
                        </div>

                        {/* DESCRIPTION */}
                        <div className="group">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 block group-focus-within:text-indigo-600">
                                Description
                            </label>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white dark:bg-slate-800 shadow-sm rounded-lg text-slate-400 group-focus-within:text-indigo-500 border border-slate-100 dark:border-slate-700">
                                    <MessageSquareText size={15} />
                                </div>
                                <textarea
                                    rows={3}
                                    value={desc}
                                    onChange={(e) => setDesc(e.target.value)}
                                    placeholder="Describe the purpose of this template..."
                                    className="flex-1 bg-transparent text-md text-slate-600 dark:text-slate-300 outline-none placeholder:text-slate-400 border-b border-slate-200 dark:border-slate-700 focus:border-indigo-500 pb-2 resize-none"
                                />
                            </div>
                        </div>

                        {/* BUTTON */}
                        <button
                            disabled={loading}
                            onClick={handleSave}
                            className="relative group w-full md:w-auto overflow-hidden bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-10 py-4 rounded-2xl font-bold transition-all hover:shadow-[0_20px_40px_-12px_rgba(79,70,229,0.4)] disabled:opacity-60"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {loading ? (
                                    <div className="text-sm flex justify-center items-center gap-2">
                                        <Loader2 className="animate-spin" /> Creating...
                                    </div>
                                ) : isSaved ? (
                                    <div className="text-sm flex justify-center items-center gap-2">
                                        Created <Check size={18} />
                                    </div>
                                ) : (
                                    <div className="text-sm flex justify-center items-center gap-2">
                                        Create Template <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                )}
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </div>
                </div>

                {/* RIGHT PREVIEW */}
                <div className="flex-1 bg-slate-50 dark:bg-slate-950/40 p-10 flex items-center justify-center border-t md:border-t-0">
                    <div className="relative w-full max-w-[320px]">
                        <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[3rem] blur-2xl opacity-10" />

                        <div className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow border border-slate-100 dark:border-slate-800">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 min-h-[32px]">
                                {name || "Template Title"}
                            </h3>

                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 min-h-[60px]">
                                {desc || "Template description will appear here..."}
                            </p>
                        </div>

                        {/* SUCCESS OVERLAY */}
                        {isSaved && (
                            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                    <Check size={32} strokeWidth={3} />
                                </div>
                                <span className="font-bold text-slate-800 dark:text-slate-100">Template Created!</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CreateTemplateImproved;
