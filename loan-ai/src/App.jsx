import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import DashboardPreview from "./components/DashboardPreview";
import Benefits from "./components/Benefits";
import MultiLenderSupport from "./components/MultiLenderSupport";
import InstantBusinessIntelligence from "./components/InstantBusinessIntelligence";
import VirtualProcessor from "./components/VirtualProcessor";
import ApplicantPortal from "./components/ApplicantPortal";
import Pricing from "./components/Pricing";
import Footer from "./components/Footer";
import SectionWrapper from "./components/SectionWrapper";

import BookDemoPage from "./components/BookDemo";
import LoginPage from "./components/Login";
import SignUpPage from "./components/SignUp";
import SubscribePage from "./components/Subscribe";
import CheckoutStart from "./components/CheckoutStart";
import { AuthProvider, useAuth } from "./context/AuthContext";

function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser, isAuthenticated } = useAuth();

  useEffect(() => {
    if (location.hash === "#pricing") {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;

    if (checkout === "success") {
      toast.success(
        "Payment received. Your subscription will activate shortly — check your email for broker credentials.",
      );
      if (isAuthenticated) {
        refreshUser?.().catch(() => {});
      }
    } else if (checkout === "cancelled") {
      toast.error("Checkout was cancelled. You can choose a plan again anytime.");
    } else if (checkout === "failed") {
      toast.error(
        "Payment did not complete. If you were charged, contact support.",
      );
    }

    params.delete("checkout");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
        hash: location.hash || "#pricing",
      },
      { replace: true },
    );
  }, [
    location.search,
    location.pathname,
    location.hash,
    navigate,
    isAuthenticated,
    refreshUser,
  ]);

  return (
    <>
      <Navbar />

      <div className="pt-16">
        <Hero />

        <SectionWrapper>
          <div className="bg-gray-100 pb-0">
            <DashboardPreview />
          </div>
        </SectionWrapper>

        <SectionWrapper>
          <Benefits />
        </SectionWrapper>

        <SectionWrapper>
          <MultiLenderSupport />
        </SectionWrapper>

        <SectionWrapper>
          <InstantBusinessIntelligence />
        </SectionWrapper>

        <SectionWrapper>
          <VirtualProcessor />
        </SectionWrapper>

        <SectionWrapper>
          <ApplicantPortal />
        </SectionWrapper>

        <SectionWrapper>
          <Pricing />
        </SectionWrapper>

        <SectionWrapper>
          <Footer />
        </SectionWrapper>
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/book-demo" element={<BookDemoPage />} />
          <Route path="/subscribe" element={<SubscribePage />} />
          <Route path="/checkout" element={<CheckoutStart />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
