import { useState, useRef, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Plus, Search, Camera, ClipboardCheck } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

type InventorySession = {
  id: string;
  session_name: string;
  status: string;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  total_system_value: number;
  total_actual_value: number;
  created_at: string;
};

type InventoryItem = {
  id: string;
  session_id: string;
  product_id: string | null;
  product_name: string;
  barcode: string | null;
  unit: string | null;
  system_qty: number;
  actual_qty: number | null;
  purchase_price: number;
  notes: string | null;
  created_at: string;
};

export default function InventoryPage() {
  const { role, user } = useAuth();
  const perm = usePermissions();
  const queryClient = useQueryClient();

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [selectedSession, setSelectedSession] = useState<InventorySession | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inventory-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_sessions" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InventorySession[];
    },
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["inventory-items", selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession) return [];
      const { data, error } = await supabase.from("inventory_items" as any).select("*").eq("session_id", selectedSession.id).order("product_name");
      if (error) throw error;
      return (data ?? []) as unknown as InventoryItem[];
    },
    enabled: !!selectedSession,
  });

  const createSession = useMutation({
    mutationFn: async (name: string) => {
      const { data: session, error: sErr } = await supabase.from("inventory_sessions" as any).insert({ session_name: name, created_by: user?.id, status: "in_progress", started_at: new Date().toISOString() } as any).select().single();
      if (sErr) throw sErr;
      const s = session as unknown as InventorySession;

      const { data: products, error: pErr } = await supabase.from("products").select("id, name, barcode, unit, current_stock, purchase_price").eq("is_active", true);
      if (pErr) throw pErr;

      if (products && products.length > 0) {
        const rows = products.map(p => ({
          session_id: s.id,
          product_id: p.id,
          product_name: p.name,
          barcode: p.barcode,
          unit: p.unit,
          system_qty: p.current_stock ?? 0,
          purchase_price: p.purchase_price ?? 0,
        }));
        const { error: iErr } = await supabase.from("inventory_items" as any).insert(rows as any);
        if (iErr) throw iErr;
      }
      return s;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
      setNewDialogOpen(false);
      setSessionName("");
      toast.success("تم إنشاء جلسة الجرد بنجاح");
    },
    onError: () => toast.error("حدث خطأ أثناء إنشاء الجلسة"),
  });

  const updateItemQty = useMutation({
    mutationFn: async ({ id, actual_qty }: { id: string; actual_qty: number }) => {
      const { error } = await supabase.from("inventory_items" as any).update({ actual_qty } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-items", selectedSession?.id] }),
  });

  const closeSession = useMutation({
    mutationFn: async (session: InventorySession) => {
      const { data: sessionItems } = await supabase.from("inventory_items" as any).select("*").eq("session_id", session.id);
      const its = (sessionItems ?? []) as unknown as InventoryItem[];
      const totalSystem = its.reduce((s, i) => s + (i.system_qty ?? 0) * (i.purchase_price ?? 0), 0);
      const totalActual = its.reduce((s, i) => s + (i.actual_qty ?? 0) * (i.purchase_price ?? 0), 0);
      const { error } = await supabase.from("inventory_sessions" as any).update({ status: "completed", completed_at: new Date().toISOString(), total_system_value: totalSystem, total_actual_value: totalActual } as any).eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
      setSelectedSession(null);
      toast.success("تم إغلاق جلسة الجرد");
    },
  });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!itemSearch) return items;
    const q = itemSearch.toLowerCase();
    return items.filter(i => i.product_name.toLowerCase().includes(q) || (i.barcode && i.barcode.includes(q)));
  }, [items, itemSearch]);

  const summary = useMemo(() => {
    if (!items) return { system: 0, actual: 0, diff: 0 };
    const system = items.reduce((s, i) => s + (i.system_qty ?? 0) * (i.purchase_price ?? 0), 0);
    const actual = items.reduce((s, i) => s + (i.actual_qty ?? 0) * (i.purchase_price ?? 0), 0);
    return { system, actual, diff: actual - system };
  }, [items]);

  const startScan = () => {
    setScanning(true);
    setTimeout(() => {
      const el = document.getElementById("inv-scanner");
      if (!el) return;
      const scanner = new Html5Qrcode("inv-scanner");
      scannerRef.current = scanner;
      scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        scanner.stop().then(() => { setScanning(false); setItemSearch(text); });
      }, () => {}).catch(() => setScanning(false));
    }, 100);
  };

  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="outline">مسودة</Badge>;
      case "in_progress": return <Badge variant="default">جارية</Badge>;
      case "completed": return <Badge className="bg-accent text-accent-foreground">مكتملة</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">الجرد</h1>
            <Badge variant="secondary">{sessions?.length ?? 0}</Badge>
          </div>
          {perm.canCreate("inventory") && <Button onClick={() => setNewDialogOpen(true)}><Plus className="ml-2 h-4 w-4" />جلسة جرد جديدة</Button>}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم الجلسة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>قيمة النظام</TableHead>
                    <TableHead>القيمة الفعلية</TableHead>
                    <TableHead>الفارق</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions?.map(s => {
                    const diff = (s.total_actual_value ?? 0) - (s.total_system_value ?? 0);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.session_name}</TableCell>
                        <TableCell dir="ltr">{s.created_at ? new Date(s.created_at).toLocaleDateString("en-US") : "-"}</TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell dir="ltr">{formatCurrency(s.total_system_value ?? 0)}</TableCell>
                        <TableCell dir="ltr">{formatCurrency(s.total_actual_value ?? 0)}</TableCell>
                        <TableCell dir="ltr" className={diff < 0 ? "text-destructive" : diff > 0 ? "text-accent" : ""}>{formatCurrency(diff)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSession(s)}>فتح</Button>
                            {perm.canEdit("inventory") && s.status === "in_progress" && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => closeSession.mutate(s)}>إغلاق</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!sessions || sessions.length === 0) && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد جلسات جرد</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Session Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>جلسة جرد جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم الجلسة</Label>
              <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="مثال: جرد نهاية الشهر" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => createSession.mutate(sessionName)} disabled={!sessionName.trim() || createSession.isPending}>
              {createSession.isPending ? "جاري الإنشاء..." : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Detail Sheet */}
      <Sheet open={!!selectedSession} onOpenChange={(open) => { if (!open) setSelectedSession(null); }}>
        <SheetContent side="left" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedSession?.session_name}
              {selectedSession && statusBadge(selectedSession.status)}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="بحث بالاسم أو الباركود..." className="pr-9" />
              </div>
              <Button variant="outline" size="icon" onClick={startScan}><Camera className="h-4 w-4" /></Button>
            </div>

            {scanning && <div id="inv-scanner" className="w-full max-w-sm mx-auto" />}

            {itemsLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="border rounded-lg overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>الباركود</TableHead>
                      <TableHead>النظام</TableHead>
                      <TableHead>الفعلي</TableHead>
                      <TableHead>الفارق</TableHead>
                      <TableHead>القيمة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map(item => {
                      const variance = (item.actual_qty ?? 0) - (item.system_qty ?? 0);
                      const value = variance * (item.purchase_price ?? 0);
                      const isEditable = selectedSession?.status === "in_progress";
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell dir="ltr" className="font-mono text-xs">{item.barcode ?? "-"}</TableCell>
                          <TableCell dir="ltr">{(item.system_qty ?? 0).toLocaleString("en-US")}</TableCell>
                          <TableCell>
                            {isEditable ? (
                              <Input
                                type="number"
                                className="w-20 text-center"
                                dir="ltr"
                                defaultValue={item.actual_qty ?? ""}
                                onBlur={e => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) updateItemQty.mutate({ id: item.id, actual_qty: val });
                                }}
                              />
                            ) : (
                              <span dir="ltr">{(item.actual_qty ?? 0).toLocaleString("en-US")}</span>
                            )}
                          </TableCell>
                          <TableCell dir="ltr" className={variance < 0 ? "text-destructive font-semibold" : variance > 0 ? "text-accent font-semibold" : "text-muted-foreground"}>
                            {variance.toLocaleString("en-US")}
                          </TableCell>
                          <TableCell dir="ltr" className={value < 0 ? "text-destructive" : value > 0 ? "text-accent" : ""}>
                            {formatCurrency(value)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">إجمالي قيمة النظام</p>
                  <p className="text-lg font-bold" dir="ltr">{formatCurrency(summary.system)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">إجمالي القيمة الفعلية</p>
                  <p className="text-lg font-bold" dir="ltr">{formatCurrency(summary.actual)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">إجمالي الفارق</p>
                  <p className={`text-lg font-bold ${summary.diff < 0 ? "text-destructive" : summary.diff > 0 ? "text-accent" : ""}`} dir="ltr">{formatCurrency(summary.diff)}</p>
                </CardContent>
              </Card>
            </div>

            {perm.canEdit("inventory") && selectedSession?.status === "in_progress" && (
              <Button variant="destructive" className="w-full" onClick={() => closeSession.mutate(selectedSession)} disabled={closeSession.isPending}>
                {closeSession.isPending ? "جاري الإغلاق..." : "إغلاق الجلسة"}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
