import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useInvestmentOrchestrator } from "@/hooks/useInvestmentOrchestrator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, TrendingUp, Wallet, Target, Sparkles, Activity, CheckCircle2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";
import { motion } from "framer-motion";

const fmt = (n: number, currency = "SDG") =>
  new Intl.NumberFormat("ar-SD", { maximumFractionDigits: 2 }).format(n) + " " + currency;

function healthStatus(util: number) {
  if (util < 10) return { label: "ممتاز", color: "bg-emerald-500", text: "text-emerald-600" };
  if (util < 30) return { label: "جيد", color: "bg-blue-500", text: "text-blue-600" };
  if (util < 60) return { label: "تحذير", color: "bg-amber-500", text: "text-amber-600" };
  return { label: "خطر", color: "bg-rose-500", text: "text-rose-600" };
}

export default function InvestmentOrchestrator() {
  const { currentOrganization } = useAuth();
  if (currentOrganization && !currentOrganization.investment_enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  const {
    profile, profileLoading, investments, milestones,
    upsertProfile, addInvestment, deleteInvestment, toggleInvestment,
    addMilestone, toggleMilestone, deleteMilestone,
  } = useInvestmentOrchestrator();

  const [form, setForm] = useState({
    credit_limit: "", monthly_spend: "", monthly_payment: "",
    monthly_income_goal: "", current_balance: "", currency: "SDG",
  });

  // Sync form when profile loads
  useMemo(() => {
    if (profile) {
      setForm({
        credit_limit: String(profile.credit_limit),
        monthly_spend: String(profile.monthly_spend),
        monthly_payment: String(profile.monthly_payment),
        monthly_income_goal: String(profile.monthly_income_goal),
        current_balance: String(profile.current_balance),
        currency: profile.currency,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const num = (v: string) => Number(v || 0);
  const limit = num(form.credit_limit);
  const spend = num(form.monthly_spend);
  const payment = num(form.monthly_payment);
  const goal = num(form.monthly_income_goal);
  const balance = num(form.current_balance);
  const currency = form.currency || "SDG";

  const utilization = limit > 0 ? (spend / limit) * 100 : 0;
  const growthFactor = payment - spend;
  const status = healthStatus(utilization);

  // Investment metrics
  const activeInvestments = investments.filter(i => i.is_active);
  const totalCapital = activeInvestments.reduce((s, i) => s + Number(i.capital_amount), 0);
  const monthlyProfit = activeInvestments.reduce(
    (s, i) => s + (Number(i.capital_amount) * Number(i.expected_monthly_roi)) / 100, 0
  );
  const annualProjection = monthlyProfit * 12;
  const goalProgress = goal > 0 ? Math.min((monthlyProfit / goal) * 100, 100) : 0;

  // What-if simulation
  const [extraPayment, setExtraPayment] = useState(0);
  const simData = useMemo(() => {
    const months = 12;
    const data: { month: string; balance: number; baseline: number }[] = [];
    let bal = balance;
    let base = balance;
    for (let m = 1; m <= months; m++) {
      base += growthFactor + monthlyProfit;
      bal += growthFactor + extraPayment + monthlyProfit;
      data.push({ month: `الشهر ${m}`, balance: Math.round(bal), baseline: Math.round(base) });
    }
    return data;
  }, [balance, growthFactor, monthlyProfit, extraPayment]);

  // Investment add dialog
  const [showInvDialog, setShowInvDialog] = useState(false);
  const [invForm, setInvForm] = useState({ asset_name: "", capital_amount: "", expected_monthly_roi: "", notes: "" });

  // Milestone add
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneTarget, setMilestoneTarget] = useState("");

  const completedMilestones = milestones.filter(m => m.is_completed).length;

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-medium tracking-wider uppercase">Investment & Credit Orchestrator</span>
              </div>
              <h1 className="text-3xl font-bold mt-2">منسق الاستثمار والائتمان الديناميكي</h1>
              <p className="text-muted-foreground mt-1">احسب صحة الائتمان ونمو الاستثمار في الوقت الفعلي بناءً على بياناتك.</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className={`${status.text} border-current`}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">حالة الائتمان</span>
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="credit" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="credit">الائتمان</TabsTrigger>
            <TabsTrigger value="investments">الاستثمارات</TabsTrigger>
            <TabsTrigger value="milestones">المعالم</TabsTrigger>
            <TabsTrigger value="simulation">محاكاة</TabsTrigger>
          </TabsList>

          {/* CREDIT TAB */}
          <TabsContent value="credit" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Config form */}
              <Card className="lg:col-span-1 backdrop-blur-xl bg-card/70 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> إعداد البطاقة الائتمانية</CardTitle>
                  <CardDescription>أدخل القيم الفعلية — كل الحسابات تُبنى عليها.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>الحد الائتماني الكلي</Label>
                    <Input type="number" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} />
                  </div>
                  <div>
                    <Label>الإنفاق الشهري</Label>
                    <Input type="number" value={form.monthly_spend} onChange={e => setForm({ ...form, monthly_spend: e.target.value })} />
                  </div>
                  <div>
                    <Label>الدفعة الشهرية</Label>
                    <Input type="number" value={form.monthly_payment} onChange={e => setForm({ ...form, monthly_payment: e.target.value })} />
                  </div>
                  <div>
                    <Label>الرصيد الحالي</Label>
                    <Input type="number" value={form.current_balance} onChange={e => setForm({ ...form, current_balance: e.target.value })} />
                  </div>
                  <div>
                    <Label>هدف الدخل الشهري</Label>
                    <Input type="number" value={form.monthly_income_goal} onChange={e => setForm({ ...form, monthly_income_goal: e.target.value })} />
                  </div>
                  <div>
                    <Label>العملة</Label>
                    <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
                  </div>
                  <Button
                    className="w-full"
                    disabled={upsertProfile.isPending || profileLoading}
                    onClick={() => upsertProfile.mutate({
                      credit_limit: limit, monthly_spend: spend, monthly_payment: payment,
                      monthly_income_goal: goal, current_balance: balance, currency,
                    })}
                  >
                    حفظ
                  </Button>
                </CardContent>
              </Card>

              {/* Metrics */}
              <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
                <MetricCard icon={<Activity className="h-5 w-5" />} title="نسبة الاستخدام" value={`${utilization.toFixed(1)}%`} sub={`${fmt(spend, currency)} / ${fmt(limit, currency)}`}>
                  <Progress value={Math.min(utilization, 100)} className="h-2 mt-3" />
                </MetricCard>
                <MetricCard icon={<TrendingUp className="h-5 w-5" />} title="عامل نمو الحساب" value={fmt(growthFactor, currency)} sub={growthFactor >= 0 ? "فائض شهري إيجابي" : "عجز شهري — راجع الإنفاق"} accent={growthFactor >= 0 ? "text-emerald-600" : "text-rose-600"} />
                <MetricCard icon={<Wallet className="h-5 w-5" />} title="الرصيد الحالي" value={fmt(balance, currency)} sub="نقطة البداية للحسابات" />
                <MetricCard icon={<Sparkles className="h-5 w-5" />} title="حالة الائتمان" value={status.label} sub="بناءً على نسبة الاستخدام" accent={status.text} />
              </div>
            </div>
          </TabsContent>

          {/* INVESTMENTS TAB */}
          <TabsContent value="investments" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard icon={<Wallet className="h-5 w-5" />} title="رأس المال النشط" value={fmt(totalCapital, currency)} sub={`${activeInvestments.length} استثمار نشط`} />
              <MetricCard icon={<TrendingUp className="h-5 w-5" />} title="الربح الشهري المتوقع" value={fmt(monthlyProfit, currency)} sub="من جميع الاستثمارات النشطة" accent="text-emerald-600" />
              <MetricCard icon={<Target className="h-5 w-5" />} title="الإسقاط السنوي" value={fmt(annualProjection, currency)} sub="ربح متوقع × 12" />
            </div>

            <Card className="backdrop-blur-xl bg-card/70 border-border/50">
              <CardHeader>
                <CardTitle>تقدم هدف الدخل الشهري</CardTitle>
                <CardDescription>{fmt(monthlyProfit, currency)} من أصل {fmt(goal, currency)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={goalProgress} className="h-3" />
                <div className="text-sm mt-2 text-muted-foreground">{goalProgress.toFixed(1)}% من الهدف</div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-card/70 border-border/50">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>محفظة الاستثمارات</CardTitle>
                <Dialog open={showInvDialog} onOpenChange={setShowInvDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 ml-1" /> إضافة استثمار</Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>استثمار جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>اسم الأصل</Label><Input value={invForm.asset_name} onChange={e => setInvForm({ ...invForm, asset_name: e.target.value })} /></div>
                      <div><Label>رأس المال</Label><Input type="number" value={invForm.capital_amount} onChange={e => setInvForm({ ...invForm, capital_amount: e.target.value })} /></div>
                      <div><Label>العائد الشهري المتوقع %</Label><Input type="number" step="0.01" value={invForm.expected_monthly_roi} onChange={e => setInvForm({ ...invForm, expected_monthly_roi: e.target.value })} /></div>
                      <div><Label>ملاحظات</Label><Textarea value={invForm.notes} onChange={e => setInvForm({ ...invForm, notes: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button onClick={async () => {
                        if (!invForm.asset_name || !invForm.capital_amount) return;
                        await addInvestment.mutateAsync({
                          asset_name: invForm.asset_name,
                          capital_amount: Number(invForm.capital_amount),
                          expected_monthly_roi: Number(invForm.expected_monthly_roi),
                          notes: invForm.notes || undefined,
                        });
                        setInvForm({ asset_name: "", capital_amount: "", expected_monthly_roi: "", notes: "" });
                        setShowInvDialog(false);
                      }}>حفظ</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {investments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد استثمارات بعد.</p>
                ) : (
                  <div className="space-y-3">
                    {investments.map(inv => {
                      const monthly = (Number(inv.capital_amount) * Number(inv.expected_monthly_roi)) / 100;
                      return (
                        <motion.div
                          key={inv.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-4 backdrop-blur"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{inv.asset_name}</span>
                              {inv.is_active ? <Badge variant="secondary">نشط</Badge> : <Badge variant="outline">متوقف</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              رأس المال: {fmt(Number(inv.capital_amount), currency)} • العائد: {Number(inv.expected_monthly_roi)}% شهرياً
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="text-emerald-600 font-bold">+{fmt(monthly, currency)}</div>
                            <div className="text-xs text-muted-foreground">شهرياً</div>
                          </div>
                          <div className="flex gap-2 mr-4">
                            <Button size="sm" variant="ghost" onClick={() => toggleInvestment.mutate({ id: inv.id, is_active: !inv.is_active })}>
                              {inv.is_active ? "إيقاف" : "تفعيل"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteInvestment.mutate(inv.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MILESTONES TAB */}
          <TabsContent value="milestones" className="space-y-6">
            <Card className="backdrop-blur-xl bg-card/70 border-border/50">
              <CardHeader>
                <CardTitle>متتبع المعالم المالية</CardTitle>
                <CardDescription>{completedMilestones} من {milestones.length} مكتمل</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="اسم المعلم (مثال: أول 1000$)" value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} className="flex-1 min-w-[200px]" />
                  <Input placeholder="القيمة المستهدفة (اختياري)" type="number" value={milestoneTarget} onChange={e => setMilestoneTarget(e.target.value)} className="w-48" />
                  <Button onClick={async () => {
                    if (!milestoneTitle.trim()) return;
                    await addMilestone.mutateAsync({ title: milestoneTitle.trim(), target_amount: milestoneTarget ? Number(milestoneTarget) : undefined });
                    setMilestoneTitle(""); setMilestoneTarget("");
                  }}><Plus className="h-4 w-4 ml-1" /> إضافة</Button>
                </div>

                <div className="space-y-2">
                  {milestones.map(m => (
                    <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={m.is_completed} onCheckedChange={(v) => toggleMilestone.mutate({ id: m.id, is_completed: !!v })} />
                        <div>
                          <div className={m.is_completed ? "line-through text-muted-foreground" : "font-medium"}>{m.title}</div>
                          {m.target_amount ? <div className="text-xs text-muted-foreground">الهدف: {fmt(Number(m.target_amount), currency)}</div> : null}
                        </div>
                        {m.is_completed && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteMilestone.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </motion.div>
                  ))}
                  {milestones.length === 0 && <p className="text-center text-muted-foreground py-6">لا توجد معالم بعد.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SIMULATION TAB */}
          <TabsContent value="simulation" className="space-y-6">
            <Card className="backdrop-blur-xl bg-card/70 border-border/50">
              <CardHeader>
                <CardTitle>وضع المحاكاة "ماذا لو"</CardTitle>
                <CardDescription>اسحب لزيادة الدفعة الشهرية وشاهد كيف ينمو رأس مالك خلال 12 شهراً.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>دفعة إضافية شهرياً</Label>
                    <span className="text-primary font-bold">{fmt(extraPayment, currency)}</span>
                  </div>
                  <Slider value={[extraPayment]} onValueChange={(v) => setExtraPayment(v[0])} min={0} max={Math.max(limit, 10000)} step={100} />
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={simData}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="baseline" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" fill="transparent" name="بدون زيادة" />
                      <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" fill="url(#g1)" name="مع الزيادة" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SimStat label="الرصيد بعد 12 شهر" value={fmt(simData[simData.length - 1]?.balance ?? 0, currency)} />
                  <SimStat label="الفرق عن الأساس" value={fmt((simData[simData.length - 1]?.balance ?? 0) - (simData[simData.length - 1]?.baseline ?? 0), currency)} accent="text-emerald-600" />
                  <SimStat label="إجمالي المساهمة الإضافية" value={fmt(extraPayment * 12, currency)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ icon, title, value, sub, accent, children }: { icon: React.ReactNode; title: string; value: string; sub?: string; accent?: string; children?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="backdrop-blur-xl bg-card/70 border-border/50 h-full">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">{icon}{title}</div>
          <div className={`text-2xl font-bold mt-2 ${accent ?? ""}`}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SimStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold mt-1 ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
