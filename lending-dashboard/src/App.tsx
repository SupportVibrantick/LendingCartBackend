import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import ToastProvider from "./Utils/ToastProvider/ToastProvider";
import RequireAuth from "./components/auth/RequireAuth";
import RequireLenderAdmin from "./components/auth/RequireLenderAdmin";

// Auth pages stay eager so /signin stays light and fast.
import SignIn from "./pages/AuthPages/SignIn";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import AcceptInvite from "./pages/AuthPages/AcceptInvite";
import PartnerLanding from "./pages/AuthPages/PartnerLanding";
import PartnerSignup from "./pages/AuthPages/PartnerSignup";
import VerifyEmail from "./pages/AuthPages/VerifyEmail";
import VerifyEmailPending from "./pages/AuthPages/VerifyEmailPending";
import ImpersonateLogin from "./pages/ImpersonateLogin";
import NotFound from "./pages/OtherPage/NotFound";

// Everything else loads on demand (cuts hundreds of module requests on login).
const Home = lazy(() => import("./pages/Dashboard/Home"));
const AddUser = lazy(() => import("./pages/ManageUser/AddUser"));
const AllUsers = lazy(() => import("./pages/ManageUser/AllUser"));
const AllRuleSets = lazy(() => import("./pages/Eligibility Engine/AllRuleSets"));
const AllRules = lazy(() => import("./pages/Eligibility Engine/AllRules"));
const BrokersLenders = lazy(
  () => import("./pages/Eligibility Engine/CreateRule"),
);
const AdminLogs = lazy(() => import("./pages/AdminLogs/AdminLogs"));
const AllLoanProducts = lazy(
  () => import("./pages/LoanProducts/AllLoanProducts"),
);
const AddLoanProduct = lazy(
  () => import("./pages/LoanProducts/AddLoanProduct"),
);
const UpdateLoanProduct = lazy(
  () => import("./pages/LoanProducts/UpdateLoanProduct"),
);
const LenderProductAssign = lazy(
  () => import("./pages/LoanProducts/LenderAssignProduct"),
);
const AssignedProducts = lazy(
  () => import("./pages/LoanProducts/AssignedProducts"),
);
const AllDocuments = lazy(() => import("./pages/Documents/AllDocuments"));
const SignFormTemplates = lazy(
  () => import("./pages/Documents/SignFormTemplates"),
);
const AllSuperadmin = lazy(() => import("./pages/SuperAdmin/AllSuperAdmin"));
const BrokerConnections = lazy(
  () => import("./pages/Brokers/BrokerConnections"),
);
const FindBroker = lazy(() => import("./pages/Brokers/FindBroker"));
const LoanPipeline = lazy(() => import("./pages/LoanPipeline/LoanPipeline"));
const LoanPreview = lazy(() => import("./pages/LoanPipeline/LoanPreview"));
const LoiPreview = lazy(() => import("./pages/LoanPipeline/LoiPreview"));
const LoiUnderwritingFormPage = lazy(
  () => import("./pages/LoanPipeline/LoiUnderwritingFormPage"),
);
const SignFormMapperPage = lazy(
  () => import("./pages/LoanPipeline/SignFormMapperPage"),
);
const TeamMembers = lazy(() => import("./pages/TeamMembers/TeamMembers"));
const ChangePassword = lazy(() => import("./pages/Account/ChangePassword"));
const LenderBranding = lazy(() => import("./pages/Settings/LenderBranding"));
const LenderProfileView = lazy(
  () => import("./pages/Profile/LenderProfileView"),
);
const EditFullProfile = lazy(() => import("./pages/Profile/EditFullProfile"));
const UserProfiles = lazy(() => import("./pages/UserProfiles"));
const ClientUpload = lazy(() => import("./pages/ClientPortal/ClientUpload"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Blank = lazy(() => import("./pages/Blank"));
const FormElements = lazy(() => import("./pages/Forms/FormElements"));
const BasicTables = lazy(() => import("./pages/Tables/BasicTables"));
const Alerts = lazy(() => import("./pages/UiElements/Alerts"));
const Avatars = lazy(() => import("./pages/UiElements/Avatars"));
const Badges = lazy(() => import("./pages/UiElements/Badges"));
const Buttons = lazy(() => import("./pages/UiElements/Buttons"));
const Images = lazy(() => import("./pages/UiElements/Images"));
const Videos = lazy(() => import("./pages/UiElements/Videos"));
const LineChart = lazy(() => import("./pages/Charts/LineChart"));
const BarChart = lazy(() => import("./pages/Charts/BarChart"));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <ToastProvider />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              element={
                <RequireAuth>
                  <Outlet />
                </RequireAuth>
              }
            >
              {/* Full-screen loan preview — no lender sidebar/header */}
              <Route path="/loan-preview" element={<LoanPreview />} />

              <Route element={<AppLayout />}>
                <Route index path="/" element={<Home />} />
                <Route index path="/add-user" element={<AddUser />} />
                <Route index path="/all-user" element={<AllUsers />} />
                <Route
                  index
                  path="/all-brokers-lenders"
                  element={<BrokersLenders />}
                />
                <Route index path="/all-set-rules" element={<AllRuleSets />} />
                <Route index path="/all-rules" element={<AllRules />} />
                <Route
                  index
                  path="/all-loan-products"
                  element={<AllLoanProducts />}
                />
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
                  path="/all-super-admins"
                  element={<AllSuperadmin />}
                />
                <Route
                  index
                  path="/documents"
                  element={
                    <RequireLenderAdmin>
                      <AllDocuments />
                    </RequireLenderAdmin>
                  }
                />
                <Route
                  path="/sign-form-templates"
                  element={
                    <RequireLenderAdmin>
                      <SignFormTemplates />
                    </RequireLenderAdmin>
                  }
                />
                <Route index path="/admin-logs" element={<AdminLogs />} />
                <Route index path="/brokers" element={<BrokerConnections />} />
                <Route
                  path="/broker-request"
                  element={<Navigate to="/brokers?tab=requests" replace />}
                />
                <Route
                  path="/my-broker"
                  element={<Navigate to="/brokers?tab=connected" replace />}
                />
                <Route index path="/find-broker" element={<FindBroker />} />
                <Route index path="/loan-pipeline" element={<LoanPipeline />} />
                <Route
                  index
                  path="/loi-form"
                  element={<LoiUnderwritingFormPage />}
                />
                <Route index path="/loi-preview" element={<LoiPreview />} />
                <Route
                  path="/team-members"
                  element={
                    <RequireLenderAdmin>
                      <TeamMembers />
                    </RequireLenderAdmin>
                  }
                />
                <Route
                  path="/account/change-password"
                  element={<ChangePassword />}
                />
                <Route
                  path="/settings/branding"
                  element={
                    <RequireLenderAdmin>
                      <LenderBranding />
                    </RequireLenderAdmin>
                  }
                />
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
            </Route>

            <Route path="/impersonate" element={<ImpersonateLogin />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/partner" element={<PartnerLanding />} />
            <Route path="/partner/signup" element={<PartnerSignup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/verify-email-pending"
              element={<VerifyEmailPending />}
            />
            <Route
              index
              path="/client-upload/:token"
              element={<ClientUpload />}
            />
            <Route
              path="/sign-form-mapper"
              element={
                <RequireAuth>
                  <SignFormMapperPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
}
