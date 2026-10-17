import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, MessageCircle, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface WhatsAppGroup {
  id: string;
  name: string;
  participantsCount?: number;
}

interface GroupFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  connectionType: string;
  currentChatId: string | null;
  currentChatName: string | null;
}

export function GroupFilterDialog({
  open,
  onOpenChange,
  connectionId,
  connectionType,
  currentChatId,
  currentChatName,
}: GroupFilterDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-whatsapp-groups", {
        body: { connectionId },
      });

      console.log("fetch-whatsapp-groups response:", { data, error });

      if (error) throw error;

      if (data?.message) {
        toast({ title: "تنبيه", description: data.message });
      }

      const fetchedGroups = data?.groups || [];
      setGroups(fetchedGroups);
      setLoaded(true);
      
      if (fetchedGroups.length === 0 && !data?.message) {
        toast({ title: "تنبيه", description: "لا توجد مجموعات في هذا الحساب" });
      }
    } catch (err: any) {
      console.error("fetch-whatsapp-groups error:", err);
      toast({ title: "خطأ", description: err?.message || "فشل في جلب المجموعات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (chatId: string | null, chatName: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_connections")
        .update({
          monitored_chat_id: chatId,
          monitored_chat_name: chatName,
        })
        .eq("id", connectionId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["whatsapp-connections", currentOrganization?.id] });
      toast({
        title: "تم بنجاح",
        description: chatId ? `تم تخصيص المراقبة لمجموعة: ${chatName}` : "تم إلغاء فلتر المجموعة — سيتم مراقبة جميع الدردشات",
      });
      onOpenChange(false);
    } catch {
      toast({ title: "خطأ", description: "فشل في حفظ التخصيص", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !loaded) {
      fetchGroups();
    }
  };

  useEffect(() => {
    if (open && !loaded && !loading) {
      fetchGroups();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            تخصيص مجموعة للمراقبة
          </DialogTitle>
          <DialogDescription className="text-right">
            اختر مجموعة واتساب محددة لاستقبال إيصالات التحويل منها فقط
          </DialogDescription>
        </DialogHeader>

        {currentChatId && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{currentChatName || currentChatId}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelect(null, null)}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4 ml-1" />
              إلغاء الفلتر
            </Button>
          </div>
        )}

        {connectionType !== "green_api" && (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>فلترة المجموعات متاحة حالياً لاتصالات Green API فقط</p>
          </div>
        )}

        {connectionType === "green_api" && (
          <>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن مجموعة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
                dir="rtl"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="mr-2 text-sm text-muted-foreground">جاري جلب المجموعات...</span>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {/* Option to monitor all chats */}
                  <button
                    onClick={() => handleSelect(null, null)}
                    disabled={saving || !currentChatId}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-right ${
                      !currentChatId
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-muted border-border"
                    } disabled:opacity-50`}
                  >
                    <MessageCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">جميع الدردشات</p>
                      <p className="text-xs text-muted-foreground">استقبال من جميع المصادر</p>
                    </div>
                    {!currentChatId && <Badge className="bg-primary/20 text-primary border-0 text-xs">مفعّل</Badge>}
                  </button>

                  {filteredGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleSelect(group.id, group.name)}
                      disabled={saving}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-right ${
                        currentChatId === group.id
                          ? "bg-primary/10 border-primary/30"
                          : "hover:bg-muted border-border"
                      } disabled:opacity-50`}
                    >
                      <Users className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{group.name}</p>
                        {group.participantsCount && (
                          <p className="text-xs text-muted-foreground">{group.participantsCount} عضو</p>
                        )}
                      </div>
                      {currentChatId === group.id && (
                        <Badge className="bg-primary/20 text-primary border-0 text-xs">مفعّل</Badge>
                      )}
                    </button>
                  ))}

                  {loaded && filteredGroups.length === 0 && !loading && (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      {search ? "لا توجد مجموعات تطابق البحث" : "لا توجد مجموعات في هذا الحساب"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {!loading && loaded && (
              <Button variant="outline" size="sm" onClick={fetchGroups} className="w-full">
                تحديث القائمة
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
