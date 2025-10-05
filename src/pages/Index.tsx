import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, Package, Warehouse } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Company {
  id: string;
  name: string;
  type: string;
  registeredDate: string;
  balance: number;
  activeOrders: number;
}

const Index = () => {
  const navigate = useNavigate();

  const companies: Company[] = [
    { id: "LLC-001", name: "TechVentures LLC", type: "Technology", registeredDate: "2024-01-15", balance: 125000, activeOrders: 12 },
    { id: "LLC-002", name: "Green Solutions LLC", type: "Environmental", registeredDate: "2024-03-22", balance: 89500, activeOrders: 8 },
    { id: "LLC-003", name: "Prime Logistics LLC", type: "Logistics", registeredDate: "2024-05-10", balance: 256000, activeOrders: 24 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Business Manager</h1>
              <p className="text-sm text-muted-foreground">Multi-Company Management Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">Registered Companies</h2>
          <p className="text-muted-foreground">Manage finance, orders, and inventory for your LLCs</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {company.name}
                    </CardTitle>
                    <CardDescription className="mt-1">{company.type} • {company.id}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance</span>
                    <span className="font-bold text-success">${company.balance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Active Orders</span>
                    <span className="font-medium">{company.activeOrders}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Registered</span>
                    <span className="font-medium">{company.registeredDate}</span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => navigate(`/finance/${company.id}`)}
                  >
                    <TrendingUp className="h-4 w-4" />
                    Finance
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => navigate(`/orders/${company.id}`)}
                  >
                    <Package className="h-4 w-4" />
                    Orders
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => navigate(`/warehouse/${company.id}`)}
                  >
                    <Warehouse className="h-4 w-4" />
                    Warehouse
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
