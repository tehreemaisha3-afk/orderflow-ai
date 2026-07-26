-- Extend business profile
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS contact_number text,
  ADD COLUMN IF NOT EXISTS business_email text,
  ADD COLUMN IF NOT EXISTS business_hours text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'PKR',
  ADD COLUMN IF NOT EXISTS website text;

-- Business settings (one row per business)
CREATE TABLE IF NOT EXISTS public.business_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  delivery_methods text[] NOT NULL DEFAULT '{}',
  delivery_charge numeric NOT NULL DEFAULT 0,
  free_delivery_threshold numeric,
  delivery_areas text[] NOT NULL DEFAULT '{}',
  delivery_time_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_methods text[] NOT NULL DEFAULT '{}',
  bank_account_title text,
  bank_account_number text,
  bank_name text,
  payment_instructions text,
  advance_payment_policy text,
  cod_policy text,
  return_policy text,
  shipping_policy text,
  canned_messages jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_instructions text,
  ai_tone text NOT NULL DEFAULT 'professional',
  escalation_rules text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business settings" ON public.business_settings FOR ALL
  USING (public.user_owns_business(business_id)) WITH CHECK (public.user_owns_business(business_id));
CREATE TRIGGER business_settings_updated_at BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  sku text,
  description text,
  price numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'piece',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products" ON public.products FOR ALL
  USING (public.user_owns_business(business_id)) WITH CHECK (public.user_owns_business(business_id));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS products_business_idx ON public.products(business_id);

-- Product aliases
CREATE TABLE IF NOT EXISTS public.product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, alias)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_aliases TO authenticated;
GRANT ALL ON public.product_aliases TO service_role;
ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own product aliases" ON public.product_aliases FOR ALL
  USING (public.user_owns_business(business_id)) WITH CHECK (public.user_owns_business(business_id));
CREATE INDEX IF NOT EXISTS product_aliases_business_idx ON public.product_aliases(business_id);

-- AI conversations (channel-agnostic)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'test',
  title text,
  escalated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai conversations" ON public.ai_conversations FOR ALL
  USING (public.user_owns_business(business_id)) WITH CHECK (public.user_owns_business(business_id));
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer','assistant')),
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversation_messages TO authenticated;
GRANT ALL ON public.ai_conversation_messages TO service_role;
ALTER TABLE public.ai_conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai conversation messages" ON public.ai_conversation_messages FOR ALL
  USING (public.user_owns_business(business_id)) WITH CHECK (public.user_owns_business(business_id));
CREATE INDEX IF NOT EXISTS ai_conv_messages_conv_idx ON public.ai_conversation_messages(conversation_id, created_at);