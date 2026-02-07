import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, TrendingDown, Trash2, DollarSign } from "lucide-react";
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


const Warehouse = () => {
  const { toast } = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  
  const [showReduceDialog, setShowReduceDialog] = useState(false);
  const [reduceProduct, setReduceProduct] = useState<Product | null>(null);
  const [reduceQuantity, setReduceQuantity] = useState("");
  const [showSharedProductForm, setShowSharedProductForm] = useState(false);
  const [sharedProduct, setSharedProduct] = useState({
    name: "",
    color: "",
    quantity: "1",
  });
  const holdIntervalRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    fetchWarehouses();
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

  const handleAddSharedProduct = async () => {
    if (!sharedProduct.name.trim()) {
      toast({
        title: "შეცდომა",
        description: "გთხოვთ შეიყვანოთ პროდუქტის სახელი",
        variant: "destructive",
      });
      return;
    }

    if (!selectedWarehouse) {
      toast({
        title: "შეცდომა",
        description: "გთხოვთ აირჩიოთ საწყობი",
        variant: "destructive",
      });
      return;
    }

    // Create product name with color if provided
    const productName = sharedProduct.color.trim() 
      ? `${sharedProduct.name.trim()} (${sharedProduct.color.trim()})`
      : sharedProduct.name.trim();

    // Check if product exists
    const { data: existingProducts, error: checkError } = await supabase
      .from("products")
      .select("*")
      .eq("warehouse_id", selectedWarehouse)
      .eq("name", productName);

    if (checkError) {
      toast({
        title: "შეცდომა",
        description: checkError.message,
        variant: "destructive",
      });
      return;
    }

    if (existingProducts && existingProducts.length > 0) {
      toast({
        title: "პროდუქტი უკვე არსებობს",
        description: `"${productName}" უკვე დამატებულია საწყობში`,
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(sharedProduct.quantity) || 1;

    // Insert new product with specified quantity
    const { error: productError } = await supabase
      .from("products")
      .insert([{
        name: productName,
        sku: null,
        unit_price: 0,
        current_stock: quantity,
        warehouse_id: selectedWarehouse,
      }]);

    if (productError) {
      toast({
        title: "შეცდომა",
        description: productError.message,
        variant: "destructive",
      });
      return;
    }

    toast({ 
      title: "პროდუქტი დამატებულია",
      description: `"${productName}" (${quantity} ცალი) წარმატებით დაემატა საწყობში`
    });

    setSharedProduct({ name: "", color: "", quantity: "1" });
    setShowSharedProductForm(false);
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
            <Button onClick={() => setShowSharedProductForm(!showSharedProductForm)} variant="default" className="gap-2">
              <Plus className="h-4 w-4" />
              პროდუქტის დამატება
            </Button>
          </div>
        </div>

        {showSharedProductForm && (
          <Card>
            <CardHeader>
              <CardTitle>პროდუქტის დამატება</CardTitle>
              <CardDescription>დაამატეთ ახალი პროდუქტი საწყობში სახელით და ფერით</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="shared-name">პროდუქტის სახელი *</Label>
                  <Input
                    id="shared-name"
                    placeholder="მაგ: სკამი, მაგიდა"
                    value={sharedProduct.name}
                    onChange={(e) => setSharedProduct({ ...sharedProduct, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shared-color">ფერი (არასავალდებულო)</Label>
                  <Input
                    id="shared-color"
                    placeholder="მაგ: თეთრი, შავი, ლურჯი"
                    value={sharedProduct.color}
                    onChange={(e) => setSharedProduct({ ...sharedProduct, color: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shared-quantity">რაოდენობა *</Label>
                  <Input
                    id="shared-quantity"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={sharedProduct.quantity}
                    onChange={(e) => setSharedProduct({ ...sharedProduct, quantity: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddSharedProduct} className="flex-1">დამატება</Button>
                <Button variant="outline" onClick={() => setShowSharedProductForm(false)}>გაუქმება</Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                <Button onClick={() => setShowSharedProductForm(true)}>
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
