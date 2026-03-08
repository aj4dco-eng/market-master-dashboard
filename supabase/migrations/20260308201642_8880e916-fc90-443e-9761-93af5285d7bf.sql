
-- Fix get_user_role: only allow querying own role or admin
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Allow querying own role or if caller is admin
  IF auth.uid() IS DISTINCT FROM _user_id AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NULL;
  END IF;
  
  RETURN (SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1);
END;
$$;

-- Fix has_role: restrict to own uid or admin caller (but allow RLS internal calls where auth.uid() = _user_id)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- RLS policies always pass auth.uid() as _user_id, so this is transparent.
  -- Block non-admin users from querying other users' roles.
  IF auth.uid() IS DISTINCT FROM _user_id AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Fix check_permission: restrict to own uid or admin caller
CREATE OR REPLACE FUNCTION public.check_permission(_user_id uuid, _module text, _action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _override boolean;
  _role_allowed boolean;
  _user_role app_role;
BEGIN
  -- Block non-admin users from querying other users' permissions
  IF auth.uid() IS DISTINCT FROM _user_id AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN false;
  END IF;

  -- Check user override first
  SELECT allowed INTO _override
  FROM user_permission_overrides
  WHERE user_id = _user_id AND module = _module AND action = _action;
  
  IF _override IS NOT NULL THEN
    RETURN _override;
  END IF;
  
  -- Fall back to role default
  SELECT role INTO _user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF _user_role IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT allowed INTO _role_allowed
  FROM role_permissions
  WHERE role = _user_role AND module = _module AND action = _action;
  
  RETURN COALESCE(_role_allowed, false);
END;
$$;
