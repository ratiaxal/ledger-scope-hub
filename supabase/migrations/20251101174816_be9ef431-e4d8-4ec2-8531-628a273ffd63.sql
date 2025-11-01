-- Create warehouses table
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Create policies for warehouses
CREATE POLICY "Authenticated users can view warehouses"
ON public.warehouses
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert warehouses"
ON public.warehouses
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update warehouses"
ON public.warehouses
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete warehouses"
ON public.warehouses
FOR DELETE
USING (true);

-- Add warehouse_id to products table
ALTER TABLE public.products
ADD COLUMN warehouse_id UUID REFERENCES public.warehouses(id);

-- Add warehouse_id to finance_entries table
ALTER TABLE public.finance_entries
ADD COLUMN warehouse_id UUID REFERENCES public.warehouses(id);

-- Add warehouse_id to inventory_transactions table
ALTER TABLE public.inventory_transactions
ADD COLUMN warehouse_id UUID REFERENCES public.warehouses(id);

-- Insert default warehouses
INSERT INTO public.warehouses (name) VALUES ('Main Warehouse'), ('Village Warehouse');

-- Create trigger for warehouses updated_at
CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();