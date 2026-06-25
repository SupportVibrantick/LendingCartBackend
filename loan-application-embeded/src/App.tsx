import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import GetLoanPage from "./pages/GetLoanPage";

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />

      <Routes>
        <Route path="/" element={<Navigate to="/get-loan" replace />} />

        <Route
          path="/get-loan"
          element={
            <AppLayout>
              <GetLoanPage />
            </AppLayout>
          }
        />

        <Route
          path="*"
          element={
            <div className="flex h-screen items-center justify-center text-xl font-semibold">
              404 - Page Not Found
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
