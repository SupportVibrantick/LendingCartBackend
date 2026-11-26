import StaffPaymentsLayout from "../../../components/payments/StaffPaymentsLayout";

export default function CoBrokerPaymentsLayout() {
  return (
    <StaffPaymentsLayout
      basePath="/sub-broker"
      pageDescription="Manage your commission invoices, payouts, and banking details."
    />
  );
}
