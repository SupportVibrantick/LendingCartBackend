const { isClientUser, isLenderUser, hasRole } = require("./messagingAccess");

function resolveViewerRole(req) {
  if (isClientUser(req)) return "CLIENT";
  if (isLenderUser(req)) return "LENDER";
  if (hasRole(req.user, "SUB_BROKER")) return "SUB_BROKER";
  if (hasRole(req.user, "BROKER_OFFICER")) return "LOAN_OFFICER";
  return "BROKER";
}

function isPlaceholderConversationId(id) {
  return (
    typeof id === "string" &&
    (id.startsWith("broker-") || id.startsWith("officer-"))
  );
}

function stripKnownPrefix(title, pattern) {
  if (!title) return null;
  const match = title.match(pattern);
  return match?.[1]?.trim() || null;
}

function enrichConversationItem(item, viewerRole) {
  const isPlaceholder = isPlaceholderConversationId(item.id);
  const base = {
    ...item,
    isPlaceholder,
    unread: item.unread ?? false,
    unreadCount: item.unreadCount ?? 0,
  };

  switch (item.type) {
    case "CLIENT_BROKER":
    case "CLIENT_OFFICER": {
      const clientName =
        item.clientName ||
        stripKnownPrefix(item.title, /^Client\s[•-]\s*(.+)$/i) ||
        "Client";

      if (viewerRole === "CLIENT") {
        const contactName =
          item.brokerName ||
          item.participant?.name ||
          stripKnownPrefix(item.title, /^Loan Officer\s•\s*(.+)$/i) ||
          stripKnownPrefix(item.title, /^Client\s[•-]\s*(.+)$/i) ||
          "Broker";

        return {
          ...base,
          displayName: contactName,
          badgeLabel:
            item.type === "CLIENT_OFFICER" ? "Loan Officer" : "Principal Broker",
          badgeTone: item.type === "CLIENT_OFFICER" ? "violet" : "amber",
        };
      }

      if (viewerRole === "LOAN_OFFICER" && item.type === "CLIENT_OFFICER") {
        return {
          ...base,
          displayName: clientName,
          badgeLabel: "Client",
          badgeTone: "violet",
          clientName,
        };
      }

      return {
        ...base,
        displayName: clientName,
        badgeLabel:
          viewerRole === "LOAN_OFFICER" && item.type === "CLIENT_BROKER"
            ? "Client (Broker)"
            : "Client",
        badgeTone: "emerald",
        clientName,
      };
    }

    case "BROKER_LENDER": {
      const lenderName =
        item.lenderName ||
        stripKnownPrefix(item.title, /^Lender\s-\s*(.+)$/i) ||
        "Lender";
      const brokerName =
        item.brokerName ||
        item.brokerLabel ||
        item.participant?.name ||
        "Broker";

      if (viewerRole === "LENDER") {
        return {
          ...base,
          displayName: brokerName,
          badgeLabel: "Broker",
          badgeTone: "amber",
          brokerName,
        };
      }

      return {
        ...base,
        displayName: lenderName,
        badgeLabel: "Lender",
        badgeTone: "indigo",
        lenderName,
      };
    }

    case "SUBBROKER_BROKER": {
      const contactName =
        item.participant?.name ||
        stripKnownPrefix(item.title, /^Sub Broker\s•\s*(.+?)(\s\(.+\))?$/i) ||
        stripKnownPrefix(item.title, /^Principal Broker\s•\s*(.+)$/i) ||
        stripKnownPrefix(item.title, /^Loan Officer\s•\s*(.+)$/i) ||
        "Contact";

      const isLoanOfficerChannel = item.chatCategory === "LOAN_OFFICER";

      if (viewerRole === "SUB_BROKER") {
        return {
          ...base,
          displayName: contactName,
          badgeLabel: isLoanOfficerChannel ? "Loan Officer" : "Principal Broker",
          badgeTone: isLoanOfficerChannel ? "violet" : "amber",
        };
      }

      return {
        ...base,
        displayName: contactName,
        badgeLabel: isLoanOfficerChannel ? "Loan Officer Channel" : "Sub Broker",
        badgeTone: isLoanOfficerChannel ? "violet" : "sky",
      };
    }

    case "BROKER_OFFICER": {
      const contactName =
        viewerRole === "LOAN_OFFICER"
          ? item.participant?.name ||
            stripKnownPrefix(item.title, /^Principal Broker\s•\s*(.+)$/i) ||
            item.brokerName ||
            "Principal Broker"
          : item.participant?.name ||
            stripKnownPrefix(item.title, /^Loan Officer\s•\s*(.+)$/i) ||
            stripKnownPrefix(item.title, /^Principal Broker\s•\s*(.+)$/i) ||
            "Contact";

      if (viewerRole === "LOAN_OFFICER") {
        return {
          ...base,
          displayName: contactName,
          badgeLabel: "Principal Broker",
          badgeTone: "amber",
        };
      }

      return {
        ...base,
        displayName: contactName,
        badgeLabel: "Loan Officer",
        badgeTone: "violet",
      };
    }

    default:
      return {
        ...base,
        displayName: item.title || "Conversation",
        badgeLabel: "Chat",
        badgeTone: "slate",
      };
  }
}

function enrichConversationList(conversations, viewerRole) {
  return conversations.map((item) => enrichConversationItem(item, viewerRole));
}

module.exports = {
  resolveViewerRole,
  isPlaceholderConversationId,
  enrichConversationItem,
  enrichConversationList,
};
