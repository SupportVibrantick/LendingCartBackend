import {
    Info,
    AlertTriangle,
    XCircle,
    Inbox
} from "lucide-react";

type MessageBoxProps = {
    type: "info" | "error" | "warning" | "empty";
    title: string;
    description?: string;
};

export default function MessageBox({ type, title, description }: MessageBoxProps) {
    const config = {
        info: {
            icon: <Info className="w-6 h-6" />,
            box: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
        },
        error: {
            icon: <XCircle className="w-6 h-6" />,
            box: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6" />,
            box: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/30",
        },
        empty: {
            icon: <Inbox className="w-6 h-6" />,
            box: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        },
    };

    const c = config[type];

    return (
        <div className={`m-6 border rounded-lg p-5 flex gap-4 items-start ${c.box}`}>
            <div className="mt-0.5">{c.icon}</div>
            <div>
                <div className="font-semibold">{title}</div>
                {description && (
                    <div className="text-sm opacity-90 mt-1">{description}</div>
                )}
            </div>
        </div>
    );
}
