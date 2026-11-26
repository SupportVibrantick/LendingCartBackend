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
      <SelfBankingPanel
        portal="coBroker"
        apiBase={CO_BROKER_API_BASE}
        getAuthHeaders={() => getCoBrokerAuthHeaders("application/json")}
        checkResponse={checkCoBrokerResponse}
        title="Payout bank account"
        description="Keep your US bank account current so the principal broker can send commission ACH to you (US bank-to-bank)."
      />
    </>
  );
}
