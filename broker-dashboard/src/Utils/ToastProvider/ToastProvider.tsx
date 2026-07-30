import React from "react";
import { Toaster } from "react-hot-toast";

const ToastProvider: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      containerStyle={{
        top: 80,
        zIndex: 999999,
      }}
      toastOptions={{
        duration: 3500,
        style: {
          zIndex: 999999,
        },
      }}
    />
  );
};

export default ToastProvider;
