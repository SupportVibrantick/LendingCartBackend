import { BrowserRouter as Router, Routes, Route } from "react-router";
import { Navigate } from "react-router-dom";
import SignIn from "./pages/AuthPages/SignIn";
// import SignUp from "./pages/AuthPages/SignUp";
import ResetPassword from "./pages/AuthPages/ResetPassword";
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
// import ActiveApplication from "./pages/ActiveApplication/ActiveApp";
import LenderMarketplace from "./pages/LenderInteraction/LenderMarketplace";
// import Templates from "./pages/ApplicationBuilder/Templates";
import AddSection from "./pages/ApplicationBuilder/AddSection";
import SubmitApplications from "./pages/submitedApplications/SubmitApplication";
import LoanOfficer from "./pages/UserManagement/LoanOfficer";
import LoanOfficerActivityPage from "./pages/UserManagement/LoanOfficerActivity";
import ImpersonateLogin from "./pages/ImpersonateLogin";
import LoanApplication from "./pages/LoanApplication/LoanApplication";
import ContactPage from "./pages/Contacts/ContactPage";
import BorrowersPage from "./pages/CRM/Borrowers";
import ClientUpload from "./pages/ClientPortal/ClientUpload";
import ClientProtected from "./pages/ClientPortal/ClientProtected";
import ClientAuth from "./pages/ClientPortal/ClientAuth";
import ClientImpersonateLogin from "./pages/ClientPortal/ClientImpersonateLogin";
// import CustomerLogin from "./pages/ClientPortal/CustomerLogin";
import LoanPreview from "./pages/submitedApplications/LoanPreview";
// import { ReactNode } from "react";
import EmailMarketing from "./pages/EmailMarketing/EmailMarketing";
import SubBroker from "./pages/UserManagement/SubBroker";
import SubBrokerLayout from "./layout/SubBrokerLayout";
import Login from "./pages/subBroker/Auth/Login";
import CoBrokerImpersonateLogin from "./pages/subBroker/Auth/ImpersonateLogin";
import CoBrokerDashboard from "./pages/subBroker/Dashboard/CoBrokerDashboard";
import CoBrokerInvoicesPage from "./pages/subBroker/Invoices/CoBrokerInvoicesPage";
import CoBrokerCommissionsPage from "./pages/subBroker/Commissions/CoBrokerCommissionsPage";
// import Dashboard from "./pages/subBroker/Dashboard/Dashboard";
import LoanPipeline from "./pages/subBroker/LoanPipeline/LoanPipeline";
import SubBrokerLoanPreview from "./pages/subBroker/LoanPipeline/SubBrokerLoanPreview";
import SubBrokerProtected from "./components/auth/SubBrokerProtected";
import SubBrokerProfile from "./pages/subBroker/Auth/Profile";
import LoanOfficerLayout from "./layout/LoanOfficerLayout";
import LoanOfficerLogin from "./pages/loanOfficer/Auth/Login";
import LoanOfficerImpersonateLogin from "./pages/loanOfficer/Auth/ImpersonateLogin";
import LoanOfficerProtected from "./components/auth/LoanOfficerProtected";
import LoanOfficerSubmitApplications from "./pages/loanOfficer/LoanPipeline/SubmitApplication";
import LoanOfficerLoanPreview from "./pages/loanOfficer/LoanPipeline/LoanPreview";
import LoanOfficerProfile from "./pages/loanOfficer/Auth/Profile";
import LoanOfficerDashboard from "./pages/loanOfficer/Dashboard/LoanOfficerDashboard";
import LoanOfficerInvoicesPage from "./pages/loanOfficer/Invoices/LoanOfficerInvoicesPage";
import LoanOfficerCommissionsPage from "./pages/loanOfficer/Commissions/LoanOfficerCommissionsPage";
import LoanOfficerMessagesPage from "./pages/loanOfficer/Messages/LoanOfficerMessagesPage";
import LoanOfficerApplication from "./pages/loanOfficer/LoanApplication/LoanApplication";
import LoanOfficerContacts from "./pages/loanOfficer/Contacts/ContactPage";
import BrokerBranding from "./pages/Settings/BrokerBranding";
import BrokerCustomDocuments from "./pages/Documents/BrokerCustomDocuments";
import CommissionsPage from "./pages/Commissions/CommissionsPage";
import PaymentsLayout from "./pages/Payments/PaymentsLayout";
import InvoicesPage from "./pages/Payments/InvoicesPage";
import RequirePermission from "./components/auth/RequirePermission";
import type { PermissionKey } from "./lib/brokerPermissions";

// type RequirePermissionProps = {
//   children: ReactNode;
//   permission: string;
// };

// const RequirePermission = ({
//   children,
//   permission,
// }: RequirePermissionProps) => {
//   const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
//   const permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]");

//   const isAdmin = roles.includes("BROKER_ADMIN");

//   if (!isAdmin && !permissions.includes(permission)) {
//     return <Navigate to="/" replace />;
//   }

