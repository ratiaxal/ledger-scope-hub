
-- Add missing UPDATE and DELETE policies for inventory_transactions
CREATE POLICY "Authenticated users can update inventory transactions"
ON public.inventory_transactions
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete inventory transactions"
ON public.inventory_transactions
FOR DELETE
USING (true);
