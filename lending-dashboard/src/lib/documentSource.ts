type LenderDocumentSource = {
  source?: string | null;
  sourceLabel?: string | null;
};

function formatLenderSelfSourceLabel(sourceLabel?: string | null) {
  const rawLabel = sourceLabel?.trim() || "Lender";
  const lenderName = rawLabel.startsWith("Me ·")
    ? rawLabel.slice(4).trim()
    : rawLabel;

  return `Me · ${lenderName}`;
}

export function getLenderDocumentSourceDisplay(doc: LenderDocumentSource) {
  if (doc.source === "LENDER_ADDED") {
    return {
      label: formatLenderSelfSourceLabel(doc.sourceLabel),
      className: getSourceClassName(doc.source),
    };
  }

  if (doc.sourceLabel?.trim()) {
    return {
      label: doc.sourceLabel.trim(),
      className: getSourceClassName(doc.source),
    };
  }

  if (doc.source === "BROKER_ADDED") {
    return {
      label: "Broker",
      className: getSourceClassName(doc.source),
    };
  }

  if (doc.source === "SUB_BROKER_ADDED") {
    return {
      label: "Sub Broker",
      className: getSourceClassName(doc.source),
    };
  }

  return {
    label: doc.source || "-",
    className: getSourceClassName(doc.source),
  };
}

function getSourceClassName(source?: string | null) {
  if (source === "BROKER_ADDED") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
  }

  if (source === "SUB_BROKER_ADDED") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  }

  if (source === "LENDER_ADDED") {
    return "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400";
  }

  return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
}
