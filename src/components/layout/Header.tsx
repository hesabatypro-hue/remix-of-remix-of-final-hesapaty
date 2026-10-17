import { useState } from "react";
import { Bell, Search, User, Crown, Zap, Building2, Home, Check, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const planIcons: Record<string, React.ReactNode> = {
  free: null,
  starter: <Zap className="w-3 h-3" />,
  professional: <Crown className="w-3 h-3" />,
  enterprise: <Building2 className="w-3 h-3" />,
};

const planLabels: Record<string, string> = {
  free: 'مجاني',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const notificationTypeStyles: Record<string, string> = {
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
};

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { profile, currentOrganization, userRoles } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  
  const currentRole = userRoles.find(r => r.organization_id === currentOrganization?.id)?.role;
  
  const roleLabels: Record<string, string> = {
    owner: 'مالك',
    admin: 'مدير',
    manager: 'مشرف',
    viewer: 'مشاهد',
  };

  if (mobileSearchOpen) {
    return (
      <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border md:hidden">
        <div className="flex items-center h-full px-3 gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث..." className="pr-10 bg-muted/50 border-0 focus-visible:ring-primary" autoFocus />
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileSearchOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-full px-3 md:px-6">
        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile search icon */}
          <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground hover:text-foreground" onClick={() => setMobileSearchOpen(true)}>
            <Search className="w-5 h-5" />
          </Button>

          <Link to="/">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Home className="w-5 h-5" />
            </Button>
          </Link>

          {/* Search - desktop */}
          <div className="relative w-80 hidden md:block">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث..." className="pr-10 bg-muted/50 border-0 focus-visible:ring-primary" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Plan Badge - hidden on mobile */}
          {currentOrganization && (
            <Badge 
              variant={currentOrganization.plan_type === 'free' ? 'secondary' : 'default'}
              className="gap-1 hidden sm:flex"
            >
              {planIcons[currentOrganization.plan_type]}
              {planLabels[currentOrganization.plan_type]}
            </Badge>
          )}

          {/* Notifications */}
          <Popover onOpenChange={(open) => { if (open && unreadCount > 0) markAllAsRead.mutate(); }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -left-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <h4 className="font-semibold text-foreground">الإشعارات</h4>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => markAllAsRead.mutate()}
                  >
                    <Check className="w-3 h-3 ml-1" />
                    قراءة الكل
                  </Button>
                )}
              </div>
              <ScrollArea className="h-72">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                    <Bell className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">لا توجد إشعارات</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 hover:bg-muted/50 transition-colors ${
                          !notification.is_read ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-2 h-2 rounded-full mt-2 ${
                              notificationTypeStyles[notification.type] || "bg-gray-500"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: ar,
                              })}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => markAsRead.mutate(notification.id)}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => deleteNotification.mutate(notification.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* User - text hidden on mobile */}
          <div className="flex items-center gap-2 md:gap-3 pr-2 md:pr-3 border-r border-border">
            <div className="text-left hidden md:block">
              <p className="text-sm font-medium text-foreground">
                {profile?.full_name || profile?.email?.split('@')[0] || 'المستخدم'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentRole ? roleLabels[currentRole] : 'عضو'}
              </p>
            </div>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full gradient-secondary flex items-center justify-center">
              <User className="w-4 h-4 md:w-5 md:h-5 text-secondary-foreground" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
