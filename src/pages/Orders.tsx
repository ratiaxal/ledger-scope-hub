import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, Package, Calendar, Trash2 } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  status: "pending" | "completed" | "cancelled";
}

const Orders = () => {
  const { companyId } = useParams();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([
    { id: "ORD-001", date: "2025-10-05", company: "ABC Corp", items: "Office Chairs", quantity: 10, total: 2500, status: "completed" },
    { id: "ORD-002", date: "2025-10-04", company: "XYZ LLC", items: "Laptops", quantity: 5, total: 7500, status: "pending" },
    { id: "ORD-003", date: "2025-10-03", company: "Tech Solutions Inc", items: "Monitors", quantity: 15, total: 4500, status: "completed" },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [newOrder, setNewOrder] = useState({
    company: "",
    customCompany: "",
    items: "",
    quantity: "",
    total: "",
  });

  const [useCustomCompany, setUseCustomCompany] = useState(false);

  const registeredCompanies = ["ABC Corp", "XYZ LLC", "Tech Solutions Inc"];

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const handleAddProductLine = (productId: string) => {
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

  const handleAddOrder = () => {
    if ((!newOrder.company && !newOrder.customCompany) || orderLines.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select a company and add at least one product",
        variant: "destructive",
      });
      return;
    }

    const order: Order = {
      id: `ORD-${String(orders.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString().split("T")[0],
      company: useCustomCompany ? newOrder.customCompany : newOrder.company,
      items: orderLines.map(line => `${line.product_name} (${line.quantity})`).join(", "),
      quantity: orderLines.reduce((sum, line) => sum + line.quantity, 0),
      total: calculateOrderTotal(),
      status: "pending",
    };

    setOrders([order, ...orders]);
    setNewOrder({ company: "", customCompany: "", items: "", quantity: "", total: "" });
    setOrderLines([]);
    setShowForm(false);
    setUseCustomCompany(false);
    toast({ title: "Order created successfully" });
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
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />
              Orders Management
            </h1>
            <p className="text-muted-foreground">Company ID: {companyId}</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Button>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {orders.filter(o => o.status === "pending").length}
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
                      {registeredCompanies.map((company) => (
                        <SelectItem key={company} value={company}>
                          {company}
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


              <div className="space-y-2">
                <Label htmlFor="product">Add Product</Label>
                <Select onValueChange={handleAddProductLine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} {product.sku ? `(${product.sku})` : ""} - Stock: {product.current_stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                            min="0"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => handleUpdatePrice(line.product_id, parseFloat(e.target.value) || 0)}
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

              <div className="flex gap-2">
                <Button onClick={handleAddOrder} className="flex-1">Create Order</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order History</CardTitle>
                <CardDescription>Search and view all orders</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-primary">{order.id}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === "completed" ? "bg-success/10 text-success" :
                        order.status === "pending" ? "bg-warning/10 text-warning" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-sm">
                      <Building2 className="inline h-3 w-3 mr-1" />
                      <span className="font-medium">{order.company}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.items} × {order.quantity}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {order.date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">${order.total.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Orders;
