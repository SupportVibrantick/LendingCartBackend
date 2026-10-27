import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import TeamJoinForm from "./TeamJoinForm";

export default function JoinCoBroker() {
  return (
    <>
      <PageMeta
        title="Join as Co-Broker | Loan Automation"
        description="Accept a broker invite and join as a co-broker"
      />
      <AuthLayout wide>
        <TeamJoinForm
          role="SUB_BROKER"
          loginPath="/sub-broker/login"
          title="Join as Co-Broker"
          personalPartyLabel="Co-Broker’s"
        />
      </AuthLayout>
    </>
  );
}
