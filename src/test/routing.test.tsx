import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";

// ---- Mocks -------------------------------------------------------------
const authState = {
  user: null as { id: string } | null,
  isLoading: false,
  userDataReady: true,
  userRoles: [] as unknown[],
  currentOrganization: null as unknown,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/authNavLogger", () => ({
  logAuthNav: vi.fn(),
}));

import Index from "@/pages/Index";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const AuthPage = () => <div>AUTH_PAGE</div>;
const DashboardPage = () => <div>DASHBOARD_PAGE</div>;
const OnboardingPage = () => <div>ONBOARDING_PAGE</div>;
const SelectOrgPage = () => <div>SELECT_ORG_PAGE</div>;

function renderApp(initialRoute: string) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/index" element={<Index />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute requireOrganization={false}>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route path="/select-organization" element={<SelectOrgPage />} />
        <Route path="*" element={<Navigate to="/index" replace />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setLoggedOut() {
  authState.user = null;
  authState.isLoading = false;
  authState.userDataReady = true;
  authState.userRoles = [];
  authState.currentOrganization = null;
}

function setLoggedIn(withOrg = true) {
  authState.user = { id: "user-1" };
  authState.isLoading = false;
  authState.userDataReady = true;
  authState.userRoles = withOrg ? [{ organization_id: "org-1", role: "owner" }] : [];
  authState.currentOrganization = withOrg ? { id: "org-1", name: "Org" } : null;
}

beforeEach(() => {
  setLoggedOut();
});

// ---- Tests -------------------------------------------------------------
describe("/index routing", () => {
  it("redirects unauthenticated users to /auth", () => {
    renderApp("/index");
    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });

  it("never sends unauthenticated users to onboarding", () => {
    renderApp("/index");
    expect(screen.queryByText("ONBOARDING_PAGE")).not.toBeInTheDocument();
  });

  it("redirects authenticated users to /dashboard", () => {
    setLoggedIn();
    renderApp("/index");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeInTheDocument();
  });

  it("shows a loading state while the session is resolving", () => {
    authState.isLoading = true;
    renderApp("/index");
    expect(screen.getByText("جاري التحميل...")).toBeInTheDocument();
    expect(screen.queryByText("AUTH_PAGE")).not.toBeInTheDocument();
  });
});

describe("/dashboard protection", () => {
  it("redirects to /auth when logged out", () => {
    renderApp("/dashboard");
    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });

  it("renders the dashboard for an authenticated user with an organization", () => {
    setLoggedIn();
    renderApp("/dashboard");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeInTheDocument();
  });

  it("redirects to onboarding when the user has no organizations", () => {
    setLoggedIn(false);
    renderApp("/dashboard");
    expect(screen.getByText("ONBOARDING_PAGE")).toBeInTheDocument();
  });

  it("redirects to organization selection when no org is selected", () => {
    setLoggedIn();
    authState.currentOrganization = null;
    renderApp("/dashboard");
    expect(screen.getByText("SELECT_ORG_PAGE")).toBeInTheDocument();
  });

  it("waits for user data before deciding", () => {
    setLoggedIn();
    authState.userDataReady = false;
    renderApp("/dashboard");
    expect(screen.getByText("جاري التحميل...")).toBeInTheDocument();
  });
});

describe("/auth route", () => {
  it("is reachable without a session", () => {
    renderApp("/auth");
    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });
});

describe("after sign out", () => {
  it("protected routes fall back to /auth once the session is cleared", () => {
    setLoggedIn();
    const { unmount } = renderApp("/dashboard");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeInTheDocument();
    unmount();

    setLoggedOut();
    renderApp("/dashboard");
    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });

  it("/index sends the signed-out user back to login", () => {
    setLoggedIn();
    const { unmount } = renderApp("/index");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeInTheDocument();
    unmount();

    setLoggedOut();
    renderApp("/index");
    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });
});

describe("unknown routes", () => {
  it("fall through to /index and then to login when logged out", () => {
    renderApp("/some/unknown/path");
    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });
});
