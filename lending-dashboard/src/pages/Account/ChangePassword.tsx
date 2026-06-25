import PageMeta from "../../components/common/PageMeta";
import ChangePasswordForm from "../../components/account/ChangePasswordForm";

export default function ChangePassword() {
  return (
    <>
      <PageMeta
        title="Change Password | Lender Portal"
        description="Change your LendingCart lender portal password"
      />
      <div className="p-4 md:p-6">
        <ChangePasswordForm />
      </div>
    </>
  );
}
