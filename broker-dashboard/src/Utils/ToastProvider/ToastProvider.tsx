import React from "react";
import { Toaster } from "react-hot-toast";

const ToastProvider: React.FC = () => {
  return (
    <Toaster
      position="top-center"
      toastOptions={{ duration: 2000 }}
      containerStyle={{
        top: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999999,
      }}
    />
  );
};

export default ToastProvider;
