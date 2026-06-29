import LoanApplication, {
  type LoanApplicationProps,
} from "../../LoanApplication/LoanApplication";

export type {
  Borrower,
  CoBorrower,
  FormDataType,
  LoanCategory,
  LoanApplicationMode,
  LoanApplicationPortal,
  LoanApplicationProps,
} from "../../LoanApplication/LoanApplication";

export default function LoanOfficerApplication(props: LoanApplicationProps) {
  return <LoanApplication portal="loanOfficer" {...props} />;
}
