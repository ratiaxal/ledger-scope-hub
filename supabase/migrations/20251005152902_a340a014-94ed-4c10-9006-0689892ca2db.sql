-- Drop the existing restrictive DELETE policies
DROP POLICY IF EXISTS "Only admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Only admins can delete order lines" ON public.order_lines;
DROP POLICY IF EXISTS "Only admins can delete finance entries" ON public.finance_entries;

-- Create new DELETE policies that allow authenticated users to delete
CREATE POLICY "Authenticated users can delete orders" 
ON public.orders 
FOR DELETE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete order lines" 
ON public.order_lines 
FOR DELETE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete finance entries" 
ON public.finance_entries 
FOR DELETE 
TO authenticated
USING (true);