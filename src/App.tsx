import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ActiveModuleProvider } from "@/modules/ActiveModuleProvider";
import { ModuleGuard } from "@/modules/ModuleGuard";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Onboarding from "./pages/Onboarding";
import SelectOrganization from "./pages/SelectOrganization";
import Dashboard from "./pages/Dashboard";
import Branches from "./pages/Branches";
import Transfers from "./pages/Transfers";
import Reports from "./pages/Reports";
import WhatsAppSettings from "./pages/WhatsAppSettings";
import WhatsAppLogs from "./pages/WhatsAppLogs";
import WhatsAppConfirmationLog from "./pages/WhatsAppConfirmationLog";
import Statistics from "./pages/Statistics";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import OrganizationSettings from "./pages/OrganizationSettings";
import ProcessingMonitor from "./pages/ProcessingMonitor";
import ReviewTransfers from "./pages/ReviewTransfers";
import Expenses from "./pages/Expenses";
import Employees from "./pages/Employees";
import Salaries from "./pages/Salaries";
import FinancialReports from "./pages/FinancialReports";
import PrintOrders from "./pages/PrintOrders";
import InvestmentOrchestrator from "./pages/InvestmentOrchestrator";
import Invoices from "./pages/Invoices";
import SubscriptionInvoices from "./pages/SubscriptionInvoices";
import SubscriptionInvoiceDetail from "./pages/SubscriptionInvoiceDetail";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
          <BrowserRouter>
            <ActiveModuleProvider>
            <ModuleGuard>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/onboarding" element={
                <ProtectedRoute requireOrganization={false}>
                  <Onboarding />
                </ProtectedRoute>
              } />
              <Route path="/select-organization" element={
                <ProtectedRoute requireOrganization={false}>
                  <SelectOrganization />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute><Dashboard /></ProtectedRoute>
              } />
              <Route path="/branches" element={
                <ProtectedRoute><Branches /></ProtectedRoute>
              } />
              <Route path="/transfers" element={
                <ProtectedRoute><Transfers /></ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute><Reports /></ProtectedRoute>
              } />
              <Route path="/whatsapp" element={
                <ProtectedRoute><WhatsAppSettings /></ProtectedRoute>
              } />
              <Route path="/whatsapp-logs" element={
                <ProtectedRoute><WhatsAppLogs /></ProtectedRoute>
              } />
              <Route path="/whatsapp-confirmation-log" element={
                <ProtectedRoute><WhatsAppConfirmationLog /></ProtectedRoute>
              } />
              <Route path="/statistics" element={
                <ProtectedRoute><Statistics /></ProtectedRoute>
              } />
              <Route path="/users" element={
                <ProtectedRoute><Users /></ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute><Settings /></ProtectedRoute>
              } />
              <Route path="/organization" element={
                <ProtectedRoute><OrganizationSettings /></ProtectedRoute>
              } />
              <Route path="/processing" element={
                <ProtectedRoute><ProcessingMonitor /></ProtectedRoute>
              } />
              <Route path="/review" element={
                <ProtectedRoute><ReviewTransfers /></ProtectedRoute>
              } />
              <Route path="/expenses" element={
                <ProtectedRoute><Expenses /></ProtectedRoute>
              } />
              <Route path="/employees" element={
                <ProtectedRoute><Employees /></ProtectedRoute>
              } />
              <Route path="/salaries" element={
                <ProtectedRoute><Salaries /></ProtectedRoute>
              } />
              <Route path="/financial-reports" element={
                <ProtectedRoute><FinancialReports /></ProtectedRoute>
              } />
              <Route path="/print-orders" element={
                <ProtectedRoute><PrintOrders /></ProtectedRoute>
              } />
              <Route path="/investments" element={
                <ProtectedRoute><InvestmentOrchestrator /></ProtectedRoute>
              } />
              <Route path="/invoices" element={
                <ProtectedRoute><Invoices /></ProtectedRoute>
              } />
              <Route path="/subscription-invoices" element={
                <ProtectedRoute><SubscriptionInvoices /></ProtectedRoute>
              } />
              <Route path="/subscription-invoices/:id" element={
                <ProtectedRoute><SubscriptionInvoiceDetail /></ProtectedRoute>
              } />
              <Route path="/pos" element={
                <ProtectedRoute><POS /></ProtectedRoute>
              } />
              <Route path="/products" element={
                <ProtectedRoute><Products /></ProtectedRoute>
              } />
              <Route path="/inventory" element={
                <ProtectedRoute><Inventory /></ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
