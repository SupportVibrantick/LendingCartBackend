import PageMeta from "../../../components/common/PageMeta";
import SelfBankingPanel from "../../../components/banking/SelfBankingPanel";
import {
  LO_API_BASE,
  checkLoanOfficerResponse,
  getLoanOfficerToken,
} from "../../../lib/loanOfficerApi";

function getAuthHeaders(): HeadersInit {
  const token = getLoanOfficerToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function LoanOfficerBankingPage() {
  return (
    <>
      <PageMeta
        title="Banking | Payments | Loan Officer"
        description="Add or update your bank account for commission ACH payouts"
      />
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Banking</h2>
          <p className="mt-1 text-sm text-slate-500">
            Keep your US bank account current so the principal broker can send
            commission ACH to you.
          </p>
        </div>
        <SelfBankingPanel
          portal="loanOfficer"
          apiBase={LO_API_BASE}
          getAuthHeaders={getAuthHeaders}
          checkResponse={checkLoanOfficerResponse}
        />
      </div>
    </>
  );
}
