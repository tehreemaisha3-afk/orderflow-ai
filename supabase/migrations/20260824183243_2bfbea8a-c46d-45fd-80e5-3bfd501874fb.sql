CREATE TABLE public.order_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'test',
  status text NOT NULL DEFAULT 'pending',
  detected_language text,
  confidence numeric NOT NULL DEFAULT 0,
  source_message text,
  extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_note text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_drafts_status_check CHECK (status IN ('pending','approved','rejected'))
);

CREATE UNIQUE INDEX order_drafts_pending_per_conversation
  ON public.order_drafts (conversation_id)
  WHERE status = 'pending' AND conversation_id IS NOT NULL;

CREATE INDEX order_drafts_business_status_idx
  ON public.order_drafts (business_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_drafts TO authenticated;
GRANT ALL ON public.order_drafts TO service_role;

ALTER TABLE public.order_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own order drafts"
  ON public.order_drafts
  FOR ALL
  TO authenticated
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

CREATE TRIGGER order_drafts_updated_at
  BEFORE UPDATE ON public.order_drafts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();