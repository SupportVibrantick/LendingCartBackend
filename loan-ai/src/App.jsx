import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import DashboardPreview from "./components/DashboardPreview";
import Benefits from "./components/Benefits";
import MultiLenderSupport from "./components/MultiLenderSupport";
import InstantBusinessIntelligence from "./components/InstantBusinessIntelligence";
import VirtualProcessor from "./components/VirtualProcessor";
import VideoPreview from "./components/VideoPreview";
import ApplicantPortal from "./components/ApplicantPortal";
import Pricing from "./components/Pricing";
import Footer from "./components/Footer";
import SectionWrapper from "./components/SectionWrapper";

function App() {
  return (
    <>
      <Navbar />

      <div className="pt-18">
        <Hero />

        <SectionWrapper>
          <div className="bg-gray-100 pb-0">
            <DashboardPreview />
          </div>
        </SectionWrapper>

        <SectionWrapper>
          <VideoPreview />
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

export default App;
