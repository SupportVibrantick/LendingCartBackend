import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import ForgotPasswordForm from "../../components/auth/ForgotPasswordForm";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";

type Portal = "broker" | "sub-broker" | "loan-officer";

function parsePortal(value: string | null): Portal {
  if (value === "sub-broker" || value === "loan-officer") return value;
  return "broker";
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const portal = parsePortal(searchParams.get("portal"));

  const pageTitle =
    portal === "loan-officer"
      ? "Reset Password | Loan Officer Portal"
      : portal === "sub-broker"
        ? "Reset Password | Co-Broker Portal"
        : "Reset Password | Broker Portal";

  return (
    <>
      <PageMeta title={pageTitle} description="" />
      <AuthLayout portal={portal}>
        {token ? (
          <ResetPasswordForm token={token} portal={portal} />
        ) : (
          <ForgotPasswordForm portal={portal} />
        )}
      </AuthLayout>
    </>
  );
}
