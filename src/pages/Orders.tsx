import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, Package, Calendar, Trash2, Check, DollarSign } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit_price: number;
  current_stock: number;
}

interface OrderLine {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface Order {
  id: string;
  date: string;
  company: string;
  items: string;
  quantity: number;
  total: number;
  status: "open" | "completed" | "canceled";
  paymentStatus?: string;
  paymentReceived?: number;
  debtFlag?: boolean;
}

const Orders = () => {
  const { companyId } = useParams();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [newOrder, setNewOrder] = useState({
    company: "",
    customCompany: "",
    items: "",
    quantity: "",
    total: "",
    paymentAmount: "",
  });

  const [useCustomCompany, setUseCustomCompany] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrderForCompletion, setSelectedOrderForCompletion] = useState<{
    id: string;
    companyId: string | null;
    totalAmount: number;
  } | null>(null);
  const [paymentReceived, setPaymentReceived] = useState<boolean | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<{
    id: string;
    companyId: string | null;
    totalAmount: number;
    paymentReceived: number;
  } | null>(null);
  const [returnLines, setReturnLines] = useState<OrderLine[]>([]);
  const [showLaterPaymentDialog, setShowLaterPaymentDialog] = useState(false);
  const [selectedOrderForLaterPayment, setSelectedOrderForLaterPayment] = useState<{
    id: string;
    companyId: string | null;
    totalAmount: number;
    paymentReceived: number;
  } | null>(null);
  const [laterPaymentAmount, setLaterPaymentAmount] = useState("");
  const [laterPaymentMethod, setLaterPaymentMethod] = useState("");

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");

