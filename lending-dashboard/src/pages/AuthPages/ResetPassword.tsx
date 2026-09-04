import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import ForgotPasswordForm from "../../components/auth/ForgotPasswordForm";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  return (
    <>
      <PageMeta
        title="Reset Password | Lender Portal"
        description="Reset your loan automation lender portal password"
      />
      <AuthLayout>
        {token ? <ResetPasswordForm token={token} /> : <ForgotPasswordForm />}
      </AuthLayout>
    </>
  );
}
