-- Update the delete policy for companies table to allow authenticated users
DROP POLICY IF EXISTS "Only admins can delete companies" ON public.companies;

CREATE POLICY "Authenticated users can delete companies" 
ON public.companies 
FOR DELETE 
TO authenticated
USING (true);