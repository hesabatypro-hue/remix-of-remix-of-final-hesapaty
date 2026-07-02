import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { logLoginEvent } from '@/hooks/useLoginHistory';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan_type: string;
  subscription_status: string;
  max_branches: number;
  max_users: number;
  created_at: string;
  industry_type: string;
  investment_enabled?: boolean;
  invoicing_enabled?: boolean;
}

interface UserRole {
  organization_id: string;
  role: 'owner' | 'admin' | 'manager' | 'viewer';
  branch_id: string | null;
  organization: Organization;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRoles: UserRole[];
  currentOrganization: Organization | null;
  currentRole: UserRole | null;
  isLoading: boolean;
  userDataReady: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userDataReady, setUserDataReady] = useState(false);

  const fetchUserData = async (userId: string) => {
    try {
      setUserDataReady(false);

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData);
      }

      // Fetch user roles with organizations
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select(`
          organization_id,
          role,
          branch_id,
          organization:organizations(
            id,
            name,
            slug,
            logo_url,
            plan_type,
            subscription_status,
            max_branches,
            max_users,
            created_at,
            industry_type,
            investment_enabled,
            invoicing_enabled
          )
        `)
        .eq('user_id', userId);

      if (!rolesData) {
        setUserRoles([]);
        setCurrentOrganization(null);
        return;
      }

      if (rolesData.length > 0) {
        const roles = rolesData.map((r: any) => ({
          organization_id: r.organization_id,
          role: r.role,
          branch_id: r.branch_id || null,
          organization: r.organization
        }));
        setUserRoles(roles);

        // Set first organization as current if none selected
        const savedOrgId = localStorage.getItem('currentOrganizationId');
        const savedOrg = roles.find(r => r.organization.id === savedOrgId);
        
        if (savedOrg) {
          setCurrentOrganization(savedOrg.organization);
        } else if (roles[0]?.organization) {
          setCurrentOrganization(roles[0].organization);
          localStorage.setItem('currentOrganizationId', roles[0].organization.id);
        }
      } else {
        setUserRoles([]);
        setCurrentOrganization(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setUserDataReady(true);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Keep loading true until both (1) auth session is known and (2) user data is fetched.
    const loadUserData = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setUserRoles([]);
        setCurrentOrganization(null);
        setUserDataReady(true);
        setIsLoading(false);
        return;
      }

      try {
        await fetchUserData(nextSession.user.id);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    setIsLoading(true);

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Avoid deadlocks by deferring any Supabase calls
      setIsLoading(true);
      setTimeout(() => {
        loadUserData(nextSession);
      }, 0);
    });

    // THEN check for existing session
    supabase.auth
      .getSession()
      .then(({ data: { session: existingSession } }) => {
        loadUserData(existingSession);
      })
      .catch(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSetCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganization(org);
    // Clear all cached data to prevent cross-org data leakage
    queryClient.clear();
    if (org) {
      localStorage.setItem('currentOrganizationId', org.id);
    } else {
      localStorage.removeItem('currentOrganizationId');
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName
        }
      }
    });
    
    return { error: error ? new Error(error.message) : null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      // Log failed attempt - we don't have user id so skip
      return { error: new Error(error.message) };
    }
    
    if (data.user) {
      logLoginEvent(data.user.id, 'login', true);
    }

    // MFA Challenge: if user has a verified TOTP factor, require aal2
    const { data: mfaData } = await supabase.auth.mfa.listFactors();
    const verifiedFactor = mfaData?.totp?.find((f) => f.status === 'verified');
    if (verifiedFactor) {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== 'aal2') {
        return { error: null, mfaRequired: true, factorId: verifiedFactor.id };
      }
    }
    
    return { error: null, mfaRequired: false };
  };

  const signOut = async () => {
    if (user) {
      logLoginEvent(user.id, 'logout', true);
    }
    await supabase.auth.signOut();
    setProfile(null);
    setUserRoles([]);
    setCurrentOrganization(null);
    localStorage.removeItem('currentOrganizationId');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRoles,
        currentOrganization,
        currentRole: currentOrganization 
          ? userRoles.find(r => r.organization_id === currentOrganization.id) || null 
          : null,
        isLoading,
        userDataReady,
        signUp,
        signIn,
        signOut,
        setCurrentOrganization: handleSetCurrentOrganization,
        refreshUserData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
