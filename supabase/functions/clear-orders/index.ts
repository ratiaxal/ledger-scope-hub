import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { companyId } = await req.json()

    // First, get all order IDs for this company
    const { data: ordersList, error: fetchError } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('company_id', companyId)

    if (fetchError) throw fetchError

    const orderIds = ordersList?.map(o => o.id) || []

    if (orderIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted_count: 0,
          message: 'No orders found to delete' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Delete order lines first (due to foreign key constraints)
    const { error: linesError } = await supabaseClient
      .from('order_lines')
      .delete()
      .in('order_id', orderIds)

    if (linesError) {
      console.error('Error deleting order lines:', linesError)
    }

    // Delete orders for the specified company
    const { data: orders, error: ordersError } = await supabaseClient
      .from('orders')
      .delete()
      .eq('company_id', companyId)
      .select()

    if (ordersError) throw ordersError

    // Also delete related inventory transactions
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id)
      await supabaseClient
        .from('inventory_transactions')
        .delete()
        .in('related_order_id', orderIds)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_count: orders?.length || 0,
        message: `Deleted ${orders?.length || 0} orders` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in clear-orders function:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
