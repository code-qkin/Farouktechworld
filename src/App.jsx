import {
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Navigate
} from "react-router-dom";

// Core Components
import { AuthProvider } from './Admin/AdminContext';
import AdminAuthGuard from './Admin/Components/AdminGuard';
import LoginPage from './Admin/Pages/LoginPage';
import Dashboard from './Admin/Pages/Dashboards/DashboardHandler';
import OrdersManagement from './Admin/Pages/OrderManagement';
import UserManagement from './Admin/Pages/UserManagement';
import StoreInventory from './Admin/Pages/StoreInventory';
// import CompleteSignupPage from './Admin/Pages/CompleteSignUp';
import OrderDetails from './Admin/Pages/OrderDetails';
import Settings from './Admin/Components/Settings';
import PerformancePage from './Admin/Pages/PerformancePage';
import JobHistory from './Admin/Pages/JobHistory';
import PayrollPage from './Admin/Pages/PayrollPage';
import SignUp from './Admin/Components/SignUp';
import SystemReset from './Admin/Components/SystemReset';
import HomePage from './pages/Homepage';
import MainLayout from './layout/MainLayout';
import NotFoundPage from './components/NotFoundPage';
import PricingPage from './pages/PricingPage';
import ProofOfWorkPage from './pages/ProofOfWorkPage';
import TrackingPage from './pages/TrackingPage';
// import SiteGuard from './components/SiteGuard';
import ServicePrices from './Admin/Pages/ServicePrices';
// import IssueReports from "./Admin/Pages/IssueReports";
import ManageProofOfWork from "./Admin/Pages/ManageProofOfWork";
import DeviceManager from "./Admin/Pages/DeviceManager";
import DebtAnalysis from "./Admin/Pages/DebtAnalysis";
import PaymentRegister from "./Admin/Pages/PaymentRegister";
import WorkerStat from "./Admin/Pages/WorkerStat";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<MainLayout />}>

     
      <Route index element={<HomePage />} />
      <Route path="pricing" element={<PricingPage />} />
      <Route path="proof-of-work" element={<ProofOfWorkPage />} />
      <Route path="track-order" element={<TrackingPage />} />

     
      <Route path="admin">
        <Route path="login" element={<LoginPage />} />
       <Route path="register" element={<SignUp />} />
        <Route element={<AdminAuthGuard />}>
        <Route path="system-reset" element={<SystemReset />} />
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<OrdersManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="store" element={<StoreInventory />} />
          <Route path="orders/:orderId" element={<OrderDetails />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="job-history" element={<JobHistory />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="pricing" element={<ServicePrices />} />
          <Route path="manage-proof-of-work" element={<ManageProofOfWork />} />
          <Route path="devices" element={<DeviceManager />} />
          <Route path="debt-analysis" element={<DebtAnalysis />} />
          <Route path="payments" element={<PaymentRegister />} />
          <Route path="worker-stats" element={<WorkerStat />} />
          {/* <Route path="settings" element={<Settings/>} /> */}
        </Route>
      </Route>

     
      <Route path="*" element={<NotFoundPage />} />

    </Route>
  )
);

function App() {
  return (
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
  )
}

export default App;