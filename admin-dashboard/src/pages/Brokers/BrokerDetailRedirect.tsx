import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BROKER_DETAIL_PATH,
  setActiveBrokerId,
} from "../../lib/brokerDetailNavigation";

export default function BrokerDetailRedirect() {
  const { brokerId } = useParams<{ brokerId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (brokerId) {
      setActiveBrokerId(brokerId);
      navigate(BROKER_DETAIL_PATH, { replace: true });
      return;
    }
    navigate("/all-brokers-database", { replace: true });
  }, [brokerId, navigate]);

  return null;
}
