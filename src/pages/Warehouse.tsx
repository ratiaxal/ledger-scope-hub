import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, TrendingDown, ShoppingCart, Trash2, DollarSign } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit_price: number;
  current_stock: number;
  created_at: string;
  updated_at: string;
  warehouse_id: string | null;
}

interface Warehouse {
  id: string;
  name: string;
}

interface OrderLine {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

const Warehouse = () => {
  const { toast } = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    sku: "",
    stock: "",
  });
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [customCompanyName, setCustomCompanyName] = useState("");
  const [useCustomCompany, setUseCustomCompany] = useState(false);
  const [manualProductEntry, setManualProductEntry] = useState(false);
  const [manualProduct, setManualProduct] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  const [showReduceDialog, setShowReduceDialog] = useState(false);
  const [reduceProduct, setReduceProduct] = useState<Product | null>(null);
  const [reduceQuantity, setReduceQuantity] = useState("");
  const holdIntervalRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    fetchWarehouses();
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedWarehouse) {
      fetchProducts();
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    };
  }, []);

  const handleStopHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const handleStartHold = (productId: string, delta: number) => {
    // First click
    handleUpdateStock(productId, delta);
    
    // Start continuous increment after delay
    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        handleUpdateStock(productId, delta);
      }, 100);
    }, 500);
  };

  const fetchWarehouses = async () => {
    const { data, error } = await supabase
      .from("warehouses")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Error loading warehouses",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setWarehouses(data || []);
      // Auto-select first warehouse if none selected
      if (data && data.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(data[0].id);
      }
    }
  };

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

  const fetchProducts = async () => {
    if (!selectedWarehouse) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("warehouse_id", selectedWarehouse)
      .order("created_at", { ascending: false });

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

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.stock) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(newItem.stock);
    const unitPrice = 0; // Price disabled
    const totalCost = 0;

    // Insert or update product in current warehouse
    const { data: existingProducts, error: checkError } = await supabase
      .from("products")
      .select("*")
      .eq("warehouse_id", selectedWarehouse)
      .eq("name", newItem.name);

    if (checkError) {
      toast({
        title: "Error checking existing products",
        description: checkError.message,
        variant: "destructive",
      });
      return;
    }

    if (existingProducts && existingProducts.length > 0) {
      // Product exists, update stock
      const existingProduct = existingProducts[0];
      const newStock = existingProduct.current_stock + quantity;
      
      const { error: updateError } = await supabase
        .from("products")
        .update({ current_stock: newStock })
        .eq("id", existingProduct.id);

      if (updateError) {
        toast({
          title: "Error updating product",
          description: updateError.message,
          variant: "destructive",
        });
        return;
      }

      // Record inventory transaction
      await supabase
        .from("inventory_transactions")
        .insert([{
          product_id: existingProduct.id,
          change_quantity: quantity,
          reason: "restock",
          comment: `საწყობის მარაგის დამატება`,
          warehouse_id: selectedWarehouse,
        }]);

      toast({ 
        title: "პროდუქტი განახლდა",
        description: `${quantity} ერთეული დაემატა მარაგს`
      });
    } else {
      // Insert new product
      const { data: productData, error: productError } = await supabase
        .from("products")
        .insert([{
          name: newItem.name,
          sku: newItem.sku || null,
          unit_price: unitPrice,
          current_stock: quantity,
          warehouse_id: selectedWarehouse,
        }])
        .select()
        .single();

      if (productError) {
        toast({
          title: "Error adding product",
          description: productError.message,
          variant: "destructive",
        });
        return;
      }

      // Record initial stock purchase as expense
      const { error: financeError } = await supabase
        .from("finance_entries")
        .insert([{
          type: "expense",
          amount: totalCost,
          comment: `საწყობის საწყისი მარაგი - ${newItem.name} (${quantity} ცალი × $${unitPrice})`,
          company_id: null,
          related_order_id: null,
          warehouse_id: selectedWarehouse,
        }]);

      if (financeError) {
        toast({
          title: "Warning",
          description: "Product added but finance entry failed: " + financeError.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Product added and expense recorded" });
      }
    }

    setNewItem({ name: "", sku: "", stock: "" });
    setShowForm(false);
    fetchProducts();
  };

  const handleUpdateStock = async (id: string, change: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const newStock = Math.max(0, product.current_stock + change);
    const actualChange = newStock - product.current_stock;

    // Update product stock
    const { error: stockError } = await supabase
      .from("products")
      .update({ current_stock: newStock })
      .eq("id", id);

    if (stockError) {
      toast({
        title: "Error updating stock",
        description: stockError.message,
        variant: "destructive",
      });
      return;
    }

    const amount = Math.abs(actualChange) * product.unit_price;

    if (actualChange > 0) {
      // Stock increase - record as expense
      const { error: financeError } = await supabase
        .from("finance_entries")
        .insert([{
          type: "expense",
          amount: amount,
          comment: `საწყობის მარაგის დამატება - ${product.name} (+${actualChange} ცალი × $${product.unit_price})`,
          company_id: null,
          related_order_id: null,
          warehouse_id: selectedWarehouse,
        }]);

      if (financeError) {
        toast({
          title: "Warning",
          description: "Stock updated but finance entry failed: " + financeError.message,
          variant: "destructive",
        });
      }
    } else if (actualChange < 0) {
      // Stock decrease - deduct from finances (income to offset previous expense)
      const { error: financeError } = await supabase
        .from("finance_entries")
        .insert([{
          type: "income",
          amount: amount,
          comment: `საწყობის მარაგის შემცირება - ${product.name} (${actualChange} ცალი × $${product.unit_price})`,
          company_id: null,
          related_order_id: null,
          warehouse_id: selectedWarehouse,
        }]);

      if (financeError) {
        toast({
          title: "Warning",
          description: "Stock updated but finance entry failed: " + financeError.message,
          variant: "destructive",
        });
      }
    }

    fetchProducts();
  };

  const handleManualReduce = async () => {
    if (!reduceProduct || !reduceQuantity) {
      toast({
        title: "არასრული ინფორმაცია",
        description: "გთხოვთ შეიყვანოთ რაოდენობა",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(reduceQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "არასწორი რაოდენობა",
        description: "გთხოვთ შეიყვანოთ დადებითი რიცხვი",
        variant: "destructive",
      });
      return;
    }

    if (quantity > reduceProduct.current_stock) {
      toast({
        title: "არასაკმარისი მარაგი",
        description: `მარაგში მხოლოდ ${reduceProduct.current_stock} ერთეულია`,
        variant: "destructive",
      });
      return;
    }

    const newStock = reduceProduct.current_stock - quantity;
    const deductedValue = quantity * reduceProduct.unit_price;

    // Update product stock
    const { error: stockError } = await supabase
      .from("products")
      .update({ current_stock: newStock })
      .eq("id", reduceProduct.id);

    if (stockError) {
      toast({
        title: "შეცდომა",
        description: stockError.message,
        variant: "destructive",
      });
      return;
    }

    // Record inventory transaction
    await supabase
      .from("inventory_transactions")
      .insert([{
        product_id: reduceProduct.id,
        change_quantity: -quantity,
        reason: "correction",
        comment: `ხელით შემცირება - დაბრუნება/გაფუჭება`,
        warehouse_id: selectedWarehouse,
      }]);

    // Deduct value from finances (record as income to offset the original expense)
    const { error: financeError } = await supabase
      .from("finance_entries")
      .insert([{
        type: "income",
        amount: deductedValue,
        comment: `პროდუქტის შემცირება - ${reduceProduct.name} (-${quantity} ცალი × $${reduceProduct.unit_price}) - დაბრუნება/გაფუჭება`,
        company_id: null,
        related_order_id: null,
        warehouse_id: selectedWarehouse,
      }]);

    if (financeError) {
      toast({
        title: "გაფრთხილება",
        description: "მარაგი განახლდა, მაგრამ ფინანსური ჩანაწერი ვერ შეიქმნა: " + financeError.message,
        variant: "destructive",
      });
    }

    toast({
      title: "მარაგი შემცირდა",
      description: `${quantity} ერთეული ამოღებულია და $${deductedValue.toFixed(2)} გამოიქვითა ფინანსებიდან`,
    });

    setShowReduceDialog(false);
    setReduceProduct(null);
    setReduceQuantity("");
    fetchProducts();
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      toast({
        title: "Error deleting product",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ 
        title: "Product deleted", 
        description: `${productName} has been permanently removed from the system` 
      });
      fetchProducts();
    }
  };

  const handleAddProductToOrder = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingLine = orderLines.find(line => line.product_id === productId);
    if (existingLine) {
      toast({
        title: "Product already added",
        description: "This product is already in the order",
        variant: "destructive",
      });
      return;
    }

    const newLine: OrderLine = {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: product.unit_price,
      line_total: product.unit_price,
    };

    setOrderLines([...orderLines, newLine]);
  };

  const handleAddManualProduct = () => {
    if (!manualProduct.name.trim()) {
      toast({
        title: "Product name required",
        description: "Please enter a product name",
        variant: "destructive",
      });
      return;
    }

    if (!manualProduct.price || parseFloat(manualProduct.price) <= 0) {
      toast({
        title: "Valid price required",
        description: "Please enter a valid purchase price",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(manualProduct.quantity) || 1;
    const unitPrice = parseFloat(manualProduct.price);

    const newLine: OrderLine = {
      product_id: `manual-${Date.now()}`, // Temporary ID for manual entries
      product_name: manualProduct.name,
      quantity: quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice,
    };

    setOrderLines([...orderLines, newLine]);
    setManualProduct({ name: "", price: "", quantity: "1" });
    toast({
      title: "Product added to order",
      description: `${manualProduct.name} added successfully`,
    });
  };

  const handleUpdateOrderLine = (productId: string, field: 'quantity' | 'unit_price', value: number) => {
    setOrderLines(orderLines.map(line => {
      if (line.product_id === productId) {
        const updatedLine = { ...line, [field]: value };
        updatedLine.line_total = updatedLine.quantity * updatedLine.unit_price;
        return updatedLine;
      }
      return line;
    }));
  };

  const handleRemoveOrderLine = (productId: string) => {
    setOrderLines(orderLines.filter(line => line.product_id !== productId));
  };

  const handleCreateOrder = async () => {
    if (orderLines.length === 0) {
      toast({
        title: "No products selected",
        description: "Please add at least one product to the order",
        variant: "destructive",
      });
      return;
    }

    if (!useCustomCompany && !selectedCompany) {
      toast({
        title: "No company selected",
        description: "Please select a company or enter a custom name",
        variant: "destructive",
      });
      return;
    }

    if (useCustomCompany && !customCompanyName.trim()) {
      toast({
        title: "No company name",
        description: "Please enter a company name",
        variant: "destructive",
      });
      return;
    }

    const totalQuantity = orderLines.reduce((sum, line) => sum + line.quantity, 0);
    const totalAmount = orderLines.reduce((sum, line) => sum + line.line_total, 0);

    // Create order
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([{
        company_id: useCustomCompany ? null : selectedCompany,
        manual_company_name: useCustomCompany ? customCompanyName : null,
        total_quantity: totalQuantity,
        total_amount: totalAmount,
        status: "open",
        payment_status: "unpaid",
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

    // For manual product entries, we need to create products first or handle them differently
    const orderLinesData = [];
    
    for (const line of orderLines) {
      let productId = line.product_id;
      
      // If it's a manual entry (temporary ID), create the product first
      if (line.product_id.startsWith('manual-')) {
        const { data: newProduct, error: productError } = await supabase
          .from("products")
          .insert([{
            name: line.product_name,
            unit_price: line.unit_price,
            current_stock: 0, // Manual order entries don't add to stock
            warehouse_id: selectedWarehouse,
          }])
          .select()
          .single();

        if (productError) {
          toast({
            title: "Error creating product",
            description: productError.message,
            variant: "destructive",
          });
          continue;
        }

        productId = newProduct.id;
      }

      orderLinesData.push({
        order_id: orderData.id,
        product_id: productId,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_total: line.line_total,
      });
    }

    const { error: linesError } = await supabase
      .from("order_lines")
      .insert(orderLinesData);

    if (linesError) {
      toast({
        title: "Error creating order lines",
        description: linesError.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Order created successfully",
      description: `Order with ${orderLines.length} products created`,
    });

    // Reset form
    setOrderLines([]);
    setSelectedCompany("");
    setCustomCompanyName("");
    setUseCustomCompany(false);
    setManualProductEntry(false);
    setManualProduct({ name: "", price: "", quantity: "1" });
    setShowOrderDialog(false);
    fetchProducts(); // Refresh products list if new ones were added
  };

  const totalItems = products.reduce((acc, item) => acc + item.current_stock, 0);
  const totalWarehouseValue = products.reduce((acc, item) => acc + (item.current_stock * item.unit_price), 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
              ← უკან მთავარზე
            </Link>
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Package className="h-8 w-8 text-primary" />
                  საწყობი და ინვენტარი
                </h1>
                <p className="text-muted-foreground">მართეთ პროდუქტები და საწყობი</p>
              </div>
              <div className="ml-8">
                <Label className="text-sm text-muted-foreground mb-2">Select Warehouse</Label>
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Choose warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                if (selectedWarehouse) {
                  window.location.href = `/warehouse-finance/${selectedWarehouse}`;
                }
              }} 
              variant="secondary" 
              className="gap-2"
              disabled={!selectedWarehouse}
            >
              <DollarSign className="h-4 w-4" />
              ფინანსები
            </Button>
            <Button onClick={() => setShowOrderDialog(true)} variant="default" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              შეკვეთის შექმნა
            </Button>
            <Button onClick={() => setShowForm(!showForm)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              ნივთის დამატება
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">სულ ერთეული</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">{products.length} product types</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">სულ პროდუქტი</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{products.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique products</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                საწყობის სრული ღირებულება
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">${totalWarehouseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">მიმდინარე მარაგის ხარჯი</p>
            </CardContent>
          </Card>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add Inventory Item</CardTitle>
              <CardDescription>Register a new product in the warehouse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Office Chairs"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU (Optional)</Label>
                  <Input
                    id="sku"
                    placeholder="e.g., CH-001"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock *</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newItem.stock}
                    onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddItem} className="flex-1">Add Item</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Current Inventory</CardTitle>
            <CardDescription>Manage stock levels and track inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No products yet</h3>
                <p className="text-muted-foreground mb-4">Get started by adding your first product</p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{product.name}</span>
                        {product.sku && (
                          <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                            {product.sku}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Unit Price: ${product.unit_price.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Last updated: {new Date(product.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {product.current_stock}
                        </div>
                        <div className="text-xs text-muted-foreground">units</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onMouseDown={() => handleStartHold(product.id, -1)}
                          onMouseUp={handleStopHold}
                          onMouseLeave={handleStopHold}
                          onTouchStart={() => handleStartHold(product.id, -1)}
                          onTouchEnd={handleStopHold}
                          disabled={product.current_stock === 0}
                        >
                          <TrendingDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onMouseDown={() => handleStartHold(product.id, 1)}
                          onMouseUp={handleStopHold}
                          onMouseLeave={handleStopHold}
                          onTouchStart={() => handleStartHold(product.id, 1)}
                          onTouchEnd={handleStopHold}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReduceProduct(product);
                            setShowReduceDialog(true);
                          }}
                          className="gap-1"
                        >
                          <TrendingDown className="h-4 w-4" />
                          შემცირება
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>პროდუქტის წაშლა</AlertDialogTitle>
                              <AlertDialogDescription>
                                დარწმუნებული ხართ, რომ გსურთ "{product.name}"-ის სრულად წაშლა სისტემიდან? ეს მოქმედება შეუქცევადია და წაშლის ყველა დაკავშირებულ მონაცემს.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>გაუქმება</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteProduct(product.id, product.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                წაშლა
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
              <DialogDescription>
                Select products and specify quantities to create an order
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant={!useCustomCompany ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseCustomCompany(false)}
                  >
                    Select Company
                  </Button>
                  <Button
                    variant={useCustomCompany ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseCustomCompany(true)}
                  >
                    Custom Name
                  </Button>
                </div>
                {!useCustomCompany ? (
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Enter company name"
                    value={customCompanyName}
                    onChange={(e) => setCustomCompanyName(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant={!manualProductEntry ? "default" : "outline"}
                    size="sm"
                    onClick={() => setManualProductEntry(false)}
                  >
                    Select Existing
                  </Button>
                  <Button
                    variant={manualProductEntry ? "default" : "outline"}
                    size="sm"
                    onClick={() => setManualProductEntry(true)}
                  >
                    Enter Manually
                  </Button>
                </div>

                {!manualProductEntry ? (
                  <>
                    <Label>Select Product</Label>
                    <Select onValueChange={handleAddProductToOrder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - ${product.unit_price.toFixed(2)} (Stock: {product.current_stock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <div className="space-y-3 border rounded-lg p-4">
                    <Label>Enter Product Details</Label>
                    <div className="grid gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="manual-product-name" className="text-xs">
                          Product Name *
                        </Label>
                        <Input
                          id="manual-product-name"
                          placeholder="Enter product name"
                          value={manualProduct.name}
                          onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="manual-product-price" className="text-xs">
                            Purchase Price ($) *
                          </Label>
                          <Input
                            id="manual-product-price"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={manualProduct.price}
                            onChange={(e) => setManualProduct({ ...manualProduct, price: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="manual-product-quantity" className="text-xs">
                            Quantity *
                          </Label>
                          <Input
                            id="manual-product-quantity"
                            type="number"
                            min="1"
                            placeholder="1"
                            value={manualProduct.quantity}
                            onChange={(e) => setManualProduct({ ...manualProduct, quantity: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button onClick={handleAddManualProduct} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Order
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {orderLines.length > 0 && (
                <div className="space-y-3">
                  <Label>Order Items</Label>
                  <div className="border rounded-lg divide-y">
                    {orderLines.map((line) => (
                      <div key={line.product_id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{line.product_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOrderLine(line.product_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => handleUpdateOrderLine(line.product_id, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unit Price ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unit_price}
                              onChange={(e) => handleUpdateOrderLine(line.product_id, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Total</Label>
                            <Input
                              type="text"
                              value={`$${line.line_total.toFixed(2)}`}
                              disabled
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Order Total</span>
                    <span className="text-xl font-bold">
                      ${orderLines.reduce((sum, line) => sum + line.line_total, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateOrder}>
                Create Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showReduceDialog} onOpenChange={setShowReduceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>პროდუქტის ხელით შემცირება</DialogTitle>
              <DialogDescription>
                {reduceProduct && (
                  <>
                    <div className="mt-2">
                      <span className="font-semibold">{reduceProduct.name}</span>
                    </div>
                    <div className="mt-1 text-sm">
                      მიმდინარე მარაგი: <span className="font-bold">{reduceProduct.current_stock}</span> ერთეული
                    </div>
                    <div className="text-sm">
                      ერთეულის ფასი: <span className="font-bold">${reduceProduct.unit_price.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reduce-quantity">შესამცირებელი რაოდენობა</Label>
                <Input
                  id="reduce-quantity"
                  type="number"
                  min="1"
                  max={reduceProduct?.current_stock}
                  value={reduceQuantity}
                  onChange={(e) => setReduceQuantity(e.target.value)}
                  placeholder="შეიყვანეთ რაოდენობა"
                />
              </div>
              {reduceQuantity && reduceProduct && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">გამოქვითული ღირებულება</div>
                  <div className="text-2xl font-bold text-primary">
                    ${(parseInt(reduceQuantity) * reduceProduct.unit_price).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowReduceDialog(false);
                setReduceProduct(null);
                setReduceQuantity("");
              }}>
                გაუქმება
              </Button>
              <Button onClick={handleManualReduce} variant="destructive">
                შემცირება
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Warehouse;
