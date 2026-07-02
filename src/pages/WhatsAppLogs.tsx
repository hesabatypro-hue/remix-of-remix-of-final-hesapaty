import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Image,
  MessageSquare,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface WhatsAppMessage {
  id: string;
  message_id: string;
  from_number: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
  whatsapp_connection_id: string;
  organization_id: string | null;
}

// Determine processing status reason based on message data
function getProcessingStatus(message: WhatsAppMessage): {
  status: 'success' | 'pending' | 'skipped' | 'error';
  reason: string;
  reasonCode: string;
} {
  if (message.processed) {
    return {
      status: 'success',
      reason: 'تم استخراج البيانات وإنشاء التحويل',
      reasonCode: 'processed_success'
    };
  }

  // Not processed - determine why
  if (message.message_type !== 'image' && message.message_type !== 'imageMessage') {
    return {
      status: 'skipped',
      reason: 'ليست صورة - تم تجاهلها',
      reasonCode: 'not_image'
    };
  }

  if (!message.media_url) {
    return {
      status: 'error',
      reason: 'لا يوجد رابط تحميل للصورة',
      reasonCode: 'no_download_url'
    };
  }

  // Image message but not processed
  return {
    status: 'pending',
    reason: 'لم يتم استخراج مبلغ صالح من الصورة',
    reasonCode: 'no_amount_extracted'
  };
}

function StatusBadge({ status, reason }: { status: string; reason: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    success: { variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
    pending: { variant: "secondary", icon: <Clock className="w-3 h-3" /> },
    skipped: { variant: "outline", icon: <AlertTriangle className="w-3 h-3" /> },
    error: { variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
  };

  const config = variants[status] || variants.pending;

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      <span className="text-xs">{reason}</span>
    </Badge>
  );
}

function MessageTypeBadge({ type }: { type: string }) {
  const isImage = type === 'image' || type === 'imageMessage';
  
  return (
    <Badge variant="outline" className="gap-1">
      {isImage ? <Image className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
      <span>{isImage ? 'صورة' : type}</span>
    </Badge>
  );
}

export default function WhatsAppLogs() {
  const { currentOrganization } = useAuth();

  const { data: messages, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['whatsapp-messages', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!currentOrganization?.id,
  });

  const stats = {
    total: messages?.length || 0,
    processed: messages?.filter(m => m.processed).length || 0,
    images: messages?.filter(m => m.message_type === 'image' || m.message_type === 'imageMessage').length || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">سجل رسائل WhatsApp</h1>
            <p className="text-muted-foreground text-sm">
              مراقبة وتشخيص معالجة الرسائل الواردة
            </p>
          </div>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm"
            disabled={isRefetching}
          >
            <RefreshCw className={`w-4 h-4 ml-2 ${isRefetching ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                إجمالي الرسائل
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                الصور المستلمة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.images}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                تم المعالجة بنجاح
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.processed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Messages Table */}
        <Card>
          <CardHeader>
            <CardTitle>آخر 100 رسالة</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">رقم المرسل</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">حالة المعالجة</TableHead>
                      <TableHead className="text-right">وقت المعالجة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => {
                      const processingStatus = getProcessingStatus(message);
                      return (
                        <TableRow key={message.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(message.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ar })}
                          </TableCell>
                          <TableCell className="font-mono">
                            {message.from_number}
                          </TableCell>
                          <TableCell>
                            <MessageTypeBadge type={message.message_type} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge 
                              status={processingStatus.status} 
                              reason={processingStatus.reason} 
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {message.processed_at 
                              ? format(new Date(message.processed_at), 'HH:mm:ss', { locale: ar })
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد رسائل بعد</p>
                <p className="text-sm">ستظهر الرسائل هنا عند استلامها من WhatsApp</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
