import StaffInvoicesPage from "../../../components/commissions/StaffInvoicesPage";
import { LO_API_BASE, loAuthHeaders } from "../../../lib/loanOfficerApi";

export default function LoanOfficerInvoicesPage() {
  return (
    <StaffInvoicesPage
      portal="loanofficer"
      apiBase={LO_API_BASE}
      invoicesPath="/loanofficer/commissions/invoices"
      getHeaders={() => loAuthHeaders(false)}
      pageTitle="Invoices | Loan Officer Portal"
      pageDescription="View and download commission invoices for your funded deals."
      previewPath="/loan-officer/loan-pipeline-preview"
      dashboardPath="/loan-officer/dashboard"
    />
  );
}
