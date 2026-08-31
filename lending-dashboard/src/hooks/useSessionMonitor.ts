import { useEffect } from "react";
import {
  getLenderToken,
  handleLenderUnauthorized,
  isLenderTokenExpired,
} from "../lib/lenderSession";

export function useLenderSessionMonitor() {
  useEffect(() => {
    const check = () => {
      const token = getLenderToken();
      if (!token || isLenderTokenExpired(token)) {
        handleLenderUnauthorized();
      }
    };

    check();
    const intervalId = window.setInterval(check, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);
}
