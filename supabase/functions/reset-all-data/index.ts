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

    // Step 1: Get all orders with their order lines to restore stock
    const { data: orders, error: ordersError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        status,
        order_lines (
          product_id,
          quantity
        )
      `)

    if (ordersError) throw ordersError

    // Step 2: For completed orders, restore product stock to warehouse
    if (orders && orders.length > 0) {
      // Aggregate quantities per product from completed orders
      const stockToRestore = new Map<string, number>()

      for (const order of orders) {
        if (order.status === 'completed' && order.order_lines) {
          for (const line of order.order_lines) {
            const current = stockToRestore.get(line.product_id) || 0
            stockToRestore.set(line.product_id, current + line.quantity)
          }
        }
      }

      // Restore stock for each product
      for (const [productId, quantity] of stockToRestore) {
        const { data: product } = await supabaseClient
          .from('products')
          .select('current_stock')
          .eq('id', productId)
          .single()

        if (product) {
          await supabaseClient
            .from('products')
            .update({ current_stock: product.current_stock + quantity })
            .eq('id', productId)
        }
      }

      // Step 3: Delete all order lines
      const orderIds = orders.map(o => o.id)
      await supabaseClient
        .from('order_lines')
        .delete()
        .in('order_id', orderIds)
    }

    // Step 4: Delete all finance entries
    const { data: deletedFinance, error: financeError } = await supabaseClient
      .from('finance_entries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // delete all
      .select()

    if (financeError) throw financeError

    // Step 5: Delete all inventory transactions
    const { error: invError } = await supabaseClient
      .from('inventory_transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (invError) throw invError

    // Step 6: Delete all orders
    const { data: deletedOrders, error: delOrdersError } = await supabaseClient
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select()

    if (delOrdersError) throw delOrdersError

    return new Response(
      JSON.stringify({
        success: true,
        deleted_orders: deletedOrders?.length || 0,
        deleted_finance_entries: deletedFinance?.length || 0,
        message: `System reset complete. Deleted ${deletedOrders?.length || 0} orders and ${deletedFinance?.length || 0} finance entries. Product stock restored.`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in reset-all-data:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
