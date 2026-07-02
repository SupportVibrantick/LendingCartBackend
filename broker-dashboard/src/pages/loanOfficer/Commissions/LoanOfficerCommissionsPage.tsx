import StaffCommissionsPage from "../../../components/commissions/StaffCommissionsPage";
import { LO_API_BASE, loAuthHeaders } from "../../../lib/loanOfficerApi";

export default function LoanOfficerCommissionsPage() {
  return (
    <StaffCommissionsPage
      portal="loanofficer"
      apiBase={LO_API_BASE}
      summaryPath="/loanofficer/commissions/summary"
      listPath="/loanofficer/commissions"
      getHeaders={() => loAuthHeaders(false)}
      pageTitle="Commissions"
      pageDescription="Track your earned commissions, generate invoices, and monitor payout status."
      invoicesHref="/loan-officer/invoices"
      dashboardHref="/loan-officer/dashboard"
    />
  );
}
