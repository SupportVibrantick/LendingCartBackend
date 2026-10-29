import PageMeta from "../../../components/common/PageMeta";
import SelfBankingPanel from "../../../components/banking/SelfBankingPanel";
import {
  CO_BROKER_API_BASE,
  checkCoBrokerResponse,
  getCoBrokerAuthHeaders,
} from "../../../lib/coBrokerPortal";

export default function CoBrokerBankingPage() {
  return (
    <>
      <PageMeta
        title="Banking | Payments | Co-Broker"
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
          portal="coBroker"
          apiBase={CO_BROKER_API_BASE}
          getAuthHeaders={() => getCoBrokerAuthHeaders("application/json")}
          checkResponse={checkCoBrokerResponse}
        />
      </div>
    </>
  );
}
