import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { logAuthNav } from '@/lib/authNavLogger';

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrganization?: boolean;
}

export function ProtectedRoute({ children, requireOrganization = true }: ProtectedRouteProps) {
  const { user, isLoading, currentOrganization, userRoles, userDataReady } = useAuth();
  const location = useLocation();

  if (isLoading || (user && !userDataReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    logAuthNav('redirect_from_protected', {
      from: location.pathname,
      to: '/auth',
      meta: { reason: 'no_user' },
    });
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If user has no organizations, redirect to onboarding
  if (requireOrganization && userRoles.length === 0) {
    logAuthNav('redirect_to_onboarding', {
      from: location.pathname,
      to: '/onboarding',
      userId: user.id,
      meta: { reason: 'no_user_roles', source: 'ProtectedRoute', userDataReady },
    });
    return <Navigate to="/onboarding" replace />;
  }

  // If requireOrganization but no current org selected
  if (requireOrganization && !currentOrganization && userRoles.length > 0) {
    logAuthNav('redirect_from_protected', {
      from: location.pathname,
      to: '/select-organization',
      userId: user.id,
      meta: { reason: 'no_current_org', userRolesCount: userRoles.length },
    });
    return <Navigate to="/select-organization" replace />;
  }

  return <>{children}</>;
}

