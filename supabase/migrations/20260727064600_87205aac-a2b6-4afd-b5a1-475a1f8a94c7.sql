REVOKE ALL ON FUNCTION public.apply_order_inventory(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_orders_inventory_on_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_order_inventory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_order_inventory(uuid) TO authenticated;