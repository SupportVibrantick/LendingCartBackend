import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ClientProtected({ children }: any) {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("client_token");

    if (!token) {
      navigate("/client-upload");
    }
  }, []);

  return children;
}
