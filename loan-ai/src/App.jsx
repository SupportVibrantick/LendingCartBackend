import { useEffect, useCallback } from "react";
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
  const { refreshUserAndVerifySubscription, isAuthenticated } = useAuth();

  // Background polling for subscription status (runs even if user navigates away)
  const startBackgroundSubscriptionPolling = useCallback(() => {
    if (!isAuthenticated) return;
    
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 10;
    const baseDelay = 3000; // 3s, 6s, 12s, 24s, 48s... ~2.5 min total

    const poll = async () => {
      if (cancelled || attempt >= maxAttempts) return;
      
      try {
        const updatedUser = await refreshUserAndVerifySubscription?.();
        if (updatedUser?.hasBrokerSubscription) {
          toast.success(`Payment successful! Your ${updatedUser.subscribedPackageCode || "plan"} is now active.`);
          return; // Stop polling
        }
      } catch (err) {
        console.warn("[App] Background subscription poll failed:", err);
      }
      
      attempt++;
      if (attempt < maxAttempts && !cancelled) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[App] Subscription not active yet, polling again in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
        setTimeout(poll, delay);
      } else if (!cancelled) {
        toast.error("Subscription activation is taking longer than expected. Please refresh the page or contact support.");
      }
    };

    poll();
    
    return () => { cancelled = true; };
  }, [isAuthenticated, refreshUserAndVerifySubscription]);

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
      
      const handleCheckoutSuccess = async () => {
        sessionStorage.setItem("loan_ai_checkout_handled", "true");
        
        // If not authenticated, redirect to login with return URL
        if (!isAuthenticated) {
          toast.info("Please sign in to verify your subscription.");
          navigate("/login", { 
            state: { redirectTo: "/pricing" },
            replace: true 
          });
          return;
        }

        try {
          const updatedUser = await refreshUserAndVerifySubscription?.();
          if (updatedUser?.hasBrokerSubscription) {
            toast.success(`Payment successful! Your ${updatedUser.subscribedPackageCode || "plan"} is now active.`);
            // Scroll to pricing section
            setTimeout(() => {
              document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          } else {
            // Subscription not active yet - start background polling
            toast("Subscription activation in progress. We'll notify you when ready.", { 
              icon: "⏳",
              duration: 5000 
            });
            startBackgroundSubscriptionPolling();
          }
        } catch (err) {
          console.error("Failed to refresh user after checkout:", err);
          toast.error("Could not verify subscription automatically. Please refresh the page manually.");
        }
      };

      handleCheckoutSuccess();
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
    refreshUserAndVerifySubscription,
    startBackgroundSubscriptionPolling,
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
