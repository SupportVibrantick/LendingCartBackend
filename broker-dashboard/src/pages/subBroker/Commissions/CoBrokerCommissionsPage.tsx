import StaffCommissionsPage from "../../../components/commissions/StaffCommissionsPage";
import {
  CO_BROKER_API_BASE,
  getCoBrokerAuthHeaders,
} from "../../../lib/coBrokerPortal";

export default function CoBrokerCommissionsPage() {
  return (
    <StaffCommissionsPage
      portal="subbroker"
      apiBase={CO_BROKER_API_BASE}
      summaryPath="/subbroker/commissions/summary"
      listPath="/subbroker/commissions"
      getHeaders={() => getCoBrokerAuthHeaders()}
    />
  );
}
