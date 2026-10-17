import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  User,
  Mail,
  Phone,
  MoreVertical,
  Trash2,
  Shield,
  ShieldCheck,
  Users as UsersIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LimitBadge } from "@/components/limits/LimitBadge";
import { UpgradePrompt } from "@/components/limits/UpgradePrompt";
import { useOrganizationLimits } from "@/hooks/useOrganizationLimits";
import { useBranches } from "@/hooks/useBranches";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  owner: "مالك",
  admin: "مدير النظام",
  manager: "مدير",
  viewer: "مشاهد",
};

const roleColors: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  admin: "bg-warning/10 text-warning",
  manager: "bg-accent/10 text-accent-foreground",
  viewer: "bg-muted text-muted-foreground",
};

type UserWithProfile = {
  id: string;
  user_id: string;
  role: string;
  branch_id: string | null;
  created_at: string;
  profile: {
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  branch?: { name: string } | null;
};

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("viewer");
  const [inviteBranchId, setInviteBranchId] = useState<string>("");
  const [userToRemove, setUserToRemove] = useState<UserWithProfile | null>(null);
  const [roleChangeUser, setRoleChangeUser] = useState<UserWithProfile | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  
  const { currentOrganization } = useAuth();
  const { limits, canAddUser } = useOrganizationLimits();
  const queryClient = useQueryClient();
  const { branches } = useBranches();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["organization-users", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, branch_id, created_at")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: true });

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      const branchIds = roles.filter(r => r.branch_id).map(r => r.branch_id!);
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Fetch branch names for assigned branches
      let branchMap = new Map<string, string>();
      if (branchIds.length > 0) {
        const { data: branchesData } = await supabase
          .from("branches")
          .select("id, name")
          .in("id", branchIds);
        branchMap = new Map(branchesData?.map(b => [b.id, b.name]) || []);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return roles.map(role => ({
        ...role,
        profile: profileMap.get(role.user_id) || null,
        branch: role.branch_id ? { name: branchMap.get(role.branch_id) || "غير محدد" } : null,
      })) as UserWithProfile[];
    },
    enabled: !!currentOrganization?.id,
  });

  const removeUserMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-users"] });
      toast.success("تم إزالة المستخدم بنجاح");
      setUserToRemove(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إزالة المستخدم");
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ roleId, role }: { roleId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: role as any })
        .eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-users"] });
      toast.success("تم تغيير الصلاحية بنجاح");
      setRoleChangeUser(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء تغيير الصلاحية");
    },
  });

  const handleInvite = () => {
    // For now, show a message that invite via email is coming soon
    toast.info("ميزة الدعوة عبر البريد قيد التطوير. يرجى إضافة المستخدم يدوياً من خلال تسجيله في النظام ثم إضافة دوره.");
    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteRole("viewer");
  };

  const filteredUsers = users.filter(
    (user) =>
      user.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-muted-foreground mt-1">
            إضافة وإدارة مستخدمي النظام والصلاحيات
          </p>
        </div>
        <div className="flex items-center gap-3">
          {limits && (
            <LimitBadge
              current={limits.current_users}
              max={limits.max_users}
              label="المستخدمين"
            />
          )}
          <Button className="gap-2" disabled={!canAddUser} onClick={() => setIsInviteOpen(true)}>
            <Plus className="w-4 h-4" />
            دعوة مستخدم
          </Button>
        </div>
      </div>

      {/* Upgrade Prompt */}
      {!canAddUser && limits && (
        <UpgradePrompt
          type="users"
          current={limits.current_users}
          max={limits.max_users}
        />
      )}

      {/* Search */}
      <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن مستخدم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 bg-muted/50 border-0"
          />
        </div>
      </div>

      {/* Users Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-12 text-center">
          <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {users.length === 0 ? "لا يوجد مستخدمين" : "لا توجد نتائج"}
          </h3>
          <p className="text-muted-foreground">
            {users.length === 0
              ? "قم بدعوة أعضاء فريقك للانضمام إلى المؤسسة"
              : "جرب البحث بكلمات مختلفة"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredUsers.map((user, index) => (
            <div
              key={user.id}
              className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300 animate-scale-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        user.role === "owner" || user.role === "admin"
                          ? "gradient-primary"
                          : "bg-muted"
                      )}
                    >
                      {user.role === "owner" || user.role === "admin" ? (
                        <ShieldCheck className="w-6 h-6 text-primary-foreground" />
                      ) : (
                        <User className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">
                        {user.profile?.full_name || "بدون اسم"}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={cn("text-xs", roleColors[user.role])}
                      >
                        {roleLabels[user.role]}
                      </Badge>
                    </div>
                  </div>
                  {user.role !== "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => {
                            setRoleChangeUser(user);
                            setNewRole(user.role);
                          }}
                        >
                          <Shield className="w-4 h-4" />
                          تغيير الصلاحية
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 text-destructive"
                          onClick={() => setUserToRemove(user)}
                        >
                          <Trash2 className="w-4 h-4" />
                          إزالة
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span dir="ltr">{user.profile?.email || "-"}</span>
                </div>
                {user.profile?.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span dir="ltr">{user.profile.phone}</span>
                  </div>
                )}
                {user.branch && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                      🏪 {user.branch.name}
                    </Badge>
                  </div>
                )}
                {!user.branch && (user.role === "manager" || user.role === "viewer") && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs border-warning/50 text-warning">
                      جميع الفروع
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>دعوة مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input 
                placeholder="user@example.com" 
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>الصلاحية</Label>
              <Select value={inviteRole} onValueChange={(val) => {
                setInviteRole(val);
                // Reset branch when selecting admin (admins see all)
                if (val === "admin") setInviteBranchId("");
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير النظام</SelectItem>
                  <SelectItem value="manager">مدير</SelectItem>
                  <SelectItem value="viewer">مشاهد</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(inviteRole === "manager" || inviteRole === "viewer") && (
              <div className="space-y-2">
                <Label>تخصيص فرع (اختياري)</Label>
                <Select value={inviteBranchId} onValueChange={setInviteBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  عند تحديد فرع، سيرى المستخدم بيانات هذا الفرع فقط
                </p>
              </div>
            )}
            <Button className="w-full" onClick={handleInvite} disabled={!inviteEmail}>
              إرسال الدعوة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!roleChangeUser} onOpenChange={() => setRoleChangeUser(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير صلاحية {roleChangeUser?.profile?.full_name || ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الصلاحية الجديدة</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير النظام</SelectItem>
                  <SelectItem value="manager">مدير</SelectItem>
                  <SelectItem value="viewer">مشاهد</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full" 
              onClick={() => roleChangeUser && changeRoleMutation.mutate({ roleId: roleChangeUser.id, role: newRole })}
              disabled={changeRoleMutation.isPending || newRole === roleChangeUser?.role}
            >
              {changeRoleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حفظ التغيير
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove User Confirmation */}
      <AlertDialog open={!!userToRemove} onOpenChange={() => setUserToRemove(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إزالة {userToRemove?.profile?.full_name || userToRemove?.profile?.email} من المؤسسة؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => userToRemove && removeUserMutation.mutate(userToRemove.id)}
              disabled={removeUserMutation.isPending}
            >
              {removeUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              إزالة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
