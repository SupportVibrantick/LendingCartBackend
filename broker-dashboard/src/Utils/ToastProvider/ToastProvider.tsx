import React from "react";
import { Toaster } from "react-hot-toast";

const ToastProvider: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{ duration: 3500 }}
      containerStyle={{
        top: 80,
        zIndex: 999999,
      }}
    />
  );
};

export default ToastProvider;
