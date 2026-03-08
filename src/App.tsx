import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy-loaded heavy pages
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"));
const AccountantDashboard = lazy(() => import("./pages/dashboard/AccountantDashboard"));
const EmployeeDashboard = lazy(() => import("./pages/dashboard/EmployeeDashboard"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const PurchaseOrdersPage = lazy(() => import("./pages/PurchaseOrdersPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const POSPage = lazy(() => import("./pages/POSPage"));
const SalesPage = lazy(() => import("./pages/SalesPage"));
const PermissionsPage = lazy(() => import("./pages/PermissionsPage"));
const ImportPage = lazy(() => import("./pages/ImportPage"));
const UserActivityPage = lazy(() => import("./pages/UserActivityPage"));

const PageLoader = () => (
  <div className="flex-1 p-6 space-y-4 animate-pulse">
    <Skeleton className="h-8 w-48" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
    <Skeleton className="h-64 rounded-lg" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/accountant" element={<ProtectedRoute allowedRoles={["accountant"]}><AccountantDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/employee" element={<ProtectedRoute allowedRoles={["employee"]}><EmployeeDashboard /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute allowedRoles={["admin", "accountant", "employee"]}><SuppliersPage /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute allowedRoles={["admin", "employee", "accountant"]}><ProductsPage /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute allowedRoles={["admin", "employee", "accountant"]}><PurchaseOrdersPage /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute allowedRoles={["admin", "accountant", "employee"]}><InventoryPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "accountant"]}><ReportsPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={["admin"]}><UsersPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]}><SettingsPage /></ProtectedRoute>} />
              <Route path="/permissions" element={<ProtectedRoute allowedRoles={["admin"]}><PermissionsPage /></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute allowedRoles={["admin", "accountant"]}><InvoicesPage /></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute allowedRoles={["admin", "accountant"]}><ExpensesPage /></ProtectedRoute>} />
              <Route path="/pos" element={<ProtectedRoute allowedRoles={["admin", "employee"]}><POSPage /></ProtectedRoute>} />
              <Route path="/sales" element={<ProtectedRoute allowedRoles={["admin", "accountant", "employee"]}><SalesPage /></ProtectedRoute>} />
              <Route path="/import" element={<ProtectedRoute allowedRoles={["admin"]}><ImportPage /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
      <PWAInstallBanner />
      <OfflineIndicator />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
