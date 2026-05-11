import { Navigate } from "react-router-dom";

export default function SubBrokerProtected({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = sessionStorage.getItem("sub_broker_token");

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