import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, Package, Calendar } from "lucide-react";
import { useParams, Link } from "react-router-dom";

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
  const [orders, setOrders] = useState<Order[]>([
    { id: "ORD-001", date: "2025-10-05", company: "ABC Corp", items: "Office Chairs", quantity: 10, total: 2500, status: "completed" },
    { id: "ORD-002", date: "2025-10-04", company: "XYZ LLC", items: "Laptops", quantity: 5, total: 7500, status: "pending" },
    { id: "ORD-003", date: "2025-10-03", company: "Tech Solutions Inc", items: "Monitors", quantity: 15, total: 4500, status: "completed" },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newOrder, setNewOrder] = useState({
    company: "",
    customCompany: "",
    items: "",
    quantity: "",
    total: "",
  });

  const [useCustomCompany, setUseCustomCompany] = useState(false);

  const registeredCompanies = ["ABC Corp", "XYZ LLC", "Tech Solutions Inc"];

  const handleAddOrder = () => {
    if ((!newOrder.company && !newOrder.customCompany) || !newOrder.items || !newOrder.quantity || !newOrder.total) return;

    const order: Order = {
      id: `ORD-${String(orders.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString().split("T")[0],
      company: useCustomCompany ? newOrder.customCompany : newOrder.company,
      items: newOrder.items,
      quantity: parseInt(newOrder.quantity),
      total: parseFloat(newOrder.total),
      status: "pending",
    };

    setOrders([order, ...orders]);
    setNewOrder({ company: "", customCompany: "", items: "", quantity: "", total: "" });
    setShowForm(false);
    setUseCustomCompany(false);
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

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="items">Items</Label>
                  <Input
                    id="items"
                    placeholder="e.g., Office Chairs"
                    value={newOrder.items}
                    onChange={(e) => setNewOrder({ ...newOrder, items: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="0"
                    value={newOrder.quantity}
                    onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total">Total ($)</Label>
                  <Input
                    id="total"
                    type="number"
                    placeholder="0.00"
                    value={newOrder.total}
                    onChange={(e) => setNewOrder({ ...newOrder, total: e.target.value })}
                  />
                </div>
              </div>

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
