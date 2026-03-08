
CREATE POLICY "Non-admin can insert suppliers"
ON public.suppliers FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR check_permission(auth.uid(), 'suppliers'::text, 'create'::text)
);

CREATE POLICY "Non-admin can update suppliers"
ON public.suppliers FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR check_permission(auth.uid(), 'suppliers'::text, 'edit'::text)
);
