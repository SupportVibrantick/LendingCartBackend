import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import AcceptInvite from "./pages/AuthPages/AcceptInvite";
import PartnerLanding from "./pages/AuthPages/PartnerLanding";
import PartnerSignup from "./pages/AuthPages/PartnerSignup";
import VerifyEmail from "./pages/AuthPages/VerifyEmail";
import VerifyEmailPending from "./pages/AuthPages/VerifyEmailPending";
// import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import LenderProfileView from "./pages/Profile/LenderProfileView";
import EditFullProfile from "./pages/Profile/EditFullProfile";
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
import AllRuleSets from "./pages/Eligibility Engine/AllRuleSets";
import AllRules from "./pages/Eligibility Engine/AllRules";
import RequireAuth from "./components/auth/RequireAuth";
import RequireLenderAdmin from "./components/auth/RequireLenderAdmin";
import BrokersLenders from "./pages/Eligibility Engine/CreateRule";
import AdminLogs from "./pages/AdminLogs/AdminLogs";
import AllLoanProducts from "./pages/LoanProducts/AllLoanProducts";
import AddLoanProduct from "./pages/LoanProducts/AddLoanProduct";
// import AllDocuments from "./pages/Documents/AllDocuments";
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
import TeamMembers from "./pages/TeamMembers/TeamMembers";
import UpdateLoanProduct from "./pages/LoanProducts/UpdateLoanProduct";
import ChangePassword from "./pages/Account/ChangePassword";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <ToastProvider />
        <Routes>
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
            <Route index path="/all-brokers-lenders" element={<BrokersLenders />} />
            <Route index path="/all-set-rules" element={<AllRuleSets />} />
            <Route index path="/all-rules" element={<AllRules />} />
            <Route index path="/all-loan-products" element={<AllLoanProducts />} />
            <Route
              index
              path="/add-loan-product"
              element={
                <RequireLenderAdmin>
                  <AddLoanProduct />
                </RequireLenderAdmin>
              }
            />
            <Route
              index
              path="/update-loan-product"
              element={
                <RequireLenderAdmin>
                  <UpdateLoanProduct />
                </RequireLenderAdmin>
              }
            />
            <Route index path="/lender-assigned-products" element={<LenderProductAssign />} />
            <Route index path="/assigned-products" element={<AssignedProducts />} />
            <Route index path="/all-super-admins" element={<AllSuperadmin />} />
            {/* <Route index path="/all-documents" element={<AllDocuments />} /> */}
            <Route index path="/admin-logs" element={<AdminLogs />} />
            <Route index path="/my-broker" element={<MyBroker />} />
            <Route index path="/broker-request" element={<BrokerRequest />} />
            <Route index path="/find-broker" element={<FindBroker />} />
            <Route index path="/loan-pipeline" element={<LoanPipeline />} />
            <Route index path="/loan-preview" element={<LoanPreview />} />
            <Route index path="/loi-preview" element={<LoiPreview />} />
            <Route path="/team-members" element={<TeamMembers />} />
            <Route path="/account/change-password" element={<ChangePassword />} />
            <Route path="/profile" element={<LenderProfileView />} />
            <Route
              path="/profile/edit"
              element={
                <RequireLenderAdmin>
                  <EditFullProfile />
                </RequireLenderAdmin>
              }
            />
            <Route
              path="/profile/guidelines"
              element={
                <RequireLenderAdmin>
                  <UserProfiles />
                </RequireLenderAdmin>
              }
            />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />
            <Route path="/form-elements" element={<FormElements />} />
            <Route path="/basic-tables" element={<BasicTables />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
          </Route>

          <Route path="/impersonate" element={<ImpersonateLogin />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />
          <Route path="/partner" element={<PartnerLanding />} />
          <Route path="/partner/signup" element={<PartnerSignup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-email-pending" element={<VerifyEmailPending />} />
          {/* <Route path="/signup" element={<SignUp />} /> */}
          <Route index path="/client-upload/:token" element={<ClientUpload />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
