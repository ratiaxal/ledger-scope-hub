-- Update the delete policy for products table to allow authenticated users
DROP POLICY IF EXISTS "Only admins can delete products" ON public.products;

CREATE POLICY "Authenticated users can delete products" 
ON public.products 
FOR DELETE 
TO authenticated
USING (true);