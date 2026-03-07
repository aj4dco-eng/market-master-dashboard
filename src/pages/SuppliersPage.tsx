import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Star, Phone, Eye } from "lucide-react";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { SupplierDetailSheet } from "@/components/suppliers/SupplierDetailSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export interface Supplier {
  id: string;
  name: string;
  company_name: string | null;
  tax_number: string | null;
  commercial_register: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  payment_terms: string | null;
  credit_limit: number | null;
  credit_days: number | null;
  contact1_name: string | null;
  contact1_title: string | null;
  contact1_phone: string | null;
  contact1_whatsapp: string | null;
  contact1_email: string | null;
  contact2_name: string | null;
  contact2_title: string | null;
  contact2_phone: string | null;
  contact2_whatsapp: string | null;
  contact2_email: string | null;
  single_order_limit: number | null;
  monthly_limit: number | null;
  rating: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function SuppliersPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const isAdmin = role === "admin";

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "تم تعطيل المورد بنجاح" });
    },
  });

  const filtered = suppliers.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search);
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && s.is_active) ||
      (statusFilter === "inactive" && !s.is_active);
    return matchSearch && matchStatus;
  });

  const formatNumber = (n: number | null) =>
    n != null ? n.toLocaleString("en-US") : "—";

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">الموردون</h1>
          {isAdmin && (
            <Button onClick={() => { setEditingSupplier(null); setDialogOpen(true); }}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة مورد
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو رقم الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            لا يوجد موردون
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الشركة</TableHead>
                  <TableHead>رقم الهاتف</TableHead>
                  <TableHead>شخص التواصل</TableHead>
                  <TableHead>التقييم</TableHead>
                  <TableHead>حد الطلبية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedSupplier(supplier)}
                  >
                    <TableCell className="font-medium">
                      {supplier.company_name || supplier.name}
                    </TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {supplier.phone || "—"}
                    </TableCell>
                    <TableCell>{supplier.contact1_name || "—"}</TableCell>
                    <TableCell>
                      <RatingStars rating={supplier.rating} />
                    </TableCell>
                    <TableCell dir="ltr" className="text-right">
                      ₪{formatNumber(supplier.single_order_limit)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.is_active ? "default" : "secondary"}>
                        {supplier.is_active ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedSupplier(supplier)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingSupplier(supplier);
                                setDialogOpen(true);
                              }}
                            >
                              تعديل
                            </Button>
                            {supplier.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deactivateMutation.mutate(supplier.id)}
                              >
                                تعطيل
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
      />

      <SupplierDetailSheet
        supplier={selectedSupplier}
        onClose={() => setSelectedSupplier(null)}
      />
    </DashboardLayout>
  );
}
