import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import AddUser from "./pages/ManageUser/AddUser";
import AllUsers from "./pages/ManageUser/AllUser";
import ToastProvider from "./Utils/ToastProvider/ToastProvider";
import BrokersPage from "./pages/Brokers/AllBrokers";
import RequireAuth from "./components/auth/RequireAuth";
import ConnectedLenders from "./pages/Lenders/ConnectedLenders";
import LenderInvites from "./pages/Lenders/LenderInvites";
import LenderProducts from "./pages/Lenders/LenderProducts";
import BrokersLenders from "./pages/Brokers/BrokersLenders";
import AdminLogs from "./pages/AdminLogs/AdminLogs";
import AllLoanProducts from "./pages/LoanProducts/AllLoanProducts";
import AllDocuments from "./pages/Documents/AllDocuments";
import AllSuperadmin from "./pages/SuperAdmin/AllSuperAdmin";
import LenderProductAssign from "./pages/LoanProducts/LenderAssignProduct";
import AssignedProducts from "./pages/LoanProducts/AssignedProducts";
import ConfigWebsite from "./pages/website-builder/ConfigWebsite";
import CreateApplication from "./pages/ApplicationBuilder/CreateApplication";
import Application from "./pages/ApplicationBuilder/Application";
import LoanApplicationConfig from "./pages/ApplicationBuilder/LoanApplicationConfig";
import ActiveApplication from "./pages/ActiveApplication/ActiveApp";
import FindLenders from "./pages/LenderInteraction/FindLenders";
import InvitedLenders from "./pages/LenderInteraction/InvitedLenders";
import MyLenders from "./pages/LenderInteraction/MyLenders";
import Templates from "./pages/ApplicationBuilder/Templates";
import AddSection from "./pages/ApplicationBuilder/AddSection";
import SubmitApplications from "./pages/submitedApplications/SubmitApplication";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <ToastProvider />
        <Routes>
          {/* Dashboard Layout - protected */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index path="/" element={<Home />} />

            <Route index path="/add-user" element={<AddUser />} />
            <Route index path="/all-user" element={<AllUsers />} />

            <Route
              index
              path="/all-brokers-organisation"
              element={<BrokersPage />}
            />
            <Route
              index
              path="/all-brokers-lenders"
              element={<BrokersLenders />}
            />

            <Route
              index
              path="/all-connected-lenders"
              element={<ConnectedLenders />}
            />
            <Route
              index
              path="/all-lender-invites"
              element={<LenderInvites />}
            />
            <Route
              index
              path="/all-lender-products"
              element={<LenderProducts />}
            />

            <Route
              index
              path="/all-loan-products"
              element={<AllLoanProducts />}
            />
            <Route
              index
              path="/lender-assigned-products"
              element={<LenderProductAssign />}
            />
            <Route
              index
              path="/assigned-products"
              element={<AssignedProducts />}
            />

            <Route
              index
              path="/create-application"
              element={<CreateApplication />}
            />

            <Route
              index
              path="/application"
              element={<Application />}
            />

            <Route
              index
              path="/application-config"
              element={<LoanApplicationConfig />}
            />

            <Route
              index
              path="/active-application"
              element={<ActiveApplication />}
            />

            <Route
              index
              path="/add-section"
              element={<AddSection />}
            />

            <Route
              index
              path="/templates"
              element={<Templates />}
            />

            <Route
              index
              path="/submit-applications"
              element={<SubmitApplications />}
            />

            <Route
              index
              path="/find-lenders"
              element={<FindLenders />}
            />

            <Route
              index
              path="/my-lenders"
              element={<MyLenders />}
            />

            <Route
              index
              path="/invited-lenders"
              element={<InvitedLenders />}
            />

            <Route index path="/all-super-admins" element={<AllSuperadmin />} />

            <Route index path="/all-documents" element={<AllDocuments />} />

            <Route index path="/admin-logs" element={<AdminLogs />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />

            {/* Forms */}
            <Route path="/form-elements" element={<FormElements />} />

            {/* Tables */}
            <Route path="/basic-tables" element={<BasicTables />} />

            {/* Ui Elements */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />

            {/* Charts */}
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />

            {/* Config Website */}
            <Route
              index
              path="/broker-website-dashboard/config-website"
              element={<ConfigWebsite />}
            />

          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
