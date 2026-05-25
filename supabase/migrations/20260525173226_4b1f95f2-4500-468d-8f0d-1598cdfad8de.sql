
CREATE TABLE public.order_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_gifts_order_id ON public.order_gifts(order_id);
CREATE INDEX idx_order_gifts_product_id ON public.order_gifts(product_id);

ALTER TABLE public.order_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view order gifts"
  ON public.order_gifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert order gifts"
  ON public.order_gifts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update order gifts"
  ON public.order_gifts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete order gifts"
  ON public.order_gifts FOR DELETE TO authenticated USING (true);
