import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import PricingLeadIn from "./components/PricingLeadIn";
import Pricing from "./components/Pricing";
import Footer from "./components/Footer";
import SectionWrapper from "./components/SectionWrapper";

import BookDemoPage from "./components/BookDemo";
import LoginPage from "./components/Login";
import SignUpPage from "./components/SignUp";
import SubscribePage from "./components/Subscribe";
import CheckoutStart from "./components/CheckoutStart";
import CheckoutResult from "./components/CheckoutResult";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

const SCROLL_HASHES = new Set([
  "#pricing",
  "#how-it-works",
  "#features",
  "#plan-comparison",
  "#loan-types",
  "#contact",
]);

function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!SCROLL_HASHES.has(location.hash)) return;
    const id = location.hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
  }, [location.hash]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;

    if (checkout === "success") {
      navigate("/checkout/success?status=success", { replace: true });
      return;
    }
    if (checkout === "cancelled") {
      navigate("/checkout/cancelled?status=cancelled", { replace: true });
      return;
    }
    if (checkout === "failed") {
      navigate("/checkout/failed?status=failed", { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-slate-50 pt-16 text-slate-900 transition-colors dark:bg-black dark:text-white">
        <PricingLeadIn />

        <SectionWrapper>
          <Pricing />
        </SectionWrapper>

        <Footer />
      </div>
    </>
  );
}

function ThemedToaster() {
  const { isDark } = useTheme();

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: isDark
          ? {
              background: "#0f1428",
              color: "#e5e7eb",
              border: "1px solid rgba(255,255,255,0.1)",
            }
          : {
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid rgba(15,23,42,0.1)",
            },
      }}
    />
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ThemedToaster />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/book-demo" element={<BookDemoPage />} />
            <Route path="/subscribe" element={<SubscribePage />} />
            <Route path="/checkout" element={<CheckoutStart />} />
            <Route path="/checkout/pending" element={<CheckoutResult />} />
            <Route path="/checkout/success" element={<CheckoutResult />} />
            <Route path="/checkout/cancelled" element={<CheckoutResult />} />
            <Route path="/checkout/failed" element={<CheckoutResult />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
