import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LayoutDashboard,
  Store,
  Receipt,
  FileText,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  MessageCircle,
  Building2,
  ScrollText,
  BarChart3,
  Activity,
  ShieldAlert,
  Wallet,
  UserCog,
  Banknote,
  Printer,
  TrendingUp,
  FileSpreadsheet,
  CreditCard,
  ShoppingCart,
  Package,
  Boxes,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import logo from "@/assets/logo.png";

interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  printingOnly?: boolean;
  investmentOnly?: boolean;
  invoicingOnly?: boolean;
  posOnly?: boolean;
  hideWhenPOS?: boolean;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/dashboard" },
  { icon: ShoppingCart, label: "نقطة البيع", path: "/pos", posOnly: true },
  { icon: Package, label: "المنتجات", path: "/products", posOnly: true },
  { icon: Boxes, label: "المخزون", path: "/inventory", posOnly: true },
  { icon: Store, label: "الفروع", path: "/branches" },
  { icon: Receipt, label: "التحويلات", path: "/transfers", hideWhenPOS: true },
  { icon: ShieldAlert, label: "المراجعة البشرية", path: "/review", hideWhenPOS: true },
  { icon: Wallet, label: "المصروفات", path: "/expenses" },
  { icon: UserCog, label: "الموظفين", path: "/employees" },
  { icon: Banknote, label: "الرواتب", path: "/salaries" },
  { icon: Printer, label: "أوامر التشغيل", path: "/print-orders", printingOnly: true },
  { icon: TrendingUp, label: "الاستثمار والائتمان", path: "/investments", investmentOnly: true },
  { icon: FileSpreadsheet, label: "الفواتير", path: "/invoices", invoicingOnly: true },
  { icon: CreditCard, label: "فواتير الاشتراك", path: "/subscription-invoices" },
  { icon: BarChart3, label: "الإحصائيات", path: "/statistics" },
  { icon: FileText, label: "تقارير الإيرادات", path: "/reports" },
  { icon: FileText, label: "التقارير المالية", path: "/financial-reports" },
  { icon: Users, label: "المستخدمين", path: "/users" },
  { icon: MessageCircle, label: "واتساب", path: "/whatsapp" },
  { icon: ScrollText, label: "سجل الرسائل", path: "/whatsapp-logs" },
  { icon: Activity, label: "مراقبة المعالجة", path: "/processing" },
  { icon: Building2, label: "المؤسسة", path: "/organization" },
  { icon: Settings, label: "الإعدادات", path: "/settings" },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="right" className="w-72 p-0">
          <SidebarContent onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return <DesktopSidebar />;
}

function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out",
        "bg-card border-l border-border shadow-soft",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
    </aside>
  );
}

interface SidebarContentProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

function SidebarContent({ collapsed = false, onToggleCollapse, onNavigate }: SidebarContentProps) {
  const location = useLocation();
  const { signOut, currentOrganization, userRoles, setCurrentOrganization, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const currentRole = userRoles.find(r => r.organization_id === currentOrganization?.id)?.role;

  const roleLabels: Record<string, string> = {
    owner: 'مالك',
    admin: 'مدير',
    manager: 'مشرف',
    cashier: 'كاشير',
    viewer: 'مشاهد',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo & Organization Switcher */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 transition-colors w-full">
              <img
                src={logo}
                alt="حساباتي"
                className="w-10 h-10 rounded-xl object-cover shadow-sm shrink-0"
              />
              <div className="text-right flex-1 min-w-0">
                <h1 className="font-bold text-foreground truncate text-sm">
                  {currentOrganization?.name || 'حساباتي'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {currentRole ? roleLabels[currentRole] : 'إدارة الإيرادات'}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>المؤسسات</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {userRoles.map((role) => (
                <DropdownMenuItem
                  key={role.organization_id}
                  onClick={() => setCurrentOrganization(role.organization)}
                  className={cn(
                    "cursor-pointer",
                    currentOrganization?.id === role.organization_id && "bg-primary/10"
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {role.organization.logo_url ? (
                        <img
                          src={role.organization.logo_url}
                          alt={role.organization.name}
                          className="w-full h-full rounded-lg object-cover"
                        />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{role.organization.name}</p>
                      <p className="text-xs text-muted-foreground">{roleLabels[role.role]}</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {collapsed && (
          <img
            src={logo}
            alt="حساباتي"
            className="w-10 h-10 rounded-xl object-cover shadow-sm mx-auto"
          />
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
          >
            <ChevronRight
              className={cn(
                "w-5 h-5 text-muted-foreground transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {menuItems
          .filter((item) => !item.printingOnly || currentOrganization?.industry_type === 'printing')
          .filter((item) => !item.investmentOnly || currentOrganization?.investment_enabled === true)
          .filter((item) => !item.invoicingOnly || currentOrganization?.invoicing_enabled === true)
          .filter((item) => !item.posOnly || (currentOrganization as any)?.is_pos_enabled === true)
          .filter((item) => !item.hideWhenPOS || (currentOrganization as any)?.is_pos_enabled !== true)
          .map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                "hover:bg-muted group",
                isActive && "gradient-primary text-primary-foreground shadow-md"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && (
                <span
                  className={cn(
                    "font-medium",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-border">
        {!collapsed && profile && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-foreground truncate">
              {profile.full_name || profile.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-3 rounded-xl",
            "hover:bg-destructive/10 text-destructive transition-colors"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="font-medium">تسجيل الخروج</span>}
        </button>
      </div>
    </div>
  );
}
