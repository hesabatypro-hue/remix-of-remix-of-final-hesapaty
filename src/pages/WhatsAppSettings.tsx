import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageCircle, 
  Plus, 
  Settings, 
  CheckCircle, 
  XCircle,
  Phone,
  Store,
  Trash2,
  Link,
  Unlink,
  Loader2,
  Key,
  Zap,
  Upload,
  QrCode,
  Smartphone,
  Shield,
  DollarSign,
  Power,
  Users
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { useBranches } from "@/hooks/useBranches";
import { useWhatsAppConnections, WhatsAppConnection } from "@/hooks/useWhatsAppConnections";
import { useGreenApiConnection } from "@/hooks/useGreenApiConnection";
import { useMetaApiConnection } from "@/hooks/useMetaApiConnection";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { QuickUpload } from "@/components/QuickUpload";
import { MetaUsageTracker } from "@/components/whatsapp/MetaUsageTracker";
import { MetaApiSetupGuide } from "@/components/whatsapp/MetaApiSetupGuide";
import { GroupFilterDialog } from "@/components/whatsapp/GroupFilterDialog";

const getFunctionUrl = (functionName: string) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) return "";
  return new URL(`/functions/v1/${functionName}`, baseUrl).toString();
};

const WhatsAppSettings = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<"meta" | "green_api">("meta");
  const [groupFilterConnectionId, setGroupFilterConnectionId] = useState<string | null>(null);
  
  // Meta API fields
  const [selectedBranch, setSelectedBranch] = useState("");
  const [customBranchName, setCustomBranchName] = useState("");
  const [useCustomBranch, setUseCustomBranch] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");

  // Green API fields
  const [greenInstanceId, setGreenInstanceId] = useState("");
  const [greenApiToken, setGreenApiToken] = useState("");

  const { branches, isLoading: branchesLoading, addBranch } = useBranches();
  const { 
    connections, 
    isLoading: connectionsLoading,
    addConnection,
    updateConnectionStatus,
    deleteConnection,
    verifyConnection,
    testConnection,
    toggleConfirmationNotifications,
  } = useWhatsAppConnections();

  const {
    addGreenApiConnection,
    testGreenApiConnection,
    setupGreenApiWebhook,
    activateConnection,
  } = useGreenApiConnection();

  const {
    addMetaConnection,
    testMetaConnection,
    getMetaWebhookUrl,
  } = useMetaApiConnection();

  const isLoading = branchesLoading || connectionsLoading;

  const getStatusBadge = (status: WhatsAppConnection["status"]) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle className="w-3 h-3 ml-1" />
            متصل
          </Badge>
        );
      case "disconnected":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 ml-1" />
            غير متصل
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Settings className="w-3 h-3 ml-1 animate-spin" />
            في الانتظار
          </Badge>
        );
    }
  };

  const getConnectionTypeBadge = (type: string) => {
    switch (type) {
      case "green_api":
        return (
          <Badge variant="outline" className="text-xs gap-1">
            <QrCode className="w-3 h-3" />
            Green API
            <span className="text-amber-400">($12/شهر)</span>
          </Badge>
        );
      case "meta":
        return (
          <Badge variant="outline" className="text-xs gap-1 border-blue-500/30 text-blue-400">
            <Smartphone className="w-3 h-3" />
            Meta Cloud API
            <span className="text-emerald-400">(مجاني)</span>
          </Badge>
        );
      default:
        return null;
    }
  };

  const getLastSyncText = (lastSyncAt: string | null, status: string) => {
    if (status === 'pending') return "في انتظار الربط";
    if (!lastSyncAt) return "لم تتم المزامنة بعد";
    return formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: ar });
  };

  const resetForm = () => {
    setSelectedBranch("");
    setCustomBranchName("");
    setUseCustomBranch(false);
    setPhoneNumber("");
    setAccessToken("");
    setPhoneNumberId("");
    setGreenInstanceId("");
    setGreenApiToken("");
  };

  const handleAddMetaConnection = async () => {
    if (!phoneNumber || !accessToken || !phoneNumberId) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    let branchIdToUse = selectedBranch;

    if (useCustomBranch) {
      if (!customBranchName.trim()) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال اسم الفرع",
          variant: "destructive",
        });
        return;
      }
      
      try {
        const newBranch = await addBranch.mutateAsync({ name: customBranchName.trim() });
        branchIdToUse = newBranch.id;
      } catch (error) {
        return;
      }
    }

    if (!branchIdToUse) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار فرع أو إدخال اسم فرع جديد",
        variant: "destructive",
      });
      return;
    }

    await addMetaConnection.mutateAsync({ 
      branchId: branchIdToUse, 
      phoneNumber,
      accessToken,
      phoneNumberId,
    });

    setIsDialogOpen(false);
    resetForm();
  };

  const handleTestMetaApi = async () => {
    if (!phoneNumberId || !accessToken) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال Phone Number ID و Access Token",
        variant: "destructive",
      });
      return;
    }

    await testMetaConnection.mutateAsync({
      phoneNumberId,
      accessToken,
    });
  };

  const handleAddGreenApiConnection = async () => {
    if (!phoneNumber || !greenInstanceId || !greenApiToken) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    let branchIdToUse = selectedBranch;

    if (useCustomBranch) {
      if (!customBranchName.trim()) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال اسم الفرع",
          variant: "destructive",
        });
        return;
      }
      
      try {
        const newBranch = await addBranch.mutateAsync({ name: customBranchName.trim() });
        branchIdToUse = newBranch.id;
      } catch (error) {
        return;
      }
    }

    if (!branchIdToUse) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار فرع أو إدخال اسم فرع جديد",
        variant: "destructive",
      });
      return;
    }

    // Setup webhook automatically
    const webhookUrl = getGreenApiWebhookUrl();
    try {
      await setupGreenApiWebhook.mutateAsync({
        instanceId: greenInstanceId,
        apiToken: greenApiToken,
        webhookUrl,
      });
    } catch (error) {
      console.error("Failed to setup webhook:", error);
    }

    await addGreenApiConnection.mutateAsync({ 
      branchId: branchIdToUse, 
      phoneNumber,
      instanceId: greenInstanceId,
      apiToken: greenApiToken,
    });

    setIsDialogOpen(false);
    resetForm();
  };

  const handleTestGreenApi = async () => {
    if (!greenInstanceId || !greenApiToken) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال Instance ID و API Token",
        variant: "destructive",
      });
      return;
    }

    await testGreenApiConnection.mutateAsync({
      instanceId: greenInstanceId,
      apiToken: greenApiToken,
    });
  };

  const handleDisconnect = async (id: string) => {
    await updateConnectionStatus.mutateAsync({ id, status: 'disconnected' });
  };

  const handleReconnect = async (id: string) => {
    await updateConnectionStatus.mutateAsync({ id, status: 'pending' });
  };

  const handleDelete = async (id: string) => {
    await deleteConnection.mutateAsync(id);
  };

  const handleTestConnection = async (id: string) => {
    await testConnection.mutateAsync(id);
  };

  const getWebhookUrl = () => getFunctionUrl("whatsapp-webhook");
  const getGreenApiWebhookUrl = () => getFunctionUrl("green-api-webhook");

  const handleResetGreenApiWebhook = async (connection: WhatsAppConnection) => {
    if (connection.connection_type !== "green_api") return;

    const greenToken = connection.credentials?.green_api_token;
    if (!connection.green_api_instance_id || !greenToken) {
      toast({
        title: "خطأ",
        description: "بيانات Green API غير مكتملة لهذا الاتصال",
        variant: "destructive",
      });
      return;
    }

    const webhookUrl = getGreenApiWebhookUrl();
    if (!webhookUrl) {
      toast({
        title: "خطأ",
        description: "تعذر توليد رابط Webhook لهذا المشروع",
        variant: "destructive",
      });
      return;
    }

    await setupGreenApiWebhook.mutateAsync({
      instanceId: connection.green_api_instance_id,
      apiToken: greenToken,
      webhookUrl,
    });
  };

  const handleActivateConnection = async (connection: WhatsAppConnection) => {
    if (connection.connection_type !== "green_api") return;

    const greenToken = connection.credentials?.green_api_token;
    if (!connection.green_api_instance_id || !greenToken) {
      toast({
        title: "خطأ",
        description: "بيانات Green API غير مكتملة لهذا الاتصال",
        variant: "destructive",
      });
      return;
    }

    await activateConnection.mutateAsync({
      instanceId: connection.green_api_instance_id,
      apiToken: greenToken,
      connectionId: connection.id,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ",
      description: `تم نسخ ${label}`,
    });
  };

  const connectedBranchIds = connections.map((c) => c.branch_id);
  const availableBranches = branches.filter(
    (b) => !connectedBranchIds.includes(b.id)
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              ربط WhatsApp Business
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              اختر الطريقة المناسبة - Meta Cloud API مجاني وآمن
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <QuickUpload 
              trigger={
                <Button variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  رفع صورة
                </Button>
              }
            />
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  ربط فرع جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-right">
                    ربط WhatsApp Business بفرع
                  </DialogTitle>
                  <DialogDescription className="text-right">
                    اختر طريقة الربط - ننصح بـ Meta Cloud API المجاني
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs value={connectionMethod} onValueChange={(v) => setConnectionMethod(v as "meta" | "green_api")} className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="meta" className="gap-2">
                      <Shield className="w-4 h-4" />
                      Meta Cloud API
                      <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-0">مجاني</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="green_api" className="gap-2">
                      <QrCode className="w-4 h-4" />
                      Green API
                    </TabsTrigger>
                  </TabsList>

                  {/* Meta API Tab */}
                  <TabsContent value="meta" className="space-y-4 mt-4">
                    <Alert className="bg-blue-500/10 border-blue-500/30">
                      <Shield className="h-4 w-4 text-blue-400" />
                      <AlertDescription className="text-sm">
                        <strong>الخيار الموصى به!</strong> رسمي من Meta، مجاني لاستقبال الرسائل، وآمن 100%
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <Label>الفرع</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={!useCustomBranch ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setUseCustomBranch(false);
                              setCustomBranchName("");
                            }}
                            className="flex-1"
                          >
                            اختر من الموجود
                          </Button>
                          <Button
                            type="button"
                            variant={useCustomBranch ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setUseCustomBranch(true);
                              setSelectedBranch("");
                            }}
                            className="flex-1"
                          >
                            أدخل اسم جديد
                          </Button>
                        </div>
                        
                        {!useCustomBranch ? (
                          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الفرع" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableBranches.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="أدخل اسم الفرع الجديد"
                            value={customBranchName}
                            onChange={(e) => setCustomBranchName(e.target.value)}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">رقم WhatsApp Business</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+249911234567"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="text-left"
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phoneNumberId" className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Phone Number ID
                        </Label>
                        <Input
                          id="phoneNumberId"
                          placeholder="123456789012345"
                          value={phoneNumberId}
                          onChange={(e) => setPhoneNumberId(e.target.value)}
                          className="text-left font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="accessToken" className="flex items-center gap-2">
                          <Key className="w-4 h-4" />
                          Access Token
                        </Label>
                        <Input
                          id="accessToken"
                          type="password"
                          placeholder="EAAxxxxxxx..."
                          value={accessToken}
                          onChange={(e) => setAccessToken(e.target.value)}
                          className="text-left font-mono"
                          dir="ltr"
                        />
                      </div>

                      <Button
                        variant="outline"
                        onClick={handleTestMetaApi}
                        className="w-full gap-2"
                        disabled={!phoneNumberId || !accessToken || testMetaConnection.isPending}
                      >
                        {testMetaConnection.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        اختبار الاتصال
                      </Button>

                      <Button
                        onClick={handleAddMetaConnection}
                        className="w-full gap-2"
                        disabled={
                          (!useCustomBranch && !selectedBranch) || 
                          (useCustomBranch && !customBranchName.trim()) || 
                          !phoneNumber || !accessToken || !phoneNumberId ||
                          addMetaConnection.isPending
                        }
                      >
                        {addMetaConnection.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        تفعيل الربط
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Green API Tab */}
                  <TabsContent value="green_api" className="space-y-4 mt-4">
                    <Alert className="bg-amber-500/10 border-amber-500/30">
                      <DollarSign className="h-4 w-4 text-amber-400" />
                      <AlertDescription className="text-sm">
                        بديل سهل الإعداد ($12/شهر)
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <Label>الفرع</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={!useCustomBranch ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setUseCustomBranch(false);
                              setCustomBranchName("");
                            }}
                            className="flex-1"
                          >
                            اختر من الموجود
                          </Button>
                          <Button
                            type="button"
                            variant={useCustomBranch ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setUseCustomBranch(true);
                              setSelectedBranch("");
                            }}
                            className="flex-1"
                          >
                            أدخل اسم جديد
                          </Button>
                        </div>
                        
                        {!useCustomBranch ? (
                          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الفرع" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableBranches.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="أدخل اسم الفرع الجديد"
                            value={customBranchName}
                            onChange={(e) => setCustomBranchName(e.target.value)}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="greenPhone">رقم WhatsApp</Label>
                        <Input
                          id="greenPhone"
                          type="tel"
                          placeholder="+249911234567"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="text-left"
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="instanceId" className="flex items-center gap-2">
                          <Key className="w-4 h-4" />
                          Instance ID
                        </Label>
                        <Input
                          id="instanceId"
                          placeholder="1234567890"
                          value={greenInstanceId}
                          onChange={(e) => setGreenInstanceId(e.target.value)}
                          className="text-left font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="apiToken" className="flex items-center gap-2">
                          <Key className="w-4 h-4" />
                          API Token
                        </Label>
                        <Input
                          id="apiToken"
                          type="password"
                          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={greenApiToken}
                          onChange={(e) => setGreenApiToken(e.target.value)}
                          className="text-left font-mono"
                          dir="ltr"
                        />
                      </div>

                      <Button
                        variant="outline"
                        onClick={handleTestGreenApi}
                        className="w-full gap-2"
                        disabled={!greenInstanceId || !greenApiToken || testGreenApiConnection.isPending}
                      >
                        {testGreenApiConnection.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        اختبار الاتصال
                      </Button>

                      <Button
                        onClick={handleAddGreenApiConnection}
                        className="w-full gap-2"
                        disabled={
                          (!useCustomBranch && !selectedBranch) || 
                          (useCustomBranch && !customBranchName.trim()) || 
                          !phoneNumber || !greenInstanceId || !greenApiToken || 
                          addGreenApiConnection.isPending
                        }
                      >
                        {addGreenApiConnection.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        تفعيل الربط
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* خيارات الربط */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 hover:border-blue-500/50 transition-colors cursor-pointer relative overflow-hidden" 
            onClick={() => { setConnectionMethod("meta"); setIsDialogOpen(true); }}
          >
            <div className="absolute top-2 left-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                موصى به
              </Badge>
            </div>
            <CardContent className="p-4 pt-8">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Meta Cloud API</h3>
                  <p className="text-xs text-emerald-400">مجاني - رسمي - آمن 100%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 hover:border-emerald-500/40 transition-colors cursor-pointer" 
            onClick={() => { setConnectionMethod("green_api"); setIsDialogOpen(true); }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/20">
                  <QrCode className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Green API</h3>
                  <p className="text-xs text-muted-foreground">سهل - $12/شهر</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <QuickUpload 
            trigger={
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-purple-500/20">
                      <Upload className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">رفع يدوي</h3>
                      <p className="text-xs text-muted-foreground">ارفع صور التحويلات مباشرة</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            }
          />
        </div>

        {/* مراقبة الحصة والإحصائيات */}
        <MetaUsageTracker />

        {/* دليل الإعداد المبسّط */}
        <MetaApiSetupGuide 
          webhookUrl={getFunctionUrl("meta-webhook")} 
          verifyToken="hawala_verify_token_2024" 
        />

        {/* الاتصالات الحالية */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              الاتصالات المفعلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد اتصالات حتى الآن</p>
                <p className="text-sm mt-1">اضغط "ربط فرع جديد" للبدء</p>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Store className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground">
                              {connection.branches?.name || "فرع غير معروف"}
                            </p>
                            {getStatusBadge(connection.status)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{connection.phone_number}</span>
                            {getConnectionTypeBadge(connection.connection_type)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            آخر مزامنة: {getLastSyncText(connection.last_sync_at, connection.status)}
                          </p>
                          {connection.monitored_chat_name && (
                            <Badge variant="outline" className="mt-1 text-xs gap-1">
                              <Users className="w-3 h-3" />
                              مجموعة: {connection.monitored_chat_name}
                            </Badge>
                          )}
                          {connection.status === "connected" && (
                            <div className={`flex items-start gap-2 mt-2 p-2 rounded-md border ${connection.notification_enabled ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/40"}`}>
                              <Switch
                                checked={connection.notification_enabled}
                                disabled={toggleConfirmationNotifications.isPending}
                                onCheckedChange={(checked) =>
                                  toggleConfirmationNotifications.mutate({ id: connection.id, enabled: checked })
                                }
                              />
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-foreground">
                                  🔔 إرسال إيصال تحليل تلقائي في نفس القروب
                                </span>
                                <span className={`text-[11px] mt-0.5 ${connection.notification_enabled ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                                  {connection.notification_enabled
                                    ? "مفعّل — سيصل العميل رسالة تأكيد فور تحليل الإيصال"
                                    : "معطّل — لن يستلم العميل أي رسالة تأكيد بعد الإرسال"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGroupFilterConnectionId(connection.id)}
                          className="gap-1"
                        >
                          <Users className="w-3 h-3" />
                          مجموعة
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(connection.id)}
                          disabled={testConnection.isPending}
                          className="gap-1"
                        >
                          {testConnection.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Zap className="w-3 h-3" />
                          )}
                          اختبار
                        </Button>
                        
                        {connection.connection_type === "green_api" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleActivateConnection(connection)}
                              disabled={activateConnection.isPending}
                              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                              {activateConnection.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Power className="w-3 h-3" />
                              )}
                              تفعيل
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetGreenApiWebhook(connection)}
                              disabled={setupGreenApiWebhook.isPending}
                              className="gap-1"
                            >
                              {setupGreenApiWebhook.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Link className="w-3 h-3" />
                              )}
                              إعادة ربط Webhook
                            </Button>
                          </>
                        )}

                        {connection.status === "connected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(connection.id)}
                            disabled={updateConnectionStatus.isPending}
                            className="gap-1"
                          >
                            <Unlink className="w-3 h-3" />
                            قطع
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReconnect(connection.id)}
                            disabled={updateConnectionStatus.isPending}
                            className="gap-1"
                          >
                            <Link className="w-3 h-3" />
                            إعادة الربط
                          </Button>
                        )}
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(connection.id)}
                          disabled={deleteConnection.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Group Filter Dialog */}
        {groupFilterConnectionId && (() => {
          const conn = connections.find(c => c.id === groupFilterConnectionId);
          return conn ? (
            <GroupFilterDialog
              open={!!groupFilterConnectionId}
              onOpenChange={(open) => !open && setGroupFilterConnectionId(null)}
              connectionId={conn.id}
              connectionType={conn.connection_type}
              currentChatId={conn.monitored_chat_id}
              currentChatName={conn.monitored_chat_name}
            />
          ) : null;
        })()}
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppSettings;
