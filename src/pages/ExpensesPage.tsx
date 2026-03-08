import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { Plus, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const EXPENSE_CATEGORIES = ["إيجار", "رواتب", "كهرباء ومياه", "صيانة", "نقل وشحن", "مستلزمات مكتبية", "تسويق وإعلان", "أخرى"];
const COLORS = ["hsl(217, 91%, 50%)", "hsl(151, 55%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 60%, 50%)", "hsl(190, 70%, 45%)", "hsl(330, 60%, 50%)", "hsl(50, 80%, 50%)"];
const paymentMethodLabel: Record<string, string> = { cash: "نقد", bank_transfer: "تحويل بنكي", check: "شيك", other: "أخرى" };

type Expense = {
  id: string; expense_number: string; category: string; description: string;
  amount: number; expense_date: string; payment_method: string;
  receipt_url: string | null; notes: string | null; created_at: string;
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const perm = usePermissions();
  const queryClient = useQueryClient();
  const now = new Date();

  const [range, setRange] = useState<"month" | "last_month" | "year" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(now.toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState("cash");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const dateRange = useMemo(() => {
    if (range === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0], end: now.toISOString().split("T")[0] };
    if (range === "last_month") return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0], end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0] };
    if (range === "year") return { start: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0], end: now.toISOString().split("T")[0] };
    return { start: customStart, end: customEnd || now.toISOString().split("T")[0] };
  }, [range, customStart, customEnd]);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", dateRange],
    queryFn: async () => {
      let q = supabase.from("expenses" as any).select("*").order("expense_date", { ascending: false });
      if (dateRange.start) q = q.gte("expense_date", dateRange.start);
      if (dateRange.end) q = q.lte("expense_date", dateRange.end);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Expense[];
    },
  });

  const filtered = useMemo(() => {
    if (!expenses) return [];
    if (catFilter === "all") return expenses;
    return expenses.filter(e => e.category === catFilter);
  }, [expenses, catFilter]);

  const summary = useMemo(() => {
    if (!filtered) return { total: 0, count: 0, topCat: "-" };
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const byCat: Record<string, number> = {};
    filtered.forEach(e => { byCat[e.category] = (byCat[e.category] ?? 0) + e.amount; });
    const topCat = Object.entries(byCat).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "-";
    return { total, count: filtered.length, topCat };
  }, [filtered]);

  // Chart data: monthly by category for current year
  const { data: yearExpenses } = useQuery({
    queryKey: ["expenses-year-chart"],
    queryFn: async () => {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      const { data } = await supabase.from("expenses" as any).select("category, amount, expense_date").gte("expense_date", start);
      return (data ?? []) as unknown as { category: string; amount: number; expense_date: string }[];
    },
  });

  const chartData = useMemo(() => {
    if (!yearExpenses) return [];
    const months: Record<number, Record<string, number>> = {};
    for (let i = 0; i < 12; i++) months[i] = {};
    yearExpenses.forEach(e => {
      const m = new Date(e.expense_date).getMonth();
      months[m][e.category] = (months[m][e.category] ?? 0) + e.amount;
    });
    const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return Object.entries(months).map(([m, cats]) => ({ name: MONTH_NAMES[parseInt(m)], ...cats }));
  }, [yearExpenses]);

  const usedCategories = useMemo(() => {
    if (!yearExpenses) return [];
    return [...new Set(yearExpenses.map(e => e.category))];
  }, [yearExpenses]);

  const resetForm = () => {
    setCategory(""); setDescription(""); setAmount(""); setExpenseDate(now.toISOString().split("T")[0]);
    setPayMethod("cash"); setReceiptFile(null); setNotes("");
  };

  const createExpense = useMutation({
    mutationFn: async () => {
      const { data: numData } = await supabase.rpc("generate_expense_number");
      let receiptUrl = null;
      if (receiptFile) {
        const path = `${Date.now()}-${receiptFile.name}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
          receiptUrl = urlData.publicUrl;
        }
      }
      const { error } = await supabase.from("expenses" as any).insert({
        expense_number: numData, category, description, amount: parseFloat(amount),
        expense_date: expenseDate, payment_method: payMethod,
        receipt_url: receiptUrl, notes: notes || null, created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-year-chart"] });
      setDialogOpen(false); resetForm();
      toast.success("تم إضافة المصروف");
    },
    onError: () => toast.error("حدث خطأ"),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">المصروفات</h1>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>
          {perm.canCreate("expenses") && <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="ml-2 h-4 w-4" />إضافة مصروف</Button>}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {(["month", "last_month", "year", "custom"] as const).map(r => (
            <Button key={r} variant={range === r ? "default" : "outline"} size="sm" onClick={() => setRange(r)}>
              {r === "month" ? "هذا الشهر" : r === "last_month" ? "الشهر الماضي" : r === "year" ? "هذا العام" : "مخصص"}
            </Button>
          ))}
          {range === "custom" && (
            <>
              <Input type="date" dir="ltr" className="w-36" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <Input type="date" dir="ltr" className="w-36" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </>
          )}
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="كل الفئات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "إجمالي المصروفات", value: formatCurrency(summary.total) },
            { title: "عدد المصروفات", value: summary.count.toLocaleString("en-US") },
            { title: "أعلى فئة مصروفات", value: summary.topCat },
          ].map(s => (
            <Card key={s.title}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.title}</CardTitle></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-xl font-bold" dir="ltr">{s.value}</div>}</CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم المصروف</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id}>
                      <TableCell dir="ltr" className="font-mono">{e.expense_number}</TableCell>
                      <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell dir="ltr" className="font-semibold">{formatCurrency(e.amount)}</TableCell>
                      <TableCell dir="ltr">{new Date(e.expense_date).toLocaleDateString("en-US")}</TableCell>
                      <TableCell>{paymentMethodLabel[e.payment_method] ?? e.payment_method}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد مصروفات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">المصروفات الشهرية حسب الفئة</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    {usedCategories.map((cat, i) => (
                      <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة مصروف</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>الفئة *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>الوصف *</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>المبلغ *</Label><Input type="number" dir="ltr" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
            <div><Label>تاريخ المصروف</Label><Input type="date" dir="ltr" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></div>
            <div>
              <Label>طريقة الدفع</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقد</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="check">شيك</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>إيصال (اختياري)</Label><Input type="file" accept="image/*,application/pdf" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} /></div>
            <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => createExpense.mutate()} disabled={createExpense.isPending || !category || !description || !amount}>
              {createExpense.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
