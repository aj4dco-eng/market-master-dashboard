import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import AccountantDashboard from "./pages/dashboard/AccountantDashboard";
import EmployeeDashboard from "./pages/dashboard/EmployeeDashboard";
import SuppliersPage from "./pages/SuppliersPage";
import ProductsPage from "./pages/ProductsPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import InventoryPage from "./pages/InventoryPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import InvoicesPage from "./pages/InvoicesPage";
import ExpensesPage from "./pages/ExpensesPage";
import POSPage from "./pages/POSPage";
import SalesPage from "./pages/SalesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="/invoices" element={<ProtectedRoute allowedRoles={["admin", "accountant"]}><InvoicesPage /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute allowedRoles={["admin", "accountant"]}><ExpensesPage /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute allowedRoles={["admin", "employee"]}><POSPage /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute allowedRoles={["admin", "accountant", "employee"]}><SalesPage /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
