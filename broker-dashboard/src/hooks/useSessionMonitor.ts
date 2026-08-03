import { useEffect } from "react";
import {
  LO_TOKEN_KEY,
  getLoanOfficerToken,
  handleLoanOfficerUnauthorized,
  isLoanOfficerTokenExpired,
} from "../lib/loanOfficerApi";
import {
  getBrokerToken,
  handleBrokerUnauthorized,
  isBrokerTokenExpired,
} from "../lib/brokerSession";

export function useLoanOfficerSessionMonitor() {
  useEffect(() => {
    const check = () => {
      const token = sessionStorage.getItem(LO_TOKEN_KEY);
      if (!token || isLoanOfficerTokenExpired(token)) {
        handleLoanOfficerUnauthorized();
      }
    };

    check();
    const intervalId = window.setInterval(check, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);
}

export function useBrokerSessionMonitor() {
  useEffect(() => {
    const check = () => {
      const token = getBrokerToken();
      if (!token || isBrokerTokenExpired(token)) {
        handleBrokerUnauthorized();
      }
    };

    check();
    const intervalId = window.setInterval(check, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);
}

export function assertLoanOfficerSession(): boolean {
  return getLoanOfficerToken() !== null;
}

export function assertBrokerSession(): boolean {
  return getBrokerToken() !== null;
}