//   return <>{children}</>;
// };

const BrokerRequirePermission = ({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission: string | string[];
}) => (
  <RequirePermission permission={permission as PermissionKey | PermissionKey[]} portal="broker">
    {children}
  </RequirePermission>
);

const LoRequirePermission = ({
  permission,
  children,
}: {
  permission: PermissionKey | PermissionKey[] | "always";
  children: React.ReactNode;
}) => {
  if (permission === "always") return <>{children}</>;
  return (
    <RequirePermission permission={permission} portal="loanOfficer">
      {children}
    </RequirePermission>
  );
};

const isSubBrokerUser = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
    return user?.userType === "SUB_BROKER";
  } catch {
    return false;
  }
};

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
              path="/all-brokers-Organization"
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
            <Route index path="/email-marketing" element={
              <BrokerRequirePermission permission="MANAGE_SETTINGS">
                <EmailMarketing />
              </BrokerRequirePermission>
            } />
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

            <Route index path="/application" element={<Application />} />

            <Route
              index
              path="/application-config"
              element={<LoanApplicationConfig />}
            />

            {/* <Route
              index
              path="/active-application"
              element={<ActiveApplication />}
            /> */}

            <Route
              path="/sub-brokers"
              element={
                isSubBrokerUser() ? <Navigate to="/" replace /> : <SubBroker />
              }
            />

            <Route
              path="/loan-officers"
              element={
                isSubBrokerUser() ? (
                  <Navigate to="/" replace />
                ) : (
                  <LoanOfficer />
                )
              }
            />

            <Route
              path="/loan-officer-activity"
              element={
                isSubBrokerUser() ? (
                  <Navigate to="/" replace />
                ) : (
                  <LoanOfficerActivityPage />
                )
              }
            />

            <Route
              path="/borrowers"
              element={
                isSubBrokerUser() ? (
                  <Navigate to="/" replace />
                ) : (
                  <BorrowersPage />
                )
              }
            />

            <Route
              path="/contacts-list"
              element={
                isSubBrokerUser() ? (
                  <Navigate to="/" replace />
                ) : (
                  <BrokerRequirePermission permission="VIEW_CLIENTS">
                    <ContactPage />
                  </BrokerRequirePermission>
                )
              }
            />

            <Route index path="/add-section" element={<AddSection />} />

            {/* <Route index path="/templates" element={<Templates />} /> */}

            <Route
              path="/submit-applications"
              element={
                <BrokerRequirePermission permission="VIEW_PIPELINE">
                  <SubmitApplications />
                </BrokerRequirePermission>
              }
            />

            {/* <Route path="/messages" element={<MessagesPage />} /> */}

            <Route
              index
              path="/loan-application"
              element={
                <BrokerRequirePermission permission="CREATE_APPLICATION">
                  <LoanApplication />
                </BrokerRequirePermission>
              }
            />

            <Route index path="/loan-preview" element={<LoanPreview />} />

            <Route path="/payments" element={<PaymentsLayout />}>
              <Route index element={<Navigate to="invoices" replace />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="commissions" element={<CommissionsPage />} />
            </Route>
            <Route
              path="/commissions"
              element={<Navigate to="/payments/commissions" replace />}
            />

            <Route path="/lender-marketplace" element={
              <BrokerRequirePermission permission="VIEW_LENDERS">
                <LenderMarketplace />
              </BrokerRequirePermission>
            } />
            <Route
              path="/find-lenders"
              element={<Navigate to="/lender-marketplace?tab=discover" replace />}
            />
            <Route
              path="/my-lenders"
              element={<Navigate to="/lender-marketplace?tab=network" replace />}
            />
            <Route
              path="/invited-lenders"
              element={
                <Navigate to="/lender-marketplace?tab=network&filter=sent" replace />
              }
            />

            <Route index path="/all-super-admins" element={<AllSuperadmin />} />

            <Route index path="/all-documents" element={<AllDocuments />} />

            <Route index path="/admin-logs" element={
              <BrokerRequirePermission permission="VIEW_LOGS">
                <AdminLogs />
              </BrokerRequirePermission>
            } />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/settings/branding" element={
              <BrokerRequirePermission permission="VIEW_SETTINGS">
                <BrokerBranding />
              </BrokerRequirePermission>
            } />
            <Route
              path="/documents/custom"
              element={
                <BrokerRequirePermission permission="VIEW_TEMPLATES">
                  <BrokerCustomDocuments />
                </BrokerRequirePermission>
              }
            />
            <Route
              path="/settings/custom-documents"
              element={<Navigate to="/documents/custom" replace />}
            />
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
              element={
                <BrokerRequirePermission permission="VIEW_WEBSITE_BUILDER">
                  <ConfigWebsite />
                </BrokerRequirePermission>
              }
            />
          </Route>

          {/* Auth Layout */}
          <Route path="/impersonate" element={<ImpersonateLogin />} />
          <Route path="/signin" element={<SignIn />} />
          {/* <Route path="/signup" element={<SignUp />} /> */}
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/client-upload" element={<ClientAuth />} />
          <Route path="/client-upload/:token" element={<ClientAuth />} />
          <Route
            path="/client-portal/impersonate"
            element={<ClientImpersonateLogin />}
          />

          <Route
            path="/client-portal"
            element={
              <ClientProtected>
                <ClientUpload />
              </ClientProtected>
            }
          />

          <Route
            path="/client-portal/:token"
            element={
              <ClientProtected>
                <ClientUpload />
              </ClientProtected>
            }
          />

          {/* SUB BROKER PORTAL */}

          <Route path="/sub-broker/login" element={<Login />} />
          <Route
            path="/sub-broker/impersonate"
            element={<CoBrokerImpersonateLogin />}
          />

          <Route
            path="/sub-broker"
            element={
              <SubBrokerProtected>
                <SubBrokerLayout />
              </SubBrokerProtected>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />

            <Route path="dashboard" element={<CoBrokerDashboard />} />

            <Route path="invoices" element={<CoBrokerInvoicesPage />} />

            <Route path="commissions" element={<CoBrokerCommissionsPage />} />

            <Route path="loan-pipeline" element={<LoanPipeline />} />

            <Route
              path="loan-pipeline-preview"
              element={<SubBrokerLoanPreview />}
            />
            <Route path="profile" element={<SubBrokerProfile />} />
          </Route>

          {/* LOAN OFFICER PORTAL */}

          <Route path="/loan-officer/login" element={<LoanOfficerLogin />} />
          <Route
            path="/loan-officer/impersonate"
            element={<LoanOfficerImpersonateLogin />}
          />

          <Route
            path="/loan-officer"
            element={
              <LoanOfficerProtected>
                <LoanOfficerLayout />
              </LoanOfficerProtected>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<LoanOfficerDashboard />} />
            <Route
              path="invoices"
              element={
                <LoRequirePermission permission="VIEW_INVOICES">
                  <LoanOfficerInvoicesPage />
                </LoRequirePermission>
              }
            />
            <Route
              path="commissions"
              element={
                <LoRequirePermission permission="VIEW_COMMISSIONS">
                  <LoanOfficerCommissionsPage />
                </LoRequirePermission>
              }
            />
            <Route
              path="loan-pipeline"
              element={
                <LoRequirePermission permission="VIEW_APPLICATIONS">
                  <LoanOfficerSubmitApplications />
                </LoRequirePermission>
              }
            />
            <Route
              path="loan-pipeline-preview"
              element={
                <LoRequirePermission permission="VIEW_APPLICATIONS">
                  <LoanOfficerLoanPreview />
                </LoRequirePermission>
              }
            />
            <Route
              path="loan-application"
              element={
                <LoRequirePermission permission="CREATE_APPLICATION">
                  <LoanOfficerApplication />
                </LoRequirePermission>
              }
            />
            <Route
              path="contacts"
              element={
                <LoRequirePermission permission="VIEW_CONTACTS">
                  <LoanOfficerContacts />
                </LoRequirePermission>
              }
            />
            <Route
              path="co-brokers"
              element={
                <LoRequirePermission permission="VIEW_CO_BROKERS">
                  <SubBroker />
                </LoRequirePermission>
              }
            />
            <Route
              path="borrowers"
              element={
                <LoRequirePermission permission="VIEW_BORROWERS">
                  <BorrowersPage />
                </LoRequirePermission>
              }
            />
            <Route
              path="lender-marketplace"
              element={
                <LoRequirePermission permission="VIEW_MARKETPLACE">
                  <LenderMarketplace />
                </LoRequirePermission>
              }
            />
            <Route
              path="documents/custom"
              element={
                <LoRequirePermission
                  permission={["MANAGE_CUSTOM_DOCUMENTS", "VIEW_CUSTOM_DOCUMENTS"]}
                >
                  <BrokerCustomDocuments />
                </LoRequirePermission>
              }
            />
            <Route
              path="email-marketing"
              element={
                <LoRequirePermission permission="SEND_EMAILS">
                  <EmailMarketing />
                </LoRequirePermission>
              }
            />
            <Route
              path="messages"
              element={
                <LoRequirePermission permission="CHAT">
                  <LoanOfficerMessagesPage />
                </LoRequirePermission>
              }
            />
            <Route
              path="settings/branding"
              element={
                <LoRequirePermission
                  permission={["MANAGE_BRANDING", "VIEW_COMPANY_SETTINGS"]}
                >
                  <BrokerBranding />
                </LoRequirePermission>
              }
            />
            <Route
              path="admin-logs"
              element={
                <LoRequirePermission permission="VIEW_REPORTS">
                  <AdminLogs />
                </LoRequirePermission>
              }
            />
            <Route path="profile" element={<LoanOfficerProfile />} />
          </Route>

          {/* <Route path="/customer" element={<CustomerLogin />} /> */}

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
