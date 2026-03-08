import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { logActivity } = useActivityLog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*, products(count)").order("name");
      return data ?? [];
    },
  });

  const openAdd = () => { setEditingCat(null); setName(""); setDescription(""); setDialogOpen(true); };
  const openEdit = (c: any) => { setEditingCat(c); setName(c.name); setDescription(c.description ?? ""); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCat) {
        const { error } = await supabase.from("categories").update({ name, description }).eq("id", editingCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ name, description });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDialogOpen(false);
      toast.success(editingCat ? "تم تحديث الصنف" : "تم إضافة الصنف");
      logActivity({ actionType: editingCat ? "update" : "create", module: "categories", description: editingCat ? `تعديل صنف: ${name}` : `إضافة صنف: ${name}` });
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDeleteId(null);
      toast.success("تم حذف الصنف");
      logActivity({ actionType: "delete", module: "categories", description: "حذف صنف", details: { category_id: id } });
    },
    onError: () => toast.error("لا يمكن حذف الصنف - قد يكون مرتبطاً بمنتجات"),
  });

  const catToDelete = categories?.find(c => c.id === deleteId);
  const productCount = (catToDelete as any)?.products?.[0]?.count ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tags className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">الأصناف</h1>
            <Badge variant="secondary">{categories?.length ?? 0}</Badge>
          </div>
          {canCreate("categories") && (
            <Button onClick={openAdd}><Plus className="ml-2 h-4 w-4" />إضافة صنف</Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>عدد المنتجات</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.description ?? "-"}</TableCell>
                      <TableCell dir="ltr">{c.products?.[0]?.count ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canEdit("categories") && (
                            <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          )}
                          {canDelete("categories") && (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!categories || categories.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد أصناف</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCat ? "تعديل الصنف" : "إضافة صنف جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>الاسم *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>الوصف</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()}>
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصنف</AlertDialogTitle>
            <AlertDialogDescription>
              {productCount > 0
                ? `لا يمكن حذف هذا الصنف لأنه مرتبط بـ ${productCount} منتج.`
                : "هل أنت متأكد من حذف هذا الصنف؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            {productCount === 0 && (
              <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
