import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  Store,
  BarChart3,
  Menu,
} from "lucide-react";

const bottomNavItems = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/dashboard" },
  { icon: Receipt, label: "التحويلات", path: "/transfers" },
  { icon: Store, label: "الفروع", path: "/branches" },
  { icon: BarChart3, label: "الإحصائيات", path: "/statistics" },
];

interface BottomNavProps {
  onMoreClick?: () => void;
}

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground active:scale-95"
              )}
            >
              {isActive && (
                <span className="absolute top-0 inset-x-4 h-0.5 rounded-b-full bg-primary animate-in fade-in slide-in-from-top-1 duration-200" />
              )}
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200",
                isActive && "stroke-[2.5] scale-110"
              )} />
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive && "font-bold"
              )}>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground active:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">المزيد</span>
        </button>
      </div>
    </nav>
  );
}
