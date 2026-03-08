import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { Plus, Search, FileText, AlertTriangle, CreditCard, Eye } from "lucide-react";

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

type Invoice = {
  id: string; invoice_number: string; invoice_type: string; supplier_id: string | null;
  purchase_order_id: string | null; invoice_date: string; due_date: string | null;
  total_amount: number; paid_amount: number; status: string; notes: string | null;
  image_url: string | null; created_by: string | null; created_at: string;
  suppliers?: { name: string } | null;
};

type Payment = {
  id: string; invoice_id: string; amount: number; payment_date: string;
  payment_method: string; reference_number: string | null; notes: string | null; created_at: string;
};

const statusConfig: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
  unpaid: { label: "غير مدفوعة", variant: "destructive" },
  partial: { label: "جزئية", variant: "default" },
  paid: { label: "مدفوعة", variant: "secondary" },
  overdue: { label: "متأخرة", variant: "destructive" },
};

const paymentMethodLabel: Record<string, string> = {
  cash: "نقد", bank_transfer: "تحويل بنكي", check: "شيك", other: "أخرى",
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const perm = usePermissions();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  // Form states
  const [supplierId, setSupplierId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices" as any).select("*, suppliers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Invoice[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["inv-suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["inv-orders", supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data } = await supabase.from("purchase_orders").select("id, order_number, total_amount").eq("supplier_id", supplierId).in("status", ["received", "partial"]);
      return data ?? [];
    },
    enabled: !!supplierId,
  });

  const { data: payments } = useQuery({
    queryKey: ["invoice-payments", detailInvoice?.id],
    queryFn: async () => {
      if (!detailInvoice) return [];
      const { data } = await supabase.from("payments" as any).select("*").eq("invoice_id", detailInvoice.id).order("payment_date", { ascending: false });
      return (data ?? []) as unknown as Payment[];
    },
    enabled: !!detailInvoice,
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const summary = useMemo(() => {
    if (!invoices) return { total: 0, unpaid: 0, paidMonth: 0, overdue: 0 };
    const unpaid = invoices.filter(i => i.status === "unpaid" || i.status === "overdue").reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);
    const paidMonth = invoices.filter(i => i.status === "paid" && i.invoice_date >= startOfMonth).reduce((s, i) => s + i.paid_amount, 0);
    const overdue = invoices.filter(i => (i.status === "overdue") || (i.due_date && i.due_date < today && i.status !== "paid")).length;
    return { total: invoices.length, unpaid, paidMonth, overdue };
  }, [invoices, startOfMonth, today]);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    let list = invoices;
    if (tab !== "all") list = list.filter(i => i.status === tab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.invoice_number.toLowerCase().includes(q) || (i.suppliers?.name ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [invoices, tab, search]);

  const resetNewForm = () => {
    setSupplierId(""); setOrderId(""); setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate(""); setTotalAmount(""); setNotes(""); setImageFile(null);
  };

  const createInvoice = useMutation({
    mutationFn: async () => {
      const { data: numData } = await supabase.rpc("generate_invoice_number");
      let imageUrl = null;
      if (imageFile) {
        const path = `${Date.now()}-${imageFile.name}`;
        const { error: upErr } = await supabase.storage.from("invoices").upload(path, imageFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }
      }
      const { error } = await supabase.from("invoices" as any).insert({
        invoice_number: numData, supplier_id: supplierId || null,
        purchase_order_id: orderId || null, invoice_date: invoiceDate,
        due_date: dueDate || null, total_amount: parseFloat(totalAmount) || 0,
        notes: notes || null, image_url: imageUrl, status: "unpaid",
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setNewOpen(false); resetNewForm();
      toast.success("تم إنشاء الفاتورة");
      logActivity({ actionType: "create", module: "invoices", description: "إنشاء فاتورة جديدة" });
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const createPayment = useMutation({
    mutationFn: async () => {
      if (!payInvoice) throw new Error("No invoice");
      const amount = parseFloat(payAmount);
      const { error: pErr } = await supabase.from("payments" as any).insert({
        invoice_id: payInvoice.id, amount, payment_date: payDate,
        payment_method: payMethod, reference_number: payRef || null,
        notes: payNotes || null, created_by: user?.id,
      } as any);
      if (pErr) throw pErr;

      const newPaid = payInvoice.paid_amount + amount;
      const newStatus = newPaid >= payInvoice.total_amount ? "paid" : newPaid > 0 ? "partial" : "unpaid";
      const { error: uErr } = await supabase.from("invoices" as any).update({ paid_amount: newPaid, status: newStatus } as any).eq("id", payInvoice.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments"] });
      setPayOpen(false); setPayInvoice(null);
      setPayAmount(""); setPayRef(""); setPayNotes("");
      toast.success("تم تسجيل الدفعة");
      logActivity({ actionType: "create", module: "invoices", description: "تسجيل دفعة على فاتورة", details: { invoice_id: payInvoice?.id } });
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const openPay = (inv: Invoice) => {
    setPayInvoice(inv);
    setPayAmount(String(inv.total_amount - inv.paid_amount));
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("cash"); setPayRef(""); setPayNotes("");
    setPayOpen(true);
  };

  const kpis = [
    { title: "إجمالي الفواتير", value: summary.total.toLocaleString("en-US"), icon: FileText, color: "text-primary" },
    { title: "غير مدفوعة", value: formatCurrency(summary.unpaid), icon: AlertTriangle, color: "text-destructive" },
    { title: "مدفوعة هذا الشهر", value: formatCurrency(summary.paidMonth), icon: CreditCard, color: "text-accent" },
    { title: "متأخرة", value: summary.overdue.toLocaleString("en-US"), icon: AlertTriangle, color: summary.overdue > 0 ? "text-destructive" : "text-muted-foreground" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">الفواتير</h1>
            <Badge variant="secondary">{invoices?.length ?? 0}</Badge>
          </div>
          {perm.canCreate("invoices") && <Button onClick={() => { resetNewForm(); setNewOpen(true); }}><Plus className="ml-2 h-4 w-4" />فاتورة جديدة</Button>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(k => (
            <Card key={k.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">{k.title}</CardTitle>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-xl font-bold" dir="ltr">{k.value}</div>}</CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs value={tab} onValueChange={setTab} dir="rtl">
            <TabsList>
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="unpaid">غير مدفوعة</TabsTrigger>
              <TabsTrigger value="partial">جزئية</TabsTrigger>
              <TabsTrigger value="paid">مدفوعة</TabsTrigger>
              <TabsTrigger value="overdue">متأخرة</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو اسم المورد..." className="pr-9" />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>المورد</TableHead>
                    <TableHead>تاريخ الفاتورة</TableHead>
                    <TableHead>تاريخ الاستحقاق</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>المدفوع</TableHead>
                    <TableHead>المتبقي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(inv => {
                    const remaining = inv.total_amount - inv.paid_amount;
                    const sc = statusConfig[inv.status] ?? statusConfig.unpaid;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell dir="ltr" className="font-mono">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.suppliers?.name ?? "-"}</TableCell>
                        <TableCell dir="ltr">{new Date(inv.invoice_date).toLocaleDateString("en-US")}</TableCell>
                        <TableCell dir="ltr">{inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US") : "-"}</TableCell>
                        <TableCell dir="ltr">{formatCurrency(inv.total_amount)}</TableCell>
                        <TableCell dir="ltr">{formatCurrency(inv.paid_amount)}</TableCell>
                        <TableCell dir="ltr" className={remaining > 0 ? "text-destructive font-semibold" : ""}>{formatCurrency(remaining)}</TableCell>
                        <TableCell><Badge variant={sc.variant}>{sc.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setDetailInvoice(inv)}><Eye className="h-4 w-4" /></Button>
                            {inv.status !== "paid" && (
                              <Button variant="ghost" size="sm" onClick={() => openPay(inv)}><CreditCard className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد فواتير</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Invoice Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>فاتورة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>المورد</Label>
              <Select value={supplierId} onValueChange={v => { setSupplierId(v); setOrderId(""); }}>
                <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {supplierId && orders && orders.length > 0 && (
              <div>
                <Label>طلبية مرتبطة (اختياري)</Label>
                <Select value={orderId} onValueChange={v => {
                  setOrderId(v);
                  const o = orders.find(o => o.id === v);
                  if (o) setTotalAmount(String(o.total_amount ?? 0));
                }}>
                  <SelectTrigger><SelectValue placeholder="اختر طلبية" /></SelectTrigger>
                  <SelectContent>{orders.map(o => <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>تاريخ الفاتورة</Label><Input type="date" dir="ltr" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
              <div><Label>تاريخ الاستحقاق</Label><Input type="date" dir="ltr" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
            </div>
            <div><Label>المبلغ الإجمالي</Label><Input type="number" dir="ltr" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0.00" /></div>
            <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <div><Label>صورة الفاتورة</Label><Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>إلغاء</Button>
            <Button onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending || !totalAmount}>
              {createInvoice.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تسجيل دفعة</DialogTitle></DialogHeader>
          {payInvoice && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">فاتورة: <span dir="ltr" className="font-mono">{payInvoice.invoice_number}</span> — المتبقي: <span dir="ltr" className="font-semibold text-destructive">{formatCurrency(payInvoice.total_amount - payInvoice.paid_amount)}</span></p>
              <div><Label>المبلغ</Label><Input type="number" dir="ltr" value={payAmount} onChange={e => setPayAmount(e.target.value)} max={payInvoice.total_amount - payInvoice.paid_amount} /></div>
              <div><Label>تاريخ الدفع</Label><Input type="date" dir="ltr" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
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
              <div><Label>رقم المرجع</Label><Input dir="ltr" value={payRef} onChange={e => setPayRef(e.target.value)} /></div>
              <div><Label>ملاحظات</Label><Textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>إلغاء</Button>
            <Button onClick={() => createPayment.mutate()} disabled={createPayment.isPending || !payAmount}>
              {createPayment.isPending ? "جاري التسجيل..." : "تسجيل الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!detailInvoice} onOpenChange={o => { if (!o) setDetailInvoice(null); }}>
        <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto">
          {detailInvoice && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span dir="ltr" className="font-mono">{detailInvoice.invoice_number}</span>
                  <Badge variant={statusConfig[detailInvoice.status]?.variant ?? "secondary"}>{statusConfig[detailInvoice.status]?.label ?? detailInvoice.status}</Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">المورد:</span> {detailInvoice.suppliers?.name ?? "-"}</div>
                  <div><span className="text-muted-foreground">التاريخ:</span> <span dir="ltr">{new Date(detailInvoice.invoice_date).toLocaleDateString("en-US")}</span></div>
                  <div><span className="text-muted-foreground">الاستحقاق:</span> <span dir="ltr">{detailInvoice.due_date ? new Date(detailInvoice.due_date).toLocaleDateString("en-US") : "-"}</span></div>
                  <div><span className="text-muted-foreground">الإجمالي:</span> <span dir="ltr" className="font-semibold">{formatCurrency(detailInvoice.total_amount)}</span></div>
                </div>

                {detailInvoice.image_url && (
                  <a href={detailInvoice.image_url} target="_blank" rel="noopener noreferrer">
                    <img src={detailInvoice.image_url} alt="صورة الفاتورة" className="w-32 h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80" />
                  </a>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-1">نسبة الدفع</p>
                  <Progress value={detailInvoice.total_amount > 0 ? (detailInvoice.paid_amount / detailInvoice.total_amount) * 100 : 0} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1" dir="ltr">{formatCurrency(detailInvoice.paid_amount)} / {formatCurrency(detailInvoice.total_amount)}</p>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">سجل المدفوعات</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>التاريخ</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead>الطريقة</TableHead>
                          <TableHead>المرجع</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments?.map(p => (
                          <TableRow key={p.id}>
                            <TableCell dir="ltr">{new Date(p.payment_date).toLocaleDateString("en-US")}</TableCell>
                            <TableCell dir="ltr">{formatCurrency(p.amount)}</TableCell>
                            <TableCell>{paymentMethodLabel[p.payment_method] ?? p.payment_method}</TableCell>
                            <TableCell dir="ltr">{p.reference_number ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                        {(!payments || payments.length === 0) && (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">لا توجد مدفوعات</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {detailInvoice.status !== "paid" && (
                  <Button className="w-full" onClick={() => { setDetailInvoice(null); openPay(detailInvoice); }}>
                    <CreditCard className="ml-2 h-4 w-4" />تسجيل دفعة
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
