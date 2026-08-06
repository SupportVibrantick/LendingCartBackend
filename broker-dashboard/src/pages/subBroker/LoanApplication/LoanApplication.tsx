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

export default function CoBrokerApplication(props: LoanApplicationProps) {
  return <LoanApplication portal="coBroker" {...props} />;
}
