import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
// import SignUp from "./pages/AuthPages/SignUp";
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
import BrokerDetailPage from "./pages/Brokers/BrokerDetailPage";
import BrokerDetailRedirect from "./pages/Brokers/BrokerDetailRedirect";
import RequireAuth from "./components/auth/RequireAuth";
import AllLendersPage from "./pages/Lenders/AllLenders";
import BrokersLenders from "./pages/Brokers/BrokersLenders";
import AdminLogs from "./pages/AdminLogs/AdminLogs";
import AllLoanProducts from "./pages/LoanProducts/AllLoanProducts";
import AllDocuments from "./pages/Documents/AllDocuments";
import AllSubscriptions from "./pages/Subscriptions/AllSubscriptions";
import SubscriptionSubscribers from "./pages/Subscriptions/SubscriptionSubscribers";
import SubscriberDetail from "./pages/Subscriptions/SubscriberDetail";
import LoanAiUsers from "./pages/Subscriptions/LoanAiUsers";
import SubscriptionInvoices from "./pages/Subscriptions/SubscriptionInvoices";
import AllSuperadmin from "./pages/SuperAdmin/AllSuperAdmin";
import LenderProductAssign from "./pages/LoanProducts/LenderAssignProduct";
import LenderAllAssignProducts from "./pages/LoanProducts/LenderAllAssignProducts";
import AssignedProducts from "./pages/LoanProducts/AssignedProducts";
import AllLeads from "./pages/LandingPageLeads/AllLeads";
import ActiveApplication from "./pages/ActiveApplication/ActiveApp";
import CreateApplication from "./pages/ApplicationBuilder/CreateApplication";
import ApplicationBuilder from "./pages/ApplicationBuilder/Application";
import LoanApplicationConfig from "./pages/ApplicationBuilder/LoanApplicationConfig";
import CreateTemplate from "./pages/TemplateBuilder/CreateTemplate";
import AllTemplates from "./pages/TemplateBuilder/AllTemplates";
import AddLoanProduct from "./pages/TemplateBuilder/AddLoanProduct";
import AddFields from "./pages/TemplateBuilder/AddFields";
import AddSection from "./pages/TemplateBuilder/AddSection";
import AddAppSection from "./pages/ApplicationBuilder/AddSection";
import LoanPipeline from "./pages/LoanPipeline/LoanPipeline";
import BrokerPortal from "./pages/ViewPortal/BrokerPortal";
import LenderPortal from "./pages/ViewPortal/LenderPortal";
import SystemSettings from "./pages/SystemSettings/SystemSettings";
import LoanCriteria from "./pages/Lenders/LoanCriteria/Main";
import AddLender from "./pages/Lenders/AddLender/Main";
import UpdateLender from "./pages/Lenders/UpdateLender/Main";
import EmailMarketing from "./pages/EmailMarketing/EmailMarketing";
import AllLoanOfficers from "./pages/Platform/AllLoanOfficers";
import AllSubBrokers from "./pages/Platform/AllSubBrokers";
import AllClients from "./pages/Platform/AllClients";
import AllCommunications from "./pages/Platform/AllCommunications";
import PlatformReports from "./pages/Platform/PlatformReports";

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
              path="/all-brokers-database"
              element={<BrokersPage />}
            />
            <Route path="/broker-detail" element={<BrokerDetailPage />} />
            <Route path="/brokers/:brokerId" element={<BrokerDetailRedirect />} />
            <Route
              index
              path="/all-brokers-lenders"
              element={<BrokersLenders />}
            />
            <Route
              index
              path="/active-application"
              element={<ActiveApplication />}
            />
            <Route
              index
              path="/create-application"
              element={<CreateApplication />}
            />
            <Route
              index
              path="/application-builder"
              element={<ApplicationBuilder />}
            />
            <Route
              index
              path="/loan-application-config"
              element={<LoanApplicationConfig />}
            />
            <Route index path="/create-template" element={<CreateTemplate />} />
            <Route index path="/all-templates" element={<AllTemplates />} />
            <Route
              index
              path="/add-loan-product"
              element={<AddLoanProduct />}
            />
            <Route index path="/add-fields" element={<AddFields />} />
            <Route index path="/add-sections" element={<AddSection />} />
            <Route index path="/add-app-sections" element={<AddAppSection />} />
            <Route
              index
              path="/all-lenders-Organization"
              element={<AllLendersPage />}
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
              path="/lender-all-assigned-products"
              element={<LenderAllAssignProducts />}
            />
            <Route index path="/add-lender" element={<AddLender />} />
            <Route index path="/update-lender/:id" element={<UpdateLender />} />
            <Route index path="/assigned-products" element={<LoanCriteria />} />
            <Route
              index
              path="/view-assigned-products"
              element={<AssignedProducts />}
            />
            <Route index path="/all-super-admins" element={<AllSuperadmin />} />
            <Route index path="/loan-pipeline" element={<LoanPipeline />} />

            <Route index path="/all-documents" element={<AllDocuments />} />
            <Route index path="/all-subscriptions" element={<AllSubscriptions />} />
            <Route index path="/subscription-subscribers" element={<SubscriptionSubscribers />} />
            <Route index path="/subscription-subscribers/detail" element={<SubscriberDetail />} />
            <Route index path="/loan-ai-signups" element={<LoanAiUsers />} />
            <Route index path="/subscription-invoices" element={<SubscriptionInvoices />} />
            <Route
              index
              path="/all-landing-pages-leads"
              element={<AllLeads />}
            />
            <Route
              index
              path="/email-marketing"
              element={<EmailMarketing />}
            />
            <Route path="/super-admin" element={<Navigate to="/" replace />} />
            <Route index path="/platform-reports" element={<PlatformReports />} />
            <Route index path="/all-loan-officers" element={<AllLoanOfficers />} />
            <Route index path="/all-sub-brokers" element={<AllSubBrokers />} />
            <Route index path="/all-clients" element={<AllClients />} />
            <Route index path="/all-communications" element={<AllCommunications />} />

            <Route index path="/admin-logs" element={<AdminLogs />} />
            <Route index path="/system-settings" element={<SystemSettings />} />

            {/* Others Page */}
            <Route path="/broker-portal" element={<BrokerPortal />} />
            <Route path="/lender-portal" element={<LenderPortal />} />
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
          <Route path="/signin" element={<SignIn />} />
          {/* <Route path="/signup" element={<SignUp />} /> */}

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
