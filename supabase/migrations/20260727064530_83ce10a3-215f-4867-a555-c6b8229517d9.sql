ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ai_conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS inventory_reserved boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS orders_ai_conversation_unique
  ON public.orders (ai_conversation_id)
  WHERE ai_conversation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_order_inventory(_order_id uuid, _direction integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products p
  SET stock = GREATEST(0, p.stock - (_direction * i.quantity)),
      updated_at = now()
  FROM public.order_items i
  WHERE i.order_id = _order_id
    AND i.product_id = p.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_order_inventory(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _business_id uuid;
  _reserved boolean;
BEGIN
  SELECT o.business_id, o.inventory_reserved INTO _business_id, _reserved
  FROM public.orders o WHERE o.id = _order_id;

  IF _business_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF NOT public.user_owns_business(_business_id) THEN
    RAISE EXCEPTION 'Not authorised for this order';
  END IF;
  IF _reserved THEN
    RETURN;
  END IF;

  PERFORM public.apply_order_inventory(_order_id, 1);
  UPDATE public.orders SET inventory_reserved = true, updated_at = now() WHERE id = _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_order_inventory(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_orders_inventory_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND OLD.inventory_reserved THEN
    PERFORM public.apply_order_inventory(NEW.id, -1);
    NEW.inventory_reserved := false;
  ELSIF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' AND NOT OLD.inventory_reserved THEN
    PERFORM public.apply_order_inventory(NEW.id, 1);
    NEW.inventory_reserved := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_inventory_on_status ON public.orders;
CREATE TRIGGER orders_inventory_on_status
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_inventory_on_status();