    if (error) {
      toast({
        title: "Error loading companies",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCompanies(data || []);
    }
  };

  const fetchOrders = async () => {
    let query = supabase
      .from("orders")
      .select(`
        *,
        companies (name),
        order_lines (
          id,
          quantity,
          unit_price,
          line_total,
          products (name)
        )
      `);
    
    // Filter by company if companyId is present
    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading orders",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const formattedOrders: any[] = (data || []).map((order: any) => ({
        id: order.id,
        date: new Date(order.created_at).toISOString().split("T")[0],
        company: order.manual_company_name || order.companies?.name || "Unknown",
        items: order.order_lines?.map((line: any) => 
          `${line.products?.name || "Unknown"} (${line.quantity})`
        ).join(", ") || "",
        quantity: order.total_quantity,
        total: parseFloat(order.total_amount),
        status: order.status as "open" | "completed" | "canceled",
        paymentStatus: order.payment_status,
        paymentReceived: parseFloat(order.payment_received_amount || 0),
        debtFlag: order.debt_flag,
      }));
      setOrders(formattedOrders);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Error loading products",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setProducts(data || []);
    }
  };

  const handleClearAllOrders = async () => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "Company ID not found",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Are you sure you want to delete all orders for this company? This action cannot be undone.")) {
      return;
    }

    setClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('clear-orders', {
        body: { companyId }
      });
      
      if (error) throw error;

      toast({
        title: "Success",
        description: `Cleared ${data.deleted_count} orders`,
      });
      
      fetchOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear orders",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const handleToggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleAddSelectedProducts = () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "No products selected",
        description: "Please select at least one product to add",
        variant: "destructive",
      });
      return;
    }

    const newLines: OrderLine[] = [];
    const alreadyAdded: string[] = [];

    selectedProducts.forEach(productId => {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const existingLine = orderLines.find(line => line.product_id === productId);
      if (existingLine) {
        alreadyAdded.push(product.name);
        return;
      }

      newLines.push({
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.unit_price,
        line_total: product.unit_price,
      });
    });

    if (newLines.length > 0) {
      setOrderLines([...orderLines, ...newLines]);
      setSelectedProducts(new Set());
      toast({
        title: "Products added",
        description: `${newLines.length} product(s) added to the order`,
      });
    }

    if (alreadyAdded.length > 0) {
      toast({
        title: "Some products already added",
        description: `${alreadyAdded.join(", ")} already in the order`,
        variant: "destructive",
      });
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setOrderLines(orderLines.map(line => 
      line.product_id === productId 
        ? { ...line, quantity, line_total: quantity * line.unit_price }
        : line
    ));
  };

  const handleUpdatePrice = (productId: string, price: number) => {
    setOrderLines(orderLines.map(line => 
      line.product_id === productId 
        ? { ...line, unit_price: price, line_total: line.quantity * price }
        : line
    ));
  };

  const handleRemoveProductLine = (productId: string) => {
    setOrderLines(orderLines.filter(line => line.product_id !== productId));
  };

  const calculateOrderTotal = () => {
    return orderLines.reduce((sum, line) => sum + line.line_total, 0);
  };

  const handleAddOrder = async () => {
    if ((!newOrder.company && !newOrder.customCompany) || orderLines.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select a company and add at least one product",
        variant: "destructive",
      });
      return;
    }

    const companyName = useCustomCompany ? newOrder.customCompany : newOrder.company;
    const selectedCompany = companies.find(c => c.name === newOrder.company);
    const paymentAmountValue = parseFloat(newOrder.paymentAmount) || 0;
    const orderTotal = calculateOrderTotal();

    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{
        company_id: useCustomCompany ? null : selectedCompany?.id,
        manual_company_name: useCustomCompany ? newOrder.customCompany : null,
        total_quantity: orderLines.reduce((sum, line) => sum + line.quantity, 0),
        total_amount: orderTotal,
        status: "open",
        payment_received_amount: paymentAmountValue,
        payment_status: paymentAmountValue >= orderTotal ? "paid" : (paymentAmountValue > 0 ? "partially_paid" : "unpaid"),
        debt_flag: paymentAmountValue < orderTotal,
      }])
      .select()
      .single();

    if (orderError) {
      toast({
        title: "Error creating order",
        description: orderError.message,
        variant: "destructive",
      });
      return;
    }

    // Insert order lines
    const { error: linesError } = await supabase
      .from("order_lines")
      .insert(orderLines.map(line => ({
        order_id: orderData.id,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_total: line.line_total,
      })));

    if (linesError) {
      toast({
        title: "Error adding order items",
        description: linesError.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Order created successfully" });
    setNewOrder({ company: "", customCompany: "", items: "", quantity: "", total: "", paymentAmount: "" });
    setOrderLines([]);
    setSelectedProducts(new Set());
    setShowForm(false);
    setUseCustomCompany(false);
    fetchOrders();
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: "open" | "completed" | "canceled") => {
    try {
      // If canceling a completed order, restore stock
      if (newStatus === "canceled") {
        const { data: orderData } = await supabase
          .from("orders")
          .select("status")
          .eq("id", orderId)
          .single();

        if (orderData?.status === "completed") {
          // Fetch order lines to restore stock
          const { data: orderLinesData, error: linesError } = await supabase
            .from("order_lines")
            .select("product_id, quantity")
            .eq("order_id", orderId);

          if (linesError) throw linesError;

          // Restore stock for each product
          for (const line of orderLinesData || []) {
            const { data: productData } = await supabase
              .from("products")
              .select("current_stock")
              .eq("id", line.product_id)
              .single();

            if (productData) {
              await supabase
                .from("products")
                .update({ current_stock: productData.current_stock + line.quantity })
                .eq("id", line.product_id);

              // Create inventory transaction record
              await supabase
                .from("inventory_transactions")
                .insert([{
                  product_id: line.product_id,
                  change_quantity: line.quantity,
                  reason: "correction",
                  related_order_id: orderId,
                  comment: "Stock restored from canceled order",
                }]);
            }
          }
        }
      }

      const { error } = await supabase
        .from("orders")
        .update({ 
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null
        })
        .eq("id", orderId);

      if (error) throw error;

      toast({ title: "Order status updated successfully" });
      fetchOrders();
    } catch (error) {
      toast({
        title: "Error updating order",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleInitiateOrderCompletion = async (orderId: string) => {
    // Fetch full order details
    const { data: orderData, error } = await supabase
      .from("orders")
      .select("id, company_id, total_amount")
      .eq("id", orderId)
      .single();

    if (error || !orderData) {
      toast({
        title: "Error loading order details",
        description: error?.message,
        variant: "destructive",
      });
      return;
    }

    setSelectedOrderForCompletion({
      id: orderData.id,
      companyId: orderData.company_id,
      totalAmount: Number(orderData.total_amount),
    });
    setPaymentAmount(String(orderData.total_amount));
    setPaymentReceived(null);
    setPaymentMethod("");
    setShowPaymentDialog(true);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      return;
    }

    try {
      // Delete related records first
      
      // 1. Delete order lines
      const { error: linesError } = await supabase
        .from("order_lines")
        .delete()
        .eq("order_id", orderId);
      
      if (linesError) throw linesError;

      // 2. Delete related finance entries
      const { error: financeError } = await supabase
        .from("finance_entries")
        .delete()
        .eq("related_order_id", orderId);
      
      if (financeError) throw financeError;

      // 3. Delete related inventory transactions
      const { error: inventoryError } = await supabase
        .from("inventory_transactions")
        .delete()
        .eq("related_order_id", orderId);
      
      if (inventoryError) throw inventoryError;

      // 4. Finally delete the order
      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (orderError) throw orderError;

      toast({ title: "Order deleted successfully" });
      fetchOrders();
    } catch (error) {
      toast({
        title: "Error deleting order",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleInitiateReturn = async (orderId: string) => {
    // Fetch full order details
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id, company_id, total_amount, payment_received_amount")
      .eq("id", orderId)
      .single();

    if (orderError || !orderData) {
      toast({
        title: "Error loading order details",
        description: orderError?.message,
        variant: "destructive",
      });
      return;
    }

    // Fetch order lines
    const { data: orderLinesData, error: linesError } = await supabase
      .from("order_lines")
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        line_total,
        products (name)
      `)
      .eq("order_id", orderId);

    if (linesError) {
      toast({
        title: "Error loading order items",
        description: linesError.message,
        variant: "destructive",
      });
      return;
    }

    const formattedLines: OrderLine[] = (orderLinesData || []).map((line: any) => ({
      product_id: line.product_id,
      product_name: line.products?.name || "Unknown",
      quantity: 0, // Start with 0, user will input return quantity
      unit_price: line.unit_price,
      line_total: 0,
    }));

    setSelectedOrderForReturn({
      id: orderData.id,
      companyId: orderData.company_id,
      totalAmount: Number(orderData.total_amount),
      paymentReceived: Number(orderData.payment_received_amount),
    });
    setReturnLines(formattedLines);
    setShowReturnDialog(true);
  };

  const handleUpdateReturnQuantity = (productId: string, quantity: number) => {
    setReturnLines(returnLines.map(line => 
      line.product_id === productId 
        ? { ...line, quantity, line_total: quantity * line.unit_price }
        : line
    ));
  };

  const calculateReturnTotal = () => {
    return returnLines.reduce((sum, line) => sum + line.line_total, 0);
  };

  const handleConfirmReturn = async () => {
    if (!selectedOrderForReturn) return;

    const returnTotal = calculateReturnTotal();
    if (returnTotal === 0) {
      toast({
        title: "No items to return",
        description: "Please specify quantities for items to return",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch current order lines
      const { data: currentOrderLines, error: fetchError } = await supabase
        .from("order_lines")
        .select("id, product_id, quantity, unit_price, line_total")
        .eq("order_id", selectedOrderForReturn.id);

      if (fetchError) throw fetchError;

      // Update order lines with returned quantities
      for (const returnLine of returnLines.filter(l => l.quantity > 0)) {
        const currentLine = currentOrderLines?.find(l => l.product_id === returnLine.product_id);
        if (!currentLine) continue;

        const newQuantity = currentLine.quantity - returnLine.quantity;
        
        if (newQuantity <= 0) {
          // Delete line if quantity is 0 or negative
          await supabase
            .from("order_lines")
            .delete()
            .eq("id", currentLine.id);
        } else {
          // Update line with reduced quantity
          await supabase
            .from("order_lines")
            .update({
              quantity: newQuantity,
              line_total: newQuantity * currentLine.unit_price,
            })
            .eq("id", currentLine.id);
        }

        // Add stock back to inventory
        const { data: productData } = await supabase
          .from("products")
          .select("current_stock")
          .eq("id", returnLine.product_id)
          .single();

        if (productData) {
          await supabase
            .from("products")
            .update({ current_stock: productData.current_stock + returnLine.quantity })
            .eq("id", returnLine.product_id);

          // Create inventory transaction record
          await supabase
            .from("inventory_transactions")
            .insert([{
              product_id: returnLine.product_id,
              change_quantity: returnLine.quantity,
              reason: "correction",
              related_order_id: selectedOrderForReturn.id,
              comment: "Stock returned from order",
            }]);
        }
      }

      // Calculate new order total
      const newTotalAmount = selectedOrderForReturn.totalAmount - returnTotal;
      const remainingDebt = Math.max(0, newTotalAmount - selectedOrderForReturn.paymentReceived);

      // Update order with new totals and debt status
      const { data: updatedOrderLines } = await supabase
        .from("order_lines")
        .select("quantity")
        .eq("order_id", selectedOrderForReturn.id);

      const totalQuantity = (updatedOrderLines || []).reduce((sum, line) => sum + line.quantity, 0);

      await supabase
        .from("orders")
        .update({
          total_quantity: totalQuantity,
          total_amount: newTotalAmount,
          debt_flag: remainingDebt > 0,
          payment_status: remainingDebt > 0 ? "unpaid" : "paid",
        })
        .eq("id", selectedOrderForReturn.id);

      // Create finance entry for the return
      if (selectedOrderForReturn.companyId) {
        await supabase
          .from("finance_entries")
          .insert([{
            company_id: selectedOrderForReturn.companyId,
            type: "expense",
            amount: -returnTotal, // Negative because it's a return
            comment: `Return for order ${selectedOrderForReturn.id}`,
            related_order_id: selectedOrderForReturn.id,
          }]);
      }

      toast({
        title: "Return processed successfully",
        description: `Returned items worth $${returnTotal.toFixed(2)}${remainingDebt > 0 ? `. Debt: $${remainingDebt.toFixed(2)}` : ""}`,
      });

      setShowReturnDialog(false);
      setSelectedOrderForReturn(null);
      setReturnLines([]);
      fetchOrders();
    } catch (error) {
      toast({
        title: "Error processing return",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleInitiateLaterPayment = async (orderId: string) => {
    const { data: orderData, error } = await supabase
      .from("orders")
      .select("id, company_id, total_amount, payment_received_amount")
      .eq("id", orderId)
      .single();

    if (error || !orderData) {
      toast({
        title: "შეცდომა შეკვეთის ჩატვირთვისას",
        description: error?.message,
        variant: "destructive",
      });
      return;
    }

    setSelectedOrderForLaterPayment({
      id: orderData.id,
      companyId: orderData.company_id,
      totalAmount: Number(orderData.total_amount),
      paymentReceived: Number(orderData.payment_received_amount),
    });
    setLaterPaymentAmount("");
    setLaterPaymentMethod("");
    setShowLaterPaymentDialog(true);
  };

  const handleConfirmLaterPayment = async () => {
    if (!selectedOrderForLaterPayment) return;

    if (!laterPaymentAmount || !laterPaymentMethod) {
      toast({
        title: "არასრული ინფორმაცია",
        description: "გთხოვთ შეიყვანოთ გადახდის თანხა და მეთოდი",
        variant: "destructive",
      });
      return;
    }

    const paymentAmountValue = parseFloat(laterPaymentAmount);
    if (paymentAmountValue <= 0) {
      toast({
        title: "არასწორი თანხა",
        description: "გადახდის თანხა უნდა იყოს დადებითი",
        variant: "destructive",
      });
      return;
    }

    try {
      const newTotalPayment = selectedOrderForLaterPayment.paymentReceived + paymentAmountValue;
      const remainingDebt = Math.max(0, selectedOrderForLaterPayment.totalAmount - newTotalPayment);
      const isFullyPaid = remainingDebt === 0;

      // Update order payment information
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          payment_received_amount: newTotalPayment,
          payment_status: isFullyPaid ? "paid" : "unpaid",
          debt_flag: !isFullyPaid,
        })
        .eq("id", selectedOrderForLaterPayment.id);

      if (orderError) throw orderError;

      // Create finance entry for the payment
      const { error: financeError } = await supabase
        .from("finance_entries")
        .insert({
          type: "income",
          amount: paymentAmountValue,
          company_id: selectedOrderForLaterPayment.companyId,
          related_order_id: selectedOrderForLaterPayment.id,
          comment: `გადახდა მიღებულია ${laterPaymentMethod}-ით დავალიანებული შეკვეთისთვის`,
        });

      if (financeError) throw financeError;

      toast({
        title: "გადახდა წარმატებით დარეგისტრირდა",
        description: isFullyPaid 
          ? `გადახდილია $${paymentAmountValue.toFixed(2)}. შეკვეთა სრულად დაფარულია.`
          : `გადახდილია $${paymentAmountValue.toFixed(2)}. დარჩენილი ვალი: $${remainingDebt.toFixed(2)}`,
      });

      setShowLaterPaymentDialog(false);
      setSelectedOrderForLaterPayment(null);
      setLaterPaymentAmount("");
      setLaterPaymentMethod("");
      fetchOrders();
    } catch (error) {
      toast({
        title: "შეცდომა გადახდის რეგისტრაციისას",
        description: error instanceof Error ? error.message : "უცნობი შეცდომა",
        variant: "destructive",
      });
    }
  };

  const handleConfirmOrderCompletion = async () => {
    if (!selectedOrderForCompletion) return;

    if (paymentReceived === null) {
      toast({
        title: "Please select payment status",
        description: "Indicate whether payment was received",
        variant: "destructive",
      });
      return;
    }

    if (paymentReceived && (!paymentAmount || !paymentMethod)) {
      toast({
        title: "Missing payment details",
        description: "Please enter payment amount and method",
        variant: "destructive",
      });
      return;
    }

    const paymentAmountValue = paymentReceived ? parseFloat(paymentAmount) : 0;

    // Fetch order lines to deduct stock
    const { data: orderLinesData, error: orderLinesError } = await supabase
      .from("order_lines")
      .select("product_id, quantity")
      .eq("order_id", selectedOrderForCompletion.id);

    if (orderLinesError) {
      toast({
        title: "Error fetching order details",
        description: orderLinesError.message,
        variant: "destructive",
      });
      return;
    }

    // Deduct stock for each product in the order
    for (const line of orderLinesData || []) {
      // Get current stock
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("current_stock")
        .eq("id", line.product_id)
        .single();

      if (productError) {
        toast({
          title: "Error fetching product stock",
          description: productError.message,
          variant: "destructive",
        });
        continue;
      }

      // Update stock
      const newStock = productData.current_stock - line.quantity;
      const { error: updateError } = await supabase
        .from("products")
        .update({ current_stock: newStock })
        .eq("id", line.product_id);

      if (updateError) {
        toast({
          title: "Error updating stock",
          description: updateError.message,
          variant: "destructive",
        });
        continue;
      }

      // Create inventory transaction record
      await supabase
        .from("inventory_transactions")
        .insert([{
          product_id: line.product_id,
          change_quantity: -line.quantity,
          reason: "order",
          related_order_id: selectedOrderForCompletion.id,
          comment: "Stock deducted for completed order",
        }]);
    }

    // Update order with payment information
    const { error: orderError } = await supabase
      .from("orders")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        payment_status: paymentReceived ? "paid" : "unpaid",
        payment_received_amount: paymentAmountValue,
        debt_flag: !paymentReceived,
      })
      .eq("id", selectedOrderForCompletion.id);

    if (orderError) {
      toast({
        title: "Error completing order",
        description: orderError.message,
        variant: "destructive",
      });
      return;
    }

    // Create finance entry based on payment status
    if (paymentReceived && paymentAmountValue > 0) {
      // Record income when payment is received
      const { error: financeError } = await supabase
        .from("finance_entries")
        .insert({
          type: "income",
          amount: paymentAmountValue,
          company_id: selectedOrderForCompletion.companyId,
          related_order_id: selectedOrderForCompletion.id,
          comment: `Payment received via ${paymentMethod} for completed order`,
        });

      if (financeError) {
        toast({
          title: "Order completed but finance entry failed",
          description: financeError.message,
          variant: "destructive",
        });
      }
    } else {
      // Record debt as expense when payment is not received
      const { error: financeError } = await supabase
        .from("finance_entries")
        .insert({
          type: "expense",
          amount: selectedOrderForCompletion.totalAmount,
          company_id: selectedOrderForCompletion.companyId,
          related_order_id: selectedOrderForCompletion.id,
          comment: `Unpaid order - pending debt`,
        });

      if (financeError) {
        toast({
          title: "Order completed but finance entry failed",
          description: financeError.message,
          variant: "destructive",
        });
      }
    }

    toast({ 
      title: "Order completed successfully",
      description: paymentReceived 
        ? `Payment of $${paymentAmountValue} recorded. Stock updated.`
        : `Debt of $${selectedOrderForCompletion.totalAmount} recorded. Stock updated.`
    });

    setShowPaymentDialog(false);
    setSelectedOrderForCompletion(null);
    setPaymentReceived(null);
    setPaymentAmount("");
    setPaymentMethod("");
    fetchOrders();
  };

  const filteredOrders = orders.filter((order) =>
    order.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.items.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
              ← უკან მთავარზე
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />
              შეკვეთების მართვა
            </h1>
            <p className="text-muted-foreground">Company ID: {companyId}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleClearAllOrders}
              disabled={clearing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clearing ? "იშლება..." : "ყველა შეკვეთის გასუფთავება"}
            </Button>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="h-4 w-4" />
              ახალი შეკვეთა
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processing Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {orders.filter(o => o.status === "open").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                ${orders.reduce((acc, o) => acc + o.total, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Order</CardTitle>
              <CardDescription>Create a new order for inventory management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company Selection</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={!useCustomCompany ? "default" : "outline"}
                    onClick={() => setUseCustomCompany(false)}
                    className="flex-1"
                  >
                    Registered Company
                  </Button>
                  <Button
                    type="button"
                    variant={useCustomCompany ? "default" : "outline"}
                    onClick={() => setUseCustomCompany(true)}
                    className="flex-1"
                  >
                    Custom Company
                  </Button>
                </div>
              </div>

              {!useCustomCompany ? (
                <div className="space-y-2">
                  <Label htmlFor="company">Select Company</Label>
                  <Select value={newOrder.company} onValueChange={(value) => setNewOrder({ ...newOrder, company: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.name}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="customCompany">Company Name</Label>
                  <Input
                    id="customCompany"
                    placeholder="Enter company name"
                    value={newOrder.customCompany}
                    onChange={(e) => setNewOrder({ ...newOrder, customCompany: e.target.value })}
                  />
                </div>
              )}


              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select Products</Label>
                  <Button 
                    type="button"
                    onClick={handleAddSelectedProducts}
                    disabled={selectedProducts.size === 0}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Selected ({selectedProducts.size})
                  </Button>
                </div>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {products.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No products available
                    </div>
                  ) : (
                    <div className="divide-y">
                      {products.map((product) => {
                        const isAlreadyAdded = orderLines.some(line => line.product_id === product.id);
                        return (
                          <div
                            key={product.id}
                            className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
                              isAlreadyAdded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                            onClick={() => !isAlreadyAdded && handleToggleProduct(product.id)}
                          >
                            <Checkbox
                              checked={selectedProducts.has(product.id)}
                              onCheckedChange={() => !isAlreadyAdded && handleToggleProduct(product.id)}
                              disabled={isAlreadyAdded}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{product.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {product.sku && `SKU: ${product.sku} • `}
                                Stock: {product.current_stock} • ${product.unit_price.toFixed(2)}
                              </div>
                            </div>
                            {isAlreadyAdded && (
                              <span className="text-xs text-muted-foreground">Already added</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {orderLines.length > 0 && (
                <div className="space-y-3 border rounded-lg p-4">
                  <h4 className="font-medium">Order Items</h4>
                  {orderLines.map((line) => (
                    <div key={line.product_id} className="grid gap-3 p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{line.product_name}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveProductLine(line.product_id)}
                          className="h-6 w-6 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor={`quantity-${line.product_id}`} className="text-xs">Quantity</Label>
                          <Input
                            id={`quantity-${line.product_id}`}
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleUpdateQuantity(line.product_id, parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`price-${line.product_id}`} className="text-xs">Unit Price ($)</Label>
                          <Input
                            id={`price-${line.product_id}`}
                            type="number"
                            step="0.01"
                            value={line.unit_price === 0 ? '' : line.unit_price}
                            onChange={(e) => handleUpdatePrice(line.product_id, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Total</Label>
                          <div className="h-10 flex items-center font-bold text-primary">
                            ${line.line_total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">Order Total:</span>
                      <span className="text-2xl font-bold text-primary">${calculateOrderTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount (Optional)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={newOrder.paymentAmount}
                  onChange={(e) => setNewOrder({ ...newOrder, paymentAmount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Enter payment amount received at order creation. Leave empty if no payment received yet.
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddOrder} className="flex-1">Create Order</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Processing Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-warning" />
              Processing Orders
            </CardTitle>
            <CardDescription>Orders awaiting completion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredOrders.filter(order => order.status === "open").length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No processing orders</p>
              ) : (
                filteredOrders.filter(order => order.status === "open").map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-primary">{order.id}</span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                          Processing
                        </span>
                      </div>
                      <div className="text-sm">
                        <Building2 className="inline h-3 w-3 mr-1" />
                        <span className="font-medium">{order.company}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.items}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {order.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold">${order.total.toLocaleString()}</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleInitiateOrderCompletion(order.id)}
                          className="gap-2"
                        >
                          <Check className="h-4 w-4" />
                          Mark Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateOrderStatus(order.id, "canceled")}
                          className="gap-2"
                        >
                          Cancel Order
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Canceled Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Canceled Orders
            </CardTitle>
            <CardDescription>Orders that have been canceled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredOrders.filter(order => order.status === "canceled").length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No canceled orders</p>
              ) : (
                filteredOrders.filter(order => order.status === "canceled").map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors opacity-60"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-primary">{order.id}</span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                          Canceled
                        </span>
                      </div>
                      <div className="text-sm">
                        <Building2 className="inline h-3 w-3 mr-1" />
                        <span className="font-medium">{order.company}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.items}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {order.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold">${order.total.toLocaleString()}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteOrder(order.id)}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Complete Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" />
              Complete Orders
            </CardTitle>
            <CardDescription>Completed orders with payment status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredOrders.filter(order => order.status === "completed").length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No completed orders</p>
              ) : (
                filteredOrders.filter(order => order.status === "completed").map((order) => {
                  const isUnpaid = order.paymentStatus === "unpaid" || order.debtFlag;
                  const remainingDebt = order.total - (order.paymentReceived || 0);
                  
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-primary">{order.id}</span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                            დასრულებული
                          </span>
                          {isUnpaid && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                              ვალი: ${remainingDebt.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="text-sm">
                          <Building2 className="inline h-3 w-3 mr-1" />
                          <span className="font-medium">{order.company}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.items}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {order.date}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold">${order.total.toLocaleString()}</div>
                          {isUnpaid && (
                            <div className="text-sm text-muted-foreground">
                              გადახდილი: ${(order.paymentReceived || 0).toFixed(2)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {isUnpaid && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleInitiateLaterPayment(order.id)}
                              className="gap-2"
                            >
                              <DollarSign className="h-4 w-4" />
                              გადახდის რეგისტრაცია
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInitiateReturn(order.id)}
                            className="gap-2"
                          >
                            პროდუქტის დაბრუნება
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteOrder(order.id)}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            წაშლა
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Order - Payment Confirmation</DialogTitle>
            <DialogDescription>
              Was payment received for this order?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={paymentReceived === true ? "default" : "outline"}
                  onClick={() => setPaymentReceived(true)}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Payment Received
                </Button>
                <Button
                  type="button"
                  variant={paymentReceived === false ? "default" : "outline"}
                  onClick={() => setPaymentReceived(false)}
                  className="flex-1"
                >
                  Unpaid
                </Button>
              </div>
            </div>

            {paymentReceived === true && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount ($)</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Enter payment amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {paymentReceived === false && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  This order will be marked as debt in both the company finances and overall Financial records.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmOrderCompletion}>
              <DollarSign className="h-4 w-4 mr-2" />
              Complete Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLaterPaymentDialog} onOpenChange={setShowLaterPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>გადახდის რეგისტრაცია</DialogTitle>
            <DialogDescription>
              დაარეგისტრირეთ გადახდა დავალიანებული შეკვეთისთვის
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedOrderForLaterPayment && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">შეკვეთის თანხა:</span>
                  <span className="font-medium">${selectedOrderForLaterPayment.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">უკვე გადახდილი:</span>
                  <span className="font-medium">${selectedOrderForLaterPayment.paymentReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground font-bold">დარჩენილი ვალი:</span>
                  <span className="font-bold text-warning">
                    ${(selectedOrderForLaterPayment.totalAmount - selectedOrderForLaterPayment.paymentReceived).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="laterPaymentAmount">გადახდის თანხა ($)</Label>
              <Input
                id="laterPaymentAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="შეიყვანეთ გადახდის თანხა"
                value={laterPaymentAmount}
                onChange={(e) => setLaterPaymentAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="laterPaymentMethod">გადახდის მეთოდი</Label>
              <Select value={laterPaymentMethod} onValueChange={setLaterPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="აირჩიეთ გადახდის მეთოდი" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ნაღდი">ნაღდი</SelectItem>
                  <SelectItem value="საკრედიტო ბარათი">საკრედიტო ბარათი</SelectItem>
                  <SelectItem value="სადებეტო ბარათი">სადებეტო ბარათი</SelectItem>
                  <SelectItem value="საბანკო გადარიცხვა">საბანკო გადარიცხვა</SelectItem>
                  <SelectItem value="ჩეკი">ჩეკი</SelectItem>
                  <SelectItem value="სხვა">სხვა</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLaterPaymentDialog(false)}>
              გაუქმება
            </Button>
            <Button onClick={handleConfirmLaterPayment}>
              <DollarSign className="h-4 w-4 mr-2" />
              გადახდის დადასტურება
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Return Items from Order</DialogTitle>
            <DialogDescription>
              Select products and quantities to return. Stock will be added back to inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedOrderForReturn && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Items Sold</div>
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(selectedOrderForReturn.totalAmount / (returnLines[0]?.unit_price || 1))}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Items Returned</div>
                  <div className="text-2xl font-bold text-warning">
                    {returnLines.reduce((sum, line) => sum + line.quantity, 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Remaining Debt</div>
                  <div className="text-2xl font-bold text-destructive">
                    ${Math.max(0, selectedOrderForReturn.totalAmount - calculateReturnTotal() - selectedOrderForReturn.paymentReceived).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {returnLines.map((line) => (
              <div key={line.product_id} className="grid gap-3 p-3 border rounded-lg">
                <div className="font-medium">{line.product_name}</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`return-quantity-${line.product_id}`} className="text-xs">Return Quantity</Label>
                    <Input
                      id={`return-quantity-${line.product_id}`}
                      type="number"
                      min="0"
                      value={line.quantity}
                      onChange={(e) => handleUpdateReturnQuantity(line.product_id, parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit Price</Label>
                    <div className="h-10 flex items-center font-medium">
                      ${line.unit_price.toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Return Total</Label>
                    <div className="h-10 flex items-center font-bold text-primary">
                      ${line.line_total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {returnLines.length > 0 && (
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total Return Amount:</span>
                  <span className="text-2xl font-bold text-primary">${calculateReturnTotal().toFixed(2)}</span>
                </div>
                {selectedOrderForReturn && (
                  <div className="mt-2 text-sm text-muted-foreground space-y-1">
                    <p>Original Order Total: ${selectedOrderForReturn.totalAmount.toFixed(2)}</p>
                    <p>Payment Received: ${selectedOrderForReturn.paymentReceived.toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReturn}>
              Process Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
