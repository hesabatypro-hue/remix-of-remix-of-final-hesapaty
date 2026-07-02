import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export default function SelectOrganization() {
  const { userRoles, setCurrentOrganization } = useAuth();
  const navigate = useNavigate();

  const roleLabels: Record<string, string> = {
    owner: "مالك",
    admin: "مدير",
    manager: "مشرف",
    viewer: "مشاهد",
  };

  const handleSelect = (role: typeof userRoles[0]) => {
    setCurrentOrganization(role.organization);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <img src={logo} alt="حساباتي" className="w-16 h-16 rounded-2xl mx-auto shadow-md" />
          <h1 className="text-2xl font-bold text-foreground">اختر المؤسسة</h1>
          <p className="text-muted-foreground text-sm">
            حدد المؤسسة التي تريد الدخول إليها
          </p>
        </div>

        {/* Organization Cards */}
        <div className="space-y-3">
          {userRoles.map((role) => (
            <button
              key={role.organization_id}
              onClick={() => handleSelect(role)}
              className="w-full flex items-center gap-4 p-4 bg-card rounded-2xl border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 text-right group"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                {role.organization.logo_url ? (
                  <img
                    src={role.organization.logo_url}
                    alt={role.organization.name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate">{role.organization.name}</p>
                <p className="text-sm text-muted-foreground">{roleLabels[role.role]}</p>
              </div>
              <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
