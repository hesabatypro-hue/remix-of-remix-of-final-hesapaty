import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Search, X, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (chatId: string | null, chatName: string | null) => void;
}

interface Group {
  id: string;
  name: string;
  participantsCount?: number;
}

export function BranchGroupPicker({ value, onChange }: Props) {
  const { currentOrganization } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [q, setQ] = useState("");
  const [linkedBranches, setLinkedBranches] = useState<Record<string, string>>({});

  const loadGroups = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      // Find the org's first green_api connection to source groups from
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("id")
        .eq("organization_id", currentOrganization.id)
        .eq("connection_type", "green_api")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

      if (!conn) {
        toast({
          title: "لا يوجد اتصال واتساب نشط",
          description: "يجب ربط رقم واتساب واحد على الأقل عبر Green API قبل ربط مجموعة بفرع.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("fetch-whatsapp-groups", {
        body: { connectionId: conn.id },
      });
      if (error) throw error;
      setGroups(data?.groups || []);

      // Fetch existing branch↔group links to warn about conflicts
      const { data: linked } = await supabase
        .from("branches")
        .select("name, whatsapp_chat_id")
        .eq("organization_id", currentOrganization.id)
        .eq("is_deleted", false)
        .not("whatsapp_chat_id", "is", null);
      const map: Record<string, string> = {};
      for (const b of linked || []) if (b.whatsapp_chat_id) map[b.whatsapp_chat_id] = b.name;
      setLinkedBranches(map);
    } catch (e: any) {
      toast({ title: "فشل جلب المجموعات", description: e?.message || "حاول مجدداً", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadGroups();
  }, [open]);

  const filtered = groups.filter(g => g.name.toLowerCase().includes(q.toLowerCase()) || g.id.includes(q));

  const currentName = value ? (linkedBranches[value] === undefined ? value : `مجموعة مربوطة`) : null;

  return (
    <div className="space-y-2">
      <Label>مجموعة واتساب المرتبطة (اختياري)</Label>
      {value ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
          <Link2 className="w-4 h-4 text-success shrink-0" />
          <div className="flex-1 text-sm">
            <div className="font-medium">مربوط بمجموعة</div>
            <div className="text-xs text-muted-foreground truncate" dir="ltr">{value}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onChange(null, null)} type="button">
            <X className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} type="button">تغيير</Button>
        </div>
      ) : (
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setOpen(true)} type="button">
          <Users className="w-4 h-4" />
          اختر مجموعة واتساب لهذا الفرع
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        عند ربط مجموعة، أي إشعار دفع يصل إليها يُسجَّل كإيراد لهذا الفرع تلقائياً — يمكن استخدام نفس رقم الواتساب لعدة فروع بمجموعات مختلفة.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>اختر مجموعة الفرع</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث عن مجموعة..." value={q} onChange={e => setQ(e.target.value)} className="pr-10" />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">لا توجد مجموعات</p>
              ) : (
                filtered.map(g => {
                  const takenBy = linkedBranches[g.id];
                  const isSelf = value === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { onChange(g.id, g.name); setOpen(false); }}
                      className={cn(
                        "w-full text-right p-3 rounded-lg border transition-colors",
                        isSelf ? "bg-primary/10 border-primary" : "hover:bg-muted border-border"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{g.name}</div>
                          <div className="text-xs text-muted-foreground truncate" dir="ltr">{g.id}</div>
                          {takenBy && !isSelf && (
                            <div className="text-xs text-amber-600 mt-1">⚠️ مربوطة حالياً بفرع "{takenBy}" — سيتم نقل الربط</div>
                          )}
                        </div>
                        {g.participantsCount ? (
                          <span className="text-xs text-muted-foreground shrink-0">{g.participantsCount} عضو</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
