import { Navigate } from "react-router-dom";
import { CO_BROKER_TOKEN_KEY } from "../../lib/coBrokerPortal";

export default function SubBrokerProtected({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

  // NOT LOGGED IN
  if (!token) {
    return (
      <Navigate
        to="/sub-broker/login"
        replace
      />
    );
  }

  // AUTHORIZED
  return <>{children}</>;
}