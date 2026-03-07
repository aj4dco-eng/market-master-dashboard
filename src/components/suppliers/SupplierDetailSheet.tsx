import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, MessageCircle, Star, Globe } from "lucide-react";
import type { Supplier } from "@/pages/SuppliersPage";

interface SupplierDetailSheetProps {
  supplier: Supplier | null;
  onClose: () => void;
}

function InfoRow({ label, value, dir }: { label: string; value: string | null | undefined; dir?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium" dir={dir}>{value}</span>
    </div>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ContactSection({ title, name, titleLabel, phone, whatsapp, email }: {
  title: string;
  name: string | null;
  titleLabel: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}) {
  if (!name && !phone && !email) return null;
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm">{title}</h4>
      {name && <InfoRow label="الاسم" value={name} />}
      {titleLabel && <InfoRow label="المسمى" value={titleLabel} />}
      {phone && <InfoRow label="الهاتف" value={phone} dir="ltr" />}
      {email && <InfoRow label="البريد" value={email} dir="ltr" />}
      <div className="flex gap-2 pt-1">
        {phone && (
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${phone}`}>
              <Phone className="ml-1 h-3.5 w-3.5" />
              اتصال
            </a>
          </Button>
        )}
        {whatsapp && (
          <Button variant="outline" size="sm" asChild>
            <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="ml-1 h-3.5 w-3.5" />
              واتساب
            </a>
          </Button>
        )}
        {email && (
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${email}`}>
              <Mail className="ml-1 h-3.5 w-3.5" />
              بريد
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

export function SupplierDetailSheet({ supplier, onClose }: SupplierDetailSheetProps) {
  if (!supplier) return null;

  const fmt = (n: number | null) => n != null ? `₪${n.toLocaleString("en-US")}` : "—";

  return (
    <Sheet open={!!supplier} onOpenChange={() => onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {supplier.company_name || supplier.name}
            <Badge variant={supplier.is_active ? "default" : "secondary"}>
              {supplier.is_active ? "نشط" : "غير نشط"}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Company Info */}
          <div className="space-y-1">
            <h3 className="font-semibold mb-2">بيانات الشركة</h3>
            <InfoRow label="اسم المورد" value={supplier.name} />
            <InfoRow label="اسم الشركة" value={supplier.company_name} />
            <InfoRow label="الرقم الضريبي" value={supplier.tax_number} dir="ltr" />
            <InfoRow label="الهاتف" value={supplier.phone} dir="ltr" />
            <InfoRow label="البريد" value={supplier.email} dir="ltr" />
            <InfoRow label="المدينة" value={supplier.city} />
            <InfoRow label="العنوان" value={supplier.address} />
            {supplier.website && (
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground text-sm">الموقع</span>
                <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1" dir="ltr">
                  <Globe className="h-3 w-3" />
                  {supplier.website}
                </a>
              </div>
            )}
            <div className="flex justify-between py-1.5 items-center">
              <span className="text-muted-foreground text-sm">التقييم</span>
              <RatingStars rating={supplier.rating} />
            </div>
          </div>

          <Separator />

          {/* Financial */}
          <div className="space-y-1">
            <h3 className="font-semibold mb-2">البيانات المالية</h3>
            <InfoRow label="شروط الدفع" value={supplier.payment_terms} />
            <InfoRow label="حد الائتمان" value={fmt(supplier.credit_limit)} dir="ltr" />
            <InfoRow label="أيام الائتمان" value={supplier.credit_days?.toLocaleString("en-US") ?? "—"} dir="ltr" />
            <InfoRow label="حد الطلبية الواحدة" value={fmt(supplier.single_order_limit)} dir="ltr" />
            <InfoRow label="الحد الشهري" value={fmt(supplier.monthly_limit)} dir="ltr" />
          </div>

          <Separator />

          {/* Contacts */}
          <ContactSection
            title="جهة الاتصال الأولى"
            name={supplier.contact1_name}
            titleLabel={supplier.contact1_title}
            phone={supplier.contact1_phone}
            whatsapp={supplier.contact1_whatsapp}
            email={supplier.contact1_email}
          />

          <ContactSection
            title="جهة الاتصال الثانية"
            name={supplier.contact2_name}
            titleLabel={supplier.contact2_title}
            phone={supplier.contact2_phone}
            whatsapp={supplier.contact2_whatsapp}
            email={supplier.contact2_email}
          />

          {supplier.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">ملاحظات</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{supplier.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
