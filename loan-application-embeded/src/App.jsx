import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import GetLoanPage from "./pages/GetLoanPage";

/* Optional: Simple layout wrapper */
function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Toast global */}
      <Toaster position="top-right" />

      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/get-loan" replace />} />

        {/* Public Loan Form */}
        <Route
          path="/get-loan"
          element={
            <AppLayout>
              <GetLoanPage />
            </AppLayout>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="h-screen flex items-center justify-center text-xl font-semibold">
              404 - Page Not Found
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
