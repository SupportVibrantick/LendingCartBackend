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
// import BrokersPage from "./pages/Eligibility Engine/AllBrokers";
import AllRuleSets from "./pages/Eligibility Engine/AllRuleSets";
import AllRules from "./pages/Eligibility Engine/AllRules";
import RequireAuth from "./components/auth/RequireAuth";
// import AllLendersPage from "./pages/Lenders/AllLenders";
import BrokersLenders from "./pages/Eligibility Engine/CreateRule";
import AdminLogs from "./pages/AdminLogs/AdminLogs";
import AllLoanProducts from "./pages/LoanProducts/AllLoanProducts";
import AllDocuments from "./pages/Documents/AllDocuments";
import AllSuperadmin from "./pages/SuperAdmin/AllSuperAdmin";
import LenderProductAssign from "./pages/LoanProducts/LenderAssignProduct";
import AssignedProducts from "./pages/LoanProducts/AssignedProducts";
import MyBroker from "./pages/Brokers/MyBroker";
import FindBroker from "./pages/Brokers/FindBroker";
import BrokerRequest from "./pages/Brokers/BrokerInvites";
import LoanPipeline from "./pages/LoanPipeline/LoanPipeline";
import ImpersonateLogin from "./pages/ImpersonateLogin";
import LoiPreview from "./pages/LoanPipeline/LoiPreview";
import ClientUpload from "./pages/ClientPortal/ClientUpload";
import LoanPreview from "./pages/LoanPipeline/LoanPreview";

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

            {/* <Route index path="/all-brokers-Organization" element={<BrokersPage />} /> */}
            <Route
              index
              path="/all-brokers-lenders"
              element={<BrokersLenders />}
            />
            <Route index path="/all-set-rules" element={<AllRuleSets />} />
            <Route index path="/all-rules" element={<AllRules />} />
            {/* <Route index path="/all-lenders-Organization" element={<AllLendersPage/>} /> */}
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

            <Route index path="/all-super-admins" element={<AllSuperadmin />} />

            <Route index path="/all-documents" element={<AllDocuments />} />

            <Route index path="/admin-logs" element={<AdminLogs />} />

            {/* Brokers */}
            <Route index path="/my-broker" element={<MyBroker />} />
            <Route index path="/broker-request" element={<BrokerRequest />} />
            <Route index path="/find-broker" element={<FindBroker />} />

            <Route index path="/loan-pipeline" element={<LoanPipeline />} />
            <Route index path="/loan-preview" element={<LoanPreview />} />
            <Route index path="/loi-preview" element={<LoiPreview />} />

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
          </Route>

          {/* Auth Layout */}
          <Route path="/impersonate" element={<ImpersonateLogin />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            index
            path="/client-upload/:token"
            element={<ClientUpload />}
          />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}


