import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, LayoutGrid, List, Package, AlertTriangle, Edit, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { ProductDialog } from "@/components/products/ProductDialog";
import { useToast } from "@/hooks/use-toast";

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string | null;
  purchase_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_alert: number;
  image_url: string | null;
  image_thumbnail: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ProductsPage() {
  const { role } = useAuth();
  const perm = usePermissions();
  const { logActivity } = useActivityLog();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    const saved = localStorage.getItem("products-view-mode");
    return saved === "grid" ? "grid" : "table";
  });
  const handleViewMode = (mode: "grid" | "table") => {
    setViewMode(mode);
    localStorage.setItem("products-view-mode", mode);
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, company_name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("products-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم تعطيل المنتج بنجاح" });
      setDeactivateId(null);
      logActivity({ actionType: "delete", module: "products", description: "تعطيل منتج", details: { product_id: id } });
    },
  });

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || p.category_id === categoryFilter;
    const matchSupplier = supplierFilter === "all" || p.supplier_id === supplierFilter;
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && p.is_active) ||
      (statusFilter === "inactive" && !p.is_active);
    return matchSearch && matchCategory && matchSupplier && matchStatus;
  });

  const lowStockProducts = products.filter(
    (p) => p.is_active && (p.current_stock ?? 0) <= (p.min_stock_alert ?? 0) && (p.min_stock_alert ?? 0) > 0
  );

  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";
  const getSupplierName = (id: string | null) => {
    const s = suppliers.find((s) => s.id === id);
    return s ? (s.company_name || s.name) : "—";
  };

  const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const getStockColor = (stock: number, min: number) => {
    if (min > 0 && stock <= min) return "text-destructive font-semibold";
    return "text-accent font-semibold";
  };

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("المنتجات");
    ws.views = [{ rightToLeft: true }];
    ws.columns = [
      { header: "الاسم", key: "name", width: 30 },
      { header: "الباركود", key: "barcode", width: 18 },
      { header: "الصنف", key: "category", width: 18 },
      { header: "المورد", key: "supplier", width: 20 },
      { header: "الوحدة", key: "unit", width: 12 },
      { header: "سعر الشراء", key: "purchase_price", width: 14 },
      { header: "سعر البيع", key: "selling_price", width: 14 },
      { header: "المخزون", key: "current_stock", width: 12 },
      { header: "الحد الأدنى", key: "min_stock", width: 12 },
      { header: "الحالة", key: "status", width: 10 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

    filtered.forEach((p) => {
      ws.addRow({
        name: p.name,
        barcode: p.barcode || "",
        category: getCategoryName(p.category_id),
        supplier: getSupplierName(p.supplier_id),
        unit: p.unit || "",
        purchase_price: p.purchase_price,
        selling_price: p.selling_price,
        current_stock: p.current_stock ?? 0,
        min_stock: p.min_stock_alert ?? 0,
        status: p.is_active ? "نشط" : "غير نشط",
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم تصدير المنتجات بنجاح" });
  };

  const getImageUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/${url}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Low stock banner */}
        {lowStockProducts.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="font-semibold">
              {lowStockProducts.length.toLocaleString("en-US")} منتج تحت الحد الأدنى للمخزون
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">المنتجات</h1>
            <Badge variant="secondary">{products.length.toLocaleString("en-US")}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="rounded-none h-9 w-9"
                onClick={() => handleViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="icon"
                className="rounded-none h-9 w-9"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" onClick={exportToExcel} disabled={filtered.length === 0}>
              <Download className="ml-2 h-4 w-4" />
              تصدير Excel
            </Button>
            {perm.canCreate("products") && (
              <Button onClick={() => { setEditingProduct(null); setDialogOpen(true); }}>
                <Plus className="ml-2 h-4 w-4" />
                إضافة منتج
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الباركود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="الصنف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأصناف</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="المورد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الموردين</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.company_name || s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 space-y-3">
                <Skeleton className="h-32 w-full rounded" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="mx-auto h-12 w-12 mb-3 opacity-30" />
            لا توجد منتجات
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((product) => {
              const imgUrl = getImageUrl(product.image_url);
              return (
                <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="h-36 bg-muted flex items-center justify-center overflow-hidden">
                      {imgUrl ? (
                        <img src={imgUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                        {!product.is_active && <Badge variant="secondary" className="text-[10px] shrink-0">غير نشط</Badge>}
                      </div>
                      {product.barcode && (
                        <p className="text-xs text-muted-foreground" dir="ltr">{product.barcode}</p>
                      )}
                      <Badge variant="outline" className="text-[10px]">{getCategoryName(product.category_id)}</Badge>
                      <div className="flex justify-between items-center text-xs" dir="ltr">
                        <span className="text-muted-foreground">شراء: {formatCurrency(product.purchase_price)}</span>
                        <span className="font-semibold">بيع: {formatCurrency(product.selling_price)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs ${getStockColor(product.current_stock ?? 0, product.min_stock_alert ?? 0)}`}>
                          مخزون: {(product.current_stock ?? 0).toLocaleString("en-US")}
                        </span>
                        {perm.canEdit("products") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingProduct(product); setDialogOpen(true); }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصورة</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الباركود</TableHead>
                  <TableHead>الصنف</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>سعر الشراء</TableHead>
                  <TableHead>سعر البيع</TableHead>
                  <TableHead>المخزون</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => {
                  const imgUrl = getImageUrl(product.image_url);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell dir="ltr" className="text-right text-xs">{product.barcode || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{getCategoryName(product.category_id)}</Badge></TableCell>
                      <TableCell className="text-xs">{getSupplierName(product.supplier_id)}</TableCell>
                      <TableCell dir="ltr" className="text-right">{formatCurrency(product.purchase_price)}</TableCell>
                      <TableCell dir="ltr" className="text-right font-semibold">{formatCurrency(product.selling_price)}</TableCell>
                      <TableCell>
                        <span className={getStockColor(product.current_stock ?? 0, product.min_stock_alert ?? 0)}>
                          {(product.current_stock ?? 0).toLocaleString("en-US")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {perm.canEdit("products") && (
                            <Button variant="ghost" size="sm" onClick={() => { setEditingProduct(product); setDialogOpen(true); }}>
                              تعديل
                            </Button>
                          )}
                          {perm.canDelete("products") && product.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeactivateId(product.id)}
                            >
                              تعطيل
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        categories={categories}
        suppliers={suppliers}
      />

      <AlertDialog open={!!deactivateId} onOpenChange={(open) => !open && setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تعطيل المنتج</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من تعطيل هذا المنتج؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deactivateId && deactivateMutation.mutate(deactivateId)}>
              تعطيل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
