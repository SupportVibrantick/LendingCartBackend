import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

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
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

function HomePage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#pricing") {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash]);

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
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
