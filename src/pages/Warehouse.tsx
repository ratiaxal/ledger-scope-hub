import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { useParams, Link } from "react-router-dom";

interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  lastUpdated: string;
}

const Warehouse = () => {
  const { companyId } = useParams();
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { id: "1", name: "Office Chairs", stock: 45, minStock: 20, lastUpdated: "2025-10-05" },
    { id: "2", name: "Laptops", stock: 12, minStock: 10, lastUpdated: "2025-10-05" },
    { id: "3", name: "Monitors", stock: 8, minStock: 15, lastUpdated: "2025-10-04" },
    { id: "4", name: "Desks", stock: 30, minStock: 10, lastUpdated: "2025-10-03" },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    stock: "",
    minStock: "",
  });

  const handleAddItem = () => {
    if (!newItem.name || !newItem.stock || !newItem.minStock) return;

    const item: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name,
      stock: parseInt(newItem.stock),
      minStock: parseInt(newItem.minStock),
      lastUpdated: new Date().toISOString().split("T")[0],
    };

    setInventory([...inventory, item]);
    setNewItem({ name: "", stock: "", minStock: "" });
    setShowForm(false);
  };

  const handleUpdateStock = (id: string, change: number) => {
    setInventory(inventory.map(item => 
      item.id === id 
        ? { ...item, stock: Math.max(0, item.stock + change), lastUpdated: new Date().toISOString().split("T")[0] }
        : item
    ));
  };

  const lowStockItems = inventory.filter(item => item.stock < item.minStock);
  const totalItems = inventory.reduce((acc, item) => acc + item.stock, 0);

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
              Warehouse & Inventory
            </h1>
            <p className="text-muted-foreground">Company ID: {companyId}</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">{inventory.length} product types</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{lowStockItems.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Items below minimum</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Well Stocked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {inventory.length - lowStockItems.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Items at safe levels</p>
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
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Office Chairs"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    placeholder="0"
                    value={newItem.stock}
                    onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">Minimum Stock</Label>
                  <Input
                    id="minStock"
                    type="number"
                    placeholder="0"
                    value={newItem.minStock}
                    onChange={(e) => setNewItem({ ...newItem, minStock: e.target.value })}
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
            <div className="space-y-4">
              {inventory.map((item) => {
                const isLowStock = item.stock < item.minStock;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      isLowStock ? "border-warning bg-warning/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className={`h-4 w-4 ${isLowStock ? "text-warning" : "text-muted-foreground"}`} />
                        <span className="font-medium">{item.name}</span>
                        {isLowStock && (
                          <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs rounded-full font-medium">
                            Low Stock
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Minimum stock: {item.minStock} units
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Last updated: {item.lastUpdated}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${isLowStock ? "text-warning" : "text-foreground"}`}>
                          {item.stock}
                        </div>
                        <div className="text-xs text-muted-foreground">units</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStock(item.id, -1)}
                          disabled={item.stock === 0}
                        >
                          <TrendingDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStock(item.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Warehouse;
