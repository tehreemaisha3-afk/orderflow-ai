
CREATE OR REPLACE FUNCTION public.user_owns_business(_business_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.user_owns_business(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_business(UUID) TO authenticated, service_role;
