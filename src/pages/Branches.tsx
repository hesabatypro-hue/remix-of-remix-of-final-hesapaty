import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Store,
  MapPin,
  Phone,
  MoreVertical,
  Edit,
  Trash2,
  Power,
  Loader2,
  Plus as PlusIcon,
} from "lucide-react";
import { BranchesSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useBranches, Branch } from "@/hooks/useBranches";
import { useOrganizationLimits } from "@/hooks/useOrganizationLimits";
import { LimitBadge } from "@/components/limits/LimitBadge";
import { UpgradePrompt } from "@/components/limits/UpgradePrompt";
import { useToast } from "@/hooks/use-toast";

export default function Branches() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ name: "", location: "", phone: "" });

  const { branches, isLoading, addBranch, updateBranch, deleteBranch } = useBranches();
  const { limits, canAddBranch, refetch: refetchLimits } = useOrganizationLimits();
  const { toast } = useToast();

  const filteredBranches = branches.filter((branch) =>
    branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (branch.location?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleAddBranch = () => {
    if (!formData.name.trim()) return;
    
    if (!canAddBranch) {
      toast({
        title: "تم الوصول للحد الأقصى",
        description: `لقد وصلت للحد الأقصى من الفروع (${limits?.max_branches}) في خطتك الحالية.`,
        variant: "destructive",
      });
      return;
    }
    
    addBranch.mutate({
      name: formData.name,
      location: formData.location || undefined,
      phone: formData.phone || undefined,
    }, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        setFormData({ name: "", location: "", phone: "" });
        refetchLimits();
      },
      onError: (error: any) => {
        if (error.message?.includes('BRANCH_LIMIT_EXCEEDED')) {
          toast({
            title: "تم الوصول للحد الأقصى",
            description: `لقد وصلت للحد الأقصى من الفروع في خطتك الحالية. قم بترقية خطتك لإضافة المزيد.`,
            variant: "destructive",
          });
        }
      }
    });
  };

  const handleEditBranch = () => {
    if (!selectedBranch || !formData.name.trim()) return;
    updateBranch.mutate({
      id: selectedBranch.id,
      name: formData.name,
      location: formData.location || null,
      phone: formData.phone || null,
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setSelectedBranch(null);
        setFormData({ name: "", location: "", phone: "" });
      }
    });
  };

  const handleDeleteBranch = () => {
    if (!selectedBranch) return;
    deleteBranch.mutate(selectedBranch.id, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        setSelectedBranch(null);
        refetchLimits();
      }
    });
  };

  const handleToggleStatus = (branch: Branch) => {
    updateBranch.mutate({
      id: branch.id,
      is_active: !branch.is_active,
    });
  };

  const openEditDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location || "",
      phone: branch.phone || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDeleteDialogOpen(true);
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة الفروع</h1>
          <p className="text-muted-foreground mt-1">
            إضافة وإدارة جميع فروع البقالات
          </p>
        </div>
        <div className="flex items-center gap-3">
          {limits && (
            <LimitBadge 
              current={limits.current_branches} 
              max={limits.max_branches} 
              label="الفروع" 
            />
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!canAddBranch}>
                <Plus className="w-4 h-4" />
                إضافة فرع جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
              <DialogTitle>إضافة فرع جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الفرع *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="أدخل اسم الفرع"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">الموقع</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="أدخل موقع الفرع"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="أدخل رقم الهاتف"
                  dir="ltr"
                />
              </div>
              <Button 
                onClick={handleAddBranch} 
                className="w-full"
                disabled={addBranch.isPending || !formData.name.trim()}
              >
                {addBranch.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : null}
                إضافة الفرع
              </Button>
            </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Upgrade Prompt when at limit */}
      {limits && !canAddBranch && (
        <div className="mb-6">
          <UpgradePrompt 
            type="branches" 
            current={limits.current_branches} 
            max={limits.max_branches} 
          />
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن فرع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 bg-muted/50 border-0"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <BranchesSkeleton />
      ) : filteredBranches.length === 0 ? (
        <EmptyState
          icon={Store}
          title="لا توجد فروع بعد"
          description="أضف فرعك الأول لبدء تتبع الإيرادات. كل فرع يمكن ربطه بواتساب لاستقبال التحويلات تلقائياً."
          actionLabel="إضافة أول فرع"
          onAction={() => setIsAddDialogOpen(true)}
        />
      ) : (
        /* Branches Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBranches.map((branch, index) => (
            <div
              key={branch.id}
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
                        branch.is_active
                          ? "gradient-primary"
                          : "bg-muted"
                      )}
                    >
                      <Store
                        className={cn(
                          "w-6 h-6",
                          branch.is_active
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{branch.name}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          branch.is_active
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {branch.is_active ? "نشط" : "متوقف"}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem className="gap-2" onClick={() => openEditDialog(branch)}>
                        <Edit className="w-4 h-4" />
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => handleToggleStatus(branch)}>
                        <Power className="w-4 h-4" />
                        {branch.is_active ? "تعطيل" : "تفعيل"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive" onClick={() => openDeleteDialog(branch)}>
                        <Trash2 className="w-4 h-4" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Info */}
              <div className="p-5 space-y-3">
                {branch.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{branch.location}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span dir="ltr">{branch.phone}</span>
                  </div>
                )}
                {!branch.location && !branch.phone && (
                  <p className="text-sm text-muted-foreground">لا توجد معلومات إضافية</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  أُضيف في {new Date(branch.created_at).toLocaleDateString('ar-SA')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الفرع</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">اسم الفرع *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="أدخل اسم الفرع"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">الموقع</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="أدخل موقع الفرع"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">رقم الهاتف</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="أدخل رقم الهاتف"
                dir="ltr"
              />
            </div>
            <Button 
              onClick={handleEditBranch} 
              className="w-full"
              disabled={updateBranch.isPending || !formData.name.trim()}
            >
              {updateBranch.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : null}
              حفظ التعديلات
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل تريد حذف الفرع "{selectedBranch?.name}"؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الفرع وجميع اتصالات واتساب المرتبطة به. التحويلات السابقة ستبقى محفوظة. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBranch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBranch.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
