import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ActiveModuleProvider } from "@/modules/ActiveModuleProvider";
import { ModuleGuard } from "@/modules/ModuleGuard";

// Critical landing & auth pages loaded eagerly
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded application pages
const Index = lazy(() => import("./pages/Index"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const SelectOrganization = lazy(() => import("./pages/SelectOrganization"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Branches = lazy(() => import("./pages/Branches"));
const Transfers = lazy(() => import("./pages/Transfers"));
const Reports = lazy(() => import("./pages/Reports"));
const WhatsAppSettings = lazy(() => import("./pages/WhatsAppSettings"));
const WhatsAppLogs = lazy(() => import("./pages/WhatsAppLogs"));
const WhatsAppConfirmationLog = lazy(() => import("./pages/WhatsAppConfirmationLog"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const OrganizationSettings = lazy(() => import("./pages/OrganizationSettings"));
const ProcessingMonitor = lazy(() => import("./pages/ProcessingMonitor"));
const ReviewTransfers = lazy(() => import("./pages/ReviewTransfers"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Employees = lazy(() => import("./pages/Employees"));
const Salaries = lazy(() => import("./pages/Salaries"));
const FinancialReports = lazy(() => import("./pages/FinancialReports"));
const LedgerReconciliation = lazy(() => import("./pages/LedgerReconciliation"));
const PrintOrders = lazy(() => import("./pages/PrintOrders"));
const InvestmentOrchestrator = lazy(() => import("./pages/InvestmentOrchestrator"));
const Invoices = lazy(() => import("./pages/Invoices"));
const SubscriptionInvoices = lazy(() => import("./pages/SubscriptionInvoices"));
const SubscriptionInvoiceDetail = lazy(() => import("./pages/SubscriptionInvoiceDetail"));
const POS = lazy(() => import("./pages/POS"));
const Products = lazy(() => import("./pages/Products"));
const Inventory = lazy(() => import("./pages/Inventory"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient();

const PageLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2" />
    <span className="mr-2">جاري التحميل...</span>
  </div>
);

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
            <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
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
              <Route path="/reconciliation" element={
                <ProtectedRoute><LedgerReconciliation /></ProtectedRoute>
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
              <Route path="/index" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </ModuleGuard>
            </ActiveModuleProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
