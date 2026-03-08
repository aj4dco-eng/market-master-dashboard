
-- =====================================================
-- 1. Fix user_permission_overrides: restrict SELECT to own or admin
-- =====================================================
DROP POLICY IF EXISTS "authenticated_read_user_overrides" ON public.user_permission_overrides;

CREATE POLICY "read_own_or_admin_user_overrides"
  ON public.user_permission_overrides FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- =====================================================
-- 2. Restrict product-images upload/update to users with products permission
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;

CREATE POLICY "Authorized users can upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.check_permission(auth.uid(), 'products', 'create')
    )
  );

CREATE POLICY "Authorized users can update product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.check_permission(auth.uid(), 'products', 'edit')
    )
  );

-- =====================================================
-- 3. Update RLS on products to use check_permission for granular control
-- =====================================================
DROP POLICY IF EXISTS "Employee can insert products" ON public.products;
DROP POLICY IF EXISTS "Employee can update products" ON public.products;
DROP POLICY IF EXISTS "Employee can select products" ON public.products;
DROP POLICY IF EXISTS "Accountant can read products" ON public.products;

CREATE POLICY "Non-admin can select products" ON public.products
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'products', 'view')
  );

CREATE POLICY "Non-admin can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'products', 'create')
  );

CREATE POLICY "Non-admin can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'products', 'edit')
  );

-- =====================================================
-- 4. Update RLS on purchase_orders
-- =====================================================
DROP POLICY IF EXISTS "Employee select purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Employee insert purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Employee update purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Accountant select purchase_orders" ON public.purchase_orders;

CREATE POLICY "Non-admin can select purchase_orders" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'orders', 'view')
  );

CREATE POLICY "Non-admin can insert purchase_orders" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'orders', 'create')
  );

CREATE POLICY "Non-admin can update purchase_orders" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'orders', 'edit')
  );

-- =====================================================
-- 5. Update RLS on purchase_order_items
-- =====================================================
DROP POLICY IF EXISTS "Employee select purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Employee insert purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Employee update purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Accountant select purchase_order_items" ON public.purchase_order_items;

CREATE POLICY "Non-admin can select purchase_order_items" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'orders', 'view')
  );

CREATE POLICY "Non-admin can insert purchase_order_items" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'orders', 'create')
  );

CREATE POLICY "Non-admin can update purchase_order_items" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'orders', 'edit')
  );

-- =====================================================
-- 6. Update RLS on categories
-- =====================================================
DROP POLICY IF EXISTS "Employee can read categories" ON public.categories;
DROP POLICY IF EXISTS "Accountant can read categories" ON public.categories;
DROP POLICY IF EXISTS "Employee can insert categories" ON public.categories;

CREATE POLICY "Non-admin can select categories" ON public.categories
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'products', 'view')
  );

CREATE POLICY "Non-admin can insert categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'products', 'create')
  );

-- =====================================================
-- 7. Update RLS on sales/sale_items
-- =====================================================
DROP POLICY IF EXISTS "employee_manage_sales" ON public.sales;
DROP POLICY IF EXISTS "accountant_read_sales" ON public.sales;

CREATE POLICY "Non-admin can select sales" ON public.sales
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'sales', 'view')
  );

CREATE POLICY "Non-admin can insert sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'sales', 'create')
  );

CREATE POLICY "Non-admin can update sales" ON public.sales
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'sales', 'edit')
  );

DROP POLICY IF EXISTS "employee_manage_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "accountant_read_sale_items" ON public.sale_items;

CREATE POLICY "Non-admin can select sale_items" ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'sales', 'view')
  );

CREATE POLICY "Non-admin can insert sale_items" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'sales', 'create')
  );

CREATE POLICY "Non-admin can update sale_items" ON public.sale_items
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'sales', 'edit')
  );

-- =====================================================
-- 8. Update RLS on expenses
-- =====================================================
DROP POLICY IF EXISTS "accountant_full_expenses" ON public.expenses;
DROP POLICY IF EXISTS "employee_read_expenses" ON public.expenses;

CREATE POLICY "Non-admin can select expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'expenses', 'view')
  );

CREATE POLICY "Non-admin can insert expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'expenses', 'create')
  );

CREATE POLICY "Non-admin can update expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'expenses', 'edit')
  );

CREATE POLICY "Non-admin can delete expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'expenses', 'delete')
  );

-- =====================================================
-- 9. Update RLS on invoices
-- =====================================================
DROP POLICY IF EXISTS "accountant_full_invoices" ON public.invoices;
DROP POLICY IF EXISTS "employee_read_invoices" ON public.invoices;

CREATE POLICY "Non-admin can select invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'invoices', 'view')
  );

CREATE POLICY "Non-admin can insert invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'invoices', 'create')
  );

CREATE POLICY "Non-admin can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'invoices', 'edit')
  );

-- =====================================================
-- 10. Update RLS on payments
-- =====================================================
DROP POLICY IF EXISTS "accountant_full_payments" ON public.payments;

CREATE POLICY "Non-admin can select payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'invoices', 'view')
  );

CREATE POLICY "Non-admin can insert payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'invoices', 'create')
  );

CREATE POLICY "Non-admin can update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'invoices', 'edit')
  );

-- =====================================================
-- 11. Update RLS on inventory
-- =====================================================
DROP POLICY IF EXISTS "authenticated_read_items" ON public.inventory_items;
DROP POLICY IF EXISTS "all_roles_manage_inventory_items" ON public.inventory_items;

CREATE POLICY "Authorized select inventory_items" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'inventory', 'view')
  );

CREATE POLICY "Authorized insert inventory_items" ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'inventory', 'create')
  );

CREATE POLICY "Authorized update inventory_items" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_permission(auth.uid(), 'inventory', 'edit')
  );
