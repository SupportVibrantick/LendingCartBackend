import StaffInvoicesPage from "../../../components/commissions/StaffInvoicesPage";
import {
  CO_BROKER_API_BASE,
  getCoBrokerAuthHeaders,
} from "../../../lib/coBrokerPortal";

export default function CoBrokerInvoicesPage() {
  return (
    <StaffInvoicesPage
      portal="subbroker"
      apiBase={CO_BROKER_API_BASE}
      invoicesPath="/subbroker/commissions/invoices"
      getHeaders={() => getCoBrokerAuthHeaders()}
      pageTitle="Invoices | Co-Broker Portal"
      pageDescription="View and download commission invoices for your assigned funded deals."
      previewPath="/sub-broker/loan-pipeline-preview"
      dashboardPath="/sub-broker/dashboard"
    />
  );
}
