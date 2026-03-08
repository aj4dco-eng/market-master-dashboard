import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Search, Camera, Package, X, ShoppingBasket, Printer, Check, Trash2, Minus, Plus, Keyboard, HelpCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

type CartItem = {
  product_id: string;
  name: string;
  barcode: string | null;
  unit: string | null;
  selling_price: number;
  purchase_price: number;
  current_stock: number;
  qty: number;
  discount: number;
  total: number;
};

export default function POSPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mobileTab, setMobileTab] = useState<"cart" | "pay">("cart");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, barcode, unit, selling_price, purchase_price, current_stock, image_url").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: taxRate } = useQuery({
    queryKey: ["pos-tax-rate"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "tax_rate").single();
      return data?.value ? parseFloat(data.value) : 0;
    },
  });

  const { data: storeName } = useQuery({
    queryKey: ["pos-store-name"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "store_name").single();
      return data?.value ?? "السوبرماركت";
    },
  });

  const quickProducts = useMemo(() => {
    if (!products) return [];
    return [...products].sort((a, b) => (b.current_stock ?? 0) - (a.current_stock ?? 0)).slice(0, 12);
  }, [products]);

  const searchResults = useMemo(() => {
    if (!search.trim() || !products) return [];
    const s = search.trim().toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.includes(s))).slice(0, 8);
  }, [search, products]);

  const addToCart = useCallback((product: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      if (existing) {
        return prev.map(c => c.product_id === product.id
          ? { ...c, qty: c.qty + 1, total: (c.qty + 1) * c.selling_price * (1 - c.discount / 100) }
          : c
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        selling_price: product.selling_price,
        purchase_price: product.purchase_price ?? 0,
        current_stock: product.current_stock ?? 0,
        qty: 1,
        discount: 0,
        total: product.selling_price,
      }];
    });
    setSearch("");
    searchRef.current?.focus();
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && search.trim()) {
      const exact = products?.find(p => p.barcode === search.trim());
      if (exact) {
        addToCart(exact);
      } else if (searchResults.length === 1) {
        addToCart(searchResults[0]);
      }
    }
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty < 1) return;
    setCart(prev => prev.map(c => c.product_id === productId
      ? { ...c, qty, total: qty * c.selling_price * (1 - c.discount / 100) }
      : c
    ));
  };

  const updateDiscount = (productId: string, discount: number) => {
    const d = Math.min(100, Math.max(0, discount));
    setCart(prev => prev.map(c => c.product_id === productId
      ? { ...c, discount: d, total: c.qty * c.selling_price * (1 - d / 100) }
      : c
    ));
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(c => c.product_id !== productId));
  };

  const subtotal = cart.reduce((s, c) => s + c.qty * c.selling_price, 0);
  const discountAmount = cart.reduce((s, c) => s + c.qty * c.selling_price * (c.discount / 100), 0);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * ((taxRate ?? 0) / 100);
  const totalAmount = afterDiscount + taxAmount;
  const paid = paidAmount ? parseFloat(paidAmount) : totalAmount;
  const changeAmount = paid - totalAmount;

  useEffect(() => {
    if (cart.length > 0) setPaidAmount(totalAmount.toFixed(2));
  }, [totalAmount]);

  // Auto-focus search on desktop only
  useEffect(() => {
    if (!isMobile) searchRef.current?.focus();
  }, [isMobile]);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (code) => {
          scanner.stop();
          setScanning(false);
          const product = products?.find(p => p.barcode === code);
          if (product) {
            addToCart(product);
            toast.success(`تم إضافة ${product.name}`);
          } else {
            toast.error("لم يتم العثور على المنتج");
          }
        },
        () => {}
      );
      setTimeout(() => {
        scanner.stop().catch(() => {});
        setScanning(false);
      }, 15000);
    } catch {
      setScanning(false);
      toast.error("لا يمكن الوصول للكاميرا");
    }
  };

  const handleCompleteSale = () => completeSale.mutate();

  const completeSale = useMutation({
    mutationFn: async () => {
      const { data: saleNum } = await supabase.rpc("generate_sale_number" as any);
      const { data: sale, error } = await (supabase.from("sales" as any) as any).insert({
        sale_number: saleNum,
        cashier_id: user?.id,
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: paid,
        change_amount: changeAmount > 0 ? changeAmount : 0,
        payment_method: paymentMethod,
        status: "completed",
      }).select().single();
      if (error) throw error;

      const items = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.name,
        barcode: item.barcode,
        unit: item.unit,
        quantity: item.qty,
        unit_price: item.selling_price,
        discount_percent: item.discount,
        total_price: item.total,
      }));
      await (supabase.from("sale_items" as any) as any).insert(items);

      for (const item of cart) {
        const { data: product } = await supabase.from("products").select("current_stock").eq("id", item.product_id).single();
        await supabase.from("products").update({
          current_stock: (product?.current_stock ?? 0) - item.qty,
        }).eq("id", item.product_id);
      }

      return { sale, saleNum };
    },
    onSuccess: ({ sale, saleNum }) => {
      setLastSale({ ...sale, sale_number: saleNum, items: [...cart], storeName });
      setReceiptOpen(true);
      setCart([]);
      setPaidAmount("");
      setPaymentMethod("cash");
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      toast.success(`تم البيع بنجاح - رقم: ${saleNum}`);
      logActivity({ actionType: "create", module: "pos", description: `عملية بيع من نقطة البيع: ${saleNum}`, details: { sale_number: saleNum, total: sale.total_amount } });
    },
    onError: () => toast.error("حدث خطأ أثناء إتمام البيع"),
  });

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        document.getElementById("pos-search")?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("paid-amount")?.focus();
      }
      if (e.key === "F3") {
        e.preventDefault();
        setPaidAmount(totalAmount.toFixed(2));
      }
      if (e.key === "F4" && cart.length > 0 && paid >= totalAmount) {
        e.preventDefault();
        handleCompleteSale();
      }
      if (e.key === "Escape") {
        setSearch("");
        document.getElementById("pos-search")?.focus();
      }
      if (e.key === "Delete" && e.ctrlKey) {
        e.preventDefault();
        if (cart.length > 0) setClearConfirm(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, cart, paid, totalAmount]);

  const quickAmounts = [10, 20, 50, 100, 200];
  const paymentLabels = { cash: "💵 نقد", card: "💳 بطاقة", other: "📱 أخرى" };

  // --- Cart Content ---
  const cartContent = (
    <div className="flex flex-col gap-3 md:gap-4 flex-1 min-h-0">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={searchRef}
            id="pos-search"
            className="pr-10 text-[16px] md:text-lg h-12"
            placeholder="ابحث بالاسم أو الباركود..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {search && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 bg-card border rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto">
              {searchResults.map(p => (
                <button key={p.id} className="w-full text-right px-4 py-3 min-h-[44px] hover:bg-muted flex justify-between items-center" onClick={() => addToCart(p)}>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground" dir="ltr">{formatCurrency(p.selling_price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleScan}>
          <Camera className="h-5 w-5" />
        </Button>
        {!isMobile && (
          <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => setShortcutsOpen(true)} title="اختصارات لوحة المفاتيح">
            <Keyboard className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div id="qr-reader" className={scanning ? "h-48" : "hidden"} />

      {/* Quick Products */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {quickProducts.map(p => (
          <button key={p.id} onClick={() => addToCart(p)} className="flex flex-col items-center gap-1 p-2 rounded-lg border bg-card hover:bg-muted transition-colors text-center min-h-[44px]">
            <Package className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
            <span className="text-xs font-medium line-clamp-2">{p.name}</span>
            <span className="text-xs text-primary font-bold" dir="ltr">{formatCurrency(p.selling_price)}</span>
          </button>
        ))}
      </div>

      {/* Cart Table */}
      <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
        <CardContent className="p-0 flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
              <ShoppingBasket className="h-12 w-12 md:h-16 md:w-16" />
              <p>أضف منتجات للبدء</p>
            </div>
          ) : isMobile ? (
            // Mobile cart - card style
            <div className="divide-y">
              {cart.map(c => (
                <div key={c.product_id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.name}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(c.product_id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground" dir="ltr">{formatCurrency(c.selling_price)}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => updateQty(c.product_id, c.qty - 1)} disabled={c.qty <= 1}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-bold">{c.qty}</span>
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => updateQty(c.product_id, c.qty + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="font-semibold text-sm" dir="ltr">{formatCurrency(c.total)}</span>
                  </div>
                  {c.qty > c.current_stock && (
                    <span className="text-xs text-destructive">المخزون: {c.current_stock}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Desktop cart - table style
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead className="w-20">السعر</TableHead>
                  <TableHead className="w-20">الكمية</TableHead>
                  <TableHead className="w-20">خصم%</TableHead>
                  <TableHead className="w-24">الإجمالي</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map(c => (
                  <TableRow key={c.product_id}>
                    <TableCell>
                      <div>{c.name}</div>
                      {c.qty > c.current_stock && (
                        <span className="text-xs text-destructive">المخزون: {c.current_stock}</span>
                      )}
                    </TableCell>
                    <TableCell dir="ltr" className="text-sm">{formatCurrency(c.selling_price)}</TableCell>
                    <TableCell>
                      <Input type="number" min={1} value={c.qty} onChange={e => updateQty(c.product_id, parseInt(e.target.value) || 1)} className="h-8 w-16 text-center" dir="ltr" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0} max={100} value={c.discount} onChange={e => updateDiscount(c.product_id, parseFloat(e.target.value) || 0)} className="h-8 w-16 text-center" dir="ltr" />
                    </TableCell>
                    <TableCell dir="ltr" className="font-semibold">{formatCurrency(c.total)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(c.product_id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {cart.length > 0 && (
          <div className="border-t p-3 md:p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>المجموع الفرعي</span><span dir="ltr">{formatCurrency(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-destructive"><span>الخصم</span><span dir="ltr">-{formatCurrency(discountAmount)}</span></div>}
            {taxAmount > 0 && <div className="flex justify-between"><span>الضريبة ({taxRate}%)</span><span dir="ltr">{formatCurrency(taxAmount)}</span></div>}
            <Separator />
            <div className="flex justify-between text-lg font-bold"><span>الإجمالي</span><span dir="ltr">{formatCurrency(totalAmount)}</span></div>
            <Button variant="outline" size="sm" className="w-full mt-2 text-destructive" onClick={() => setClearConfirm(true)}>
              <Trash2 className="ml-2 h-4 w-4" />مسح الكارت
            </Button>
          </div>
        )}
      </Card>
    </div>
  );

  // --- Payment Content ---
  const paymentContent = (
    <Card className="flex-1 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">الدفع</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <div className="text-center p-4 bg-accent/10 rounded-lg">
          <p className="text-sm text-muted-foreground">المبلغ المستحق</p>
          <p className="text-3xl font-bold text-accent" dir="ltr">{formatCurrency(totalAmount)}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["cash", "card", "other"] as const).map(m => (
            <Button key={m} variant={paymentMethod === m ? "default" : "outline"} className="h-12 text-sm" onClick={() => setPaymentMethod(m)}>
              {paymentLabels[m]}
            </Button>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">المبلغ المدفوع</label>
          <Input id="paid-amount" type="number" dir="ltr" className="h-12 text-xl text-center font-bold text-[16px]" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
        </div>

        {paymentMethod === "cash" && (
          <div className="grid grid-cols-3 gap-2">
            {quickAmounts.map(a => (
              <Button key={a} variant="outline" size="sm" className="min-h-[44px]" onClick={() => setPaidAmount(a.toString())} dir="ltr">₪{a}</Button>
            ))}
            <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => setPaidAmount(totalAmount.toFixed(2))}>المبلغ بالضبط</Button>
          </div>
        )}

        <div className="text-center p-3 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">الباقي</p>
          <p className={`text-2xl font-bold ${changeAmount < 0 ? "text-destructive" : "text-primary"}`} dir="ltr">
            {formatCurrency(Math.max(0, changeAmount))}
          </p>
          {changeAmount < 0 && <p className="text-xs text-destructive">المبلغ غير كافٍ</p>}
        </div>

        <Button
          className="h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground mt-auto min-h-[56px]"
          disabled={cart.length === 0 || changeAmount < 0 || completeSale.isPending}
          onClick={() => completeSale.mutate()}
        >
          {completeSale.isPending ? "جاري المعالجة..." : "✓ إتمام البيع"}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      {/* Mobile Tab Bar */}
      {isMobile && (
        <div className="flex bg-card border-b rounded-lg overflow-hidden mb-3">
          <button
            onClick={() => setMobileTab("cart")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              mobileTab === "cart" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            🛒 السلة
            {cart.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{cart.length}</Badge>
            )}
          </button>
          <button
            onClick={() => setMobileTab("pay")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              mobileTab === "pay" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            💵 الدفع
            {cart.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{formatCurrency(totalAmount)}</Badge>
            )}
          </button>
        </div>
      )}

      {/* Layout */}
      <div className={isMobile ? "flex flex-col h-[calc(100vh-140px)]" : "flex gap-4 h-[calc(100vh-80px)]"}>
        {/* Cart Side */}
        <div className={`${isMobile ? (mobileTab === "cart" ? "flex flex-col flex-1 min-h-0" : "hidden") : "flex-[3] flex flex-col gap-4 min-w-0"}`}>
          {cartContent}
        </div>

        {/* Payment Side */}
        <div className={`${isMobile ? (mobileTab === "pay" ? "flex flex-col flex-1 min-h-0" : "hidden") : "flex-[2] flex flex-col gap-4 min-w-[280px]"}`}>
          {paymentContent}
        </div>
      </div>

      {/* Clear Cart Confirm */}
      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مسح الكارت</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من مسح جميع المنتجات؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setCart([]); setPaidAmount(""); }}>مسح</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إيصال البيع</DialogTitle></DialogHeader>
          {lastSale && (
            <div className="receipt-content space-y-4 text-sm" id="receipt">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold">{lastSale.storeName}</h2>
                <p className="text-muted-foreground">رقم الفاتورة: {lastSale.sale_number}</p>
                <p className="text-muted-foreground">{new Date().toLocaleString("ar-EG")}</p>
              </div>
              <Separator />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">المنتج</TableHead>
                    <TableHead className="text-xs">الكمية</TableHead>
                    <TableHead className="text-xs">السعر</TableHead>
                    <TableHead className="text-xs">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastSale.items?.map((item: CartItem, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{item.name}</TableCell>
                      <TableCell className="text-xs" dir="ltr">{item.qty}</TableCell>
                      <TableCell className="text-xs" dir="ltr">{formatCurrency(item.selling_price)}</TableCell>
                      <TableCell className="text-xs" dir="ltr">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <div className="space-y-1">
                <div className="flex justify-between"><span>المجموع الفرعي</span><span dir="ltr">{formatCurrency(lastSale.subtotal)}</span></div>
                {lastSale.discount_amount > 0 && <div className="flex justify-between"><span>الخصم</span><span dir="ltr">-{formatCurrency(lastSale.discount_amount)}</span></div>}
                {lastSale.tax_amount > 0 && <div className="flex justify-between"><span>الضريبة</span><span dir="ltr">{formatCurrency(lastSale.tax_amount)}</span></div>}
                <div className="flex justify-between font-bold text-base"><span>الإجمالي</span><span dir="ltr">{formatCurrency(lastSale.total_amount)}</span></div>
                <div className="flex justify-between"><span>المدفوع</span><span dir="ltr">{formatCurrency(lastSale.paid_amount)}</span></div>
                {lastSale.change_amount > 0 && <div className="flex justify-between"><span>الباقي</span><span dir="ltr">{formatCurrency(lastSale.change_amount)}</span></div>}
                <div className="flex justify-between"><span>طريقة الدفع</span><span>{paymentLabels[lastSale.payment_method as keyof typeof paymentLabels] ?? lastSale.payment_method}</span></div>
              </div>
              <Separator />
              <p className="text-center text-muted-foreground">شكراً لزيارتكم</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="ml-2 h-4 w-4" />طباعة</Button>
            <Button onClick={() => setReceiptOpen(false)}><Check className="ml-2 h-4 w-4" />إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" /> اختصارات لوحة المفاتيح
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {[
              ["F1", "التركيز على البحث"],
              ["F2", "التركيز على المبلغ المدفوع"],
              ["F3", "تعيين المبلغ المدفوع = الإجمالي"],
              ["F4", "إتمام البيع"],
              ["Escape", "مسح البحث"],
              ["Ctrl + Delete", "مسح السلة"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-muted-foreground">{desc}</span>
                <kbd className="px-2 py-1 text-xs bg-muted rounded border font-mono">{key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
