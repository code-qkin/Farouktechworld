// src/App.jsx (Full Final Code)

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
import CompleteSignupPage from './Admin/Pages/CompleteSignUp';
import OrderDetails from './Admin/Pages/OrderDetails';
import Settings from './Admin/Components/Settings';
import PerformancePage from './Admin/Pages/PerformancePage';

// Public/Layout Components (omitted imports for brevity)
import HomePage from './pages/Homepage';
import MainLayout from './layout/MainLayout';
import NotFoundPage from './components/NotFoundPage';
import PricingPage from './pages/PricingPage';
// import ProofOfWorkPage from './pages/ProofOfWorkPage';
import TrackingPage from './pages/TrackingPage';
import SiteGuard from './components/SiteGuard';


const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<MainLayout />}>

      {/* Public Routes */}
      <Route index element={<HomePage />} />
      <Route path="pricing" element={<PricingPage />} />
      {/* <Route path="proof-of-work" element={<ProofOfWorkPage />} /> */}
      <Route path="track-order" element={<TrackingPage />} />

      {/* ADMIN ROUTES */}
      <Route path="admin">
        {/* Unprotected Login Route */}
        <Route path="login" element={<LoginPage />} />
        <Route path="complete-signup" element={<CompleteSignupPage />} />
        {/*
          The Guard Route: Checks authentication and role.
        */}
        <Route element={<AdminAuthGuard />}>

          {/* Default redirect for /admin */}
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* Protected Dashboard Pages */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<OrdersManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="store" element={<StoreInventory />} />
          <Route path="orders/:orderId" element={<OrderDetails />} />
          <Route path="performance" element={<PerformancePage />} />
          {/* <Route path="settings" element={<Settings/>} /> */}
        </Route>
      </Route>

      {/* Catch All (404 Page) */}
      <Route path="*" element={<NotFoundPage />} />

    </Route>
  )
);

function App() {
  return (
    <SiteGuard>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </SiteGuard>
  )
}

export default App;