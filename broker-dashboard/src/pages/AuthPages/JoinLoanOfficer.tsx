import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import TeamJoinForm from "./TeamJoinForm";

export default function JoinLoanOfficer() {
  return (
    <>
      <PageMeta
        title="Join as Loan Officer | Loan Automation"
        description="Accept a broker invite and join as a loan officer"
      />
      <AuthLayout wide>
        <TeamJoinForm
          role="LOAN_OFFICER"
          loginPath="/loan-officer/login"
          title="Join as Loan Officer"
          personalPartyLabel="Loan Officer’s"
        />
      </AuthLayout>
    </>
  );
}
