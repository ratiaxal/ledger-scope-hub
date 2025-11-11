import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Package, Search, Calendar, TrendingUp, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Order {
  id: string;
  created_at: string;
  completed_at: string | null;
  company_name: string;
  items: string;
  total_quantity: number;
  total_amount: number;
  status: "open" | "completed" | "canceled";
  payment_status: string;
  notes: string | null;
}

interface ProductStats {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

interface CompanyStats {
  company_name: string;
  total_orders: number;
  total_amount: number;
}

const AllOrders = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchProductStats();
      fetchCompanyStats();
    }
  }, [user]);

  const fetchOrders = async () => {
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        completed_at,
        total_quantity,
        total_amount,
        status,
        payment_status,
        notes,
        company_id,
        manual_company_name,
        companies (name)
      `)
      .order("created_at", { ascending: false });

    if (ordersError) {
      toast({
        title: "Error loading orders",
        description: ordersError.message,
        variant: "destructive",
      });
      return;
    }

    // Fetch order lines for each order to get product details
    const ordersWithDetails = await Promise.all(
      (ordersData || []).map(async (order) => {
        const { data: linesData } = await supabase
          .from("order_lines")
          .select(`
            quantity,
            products (name)
          `)
          .eq("order_id", order.id);

        const items = linesData
          ?.map((line: any) => `${line.products?.name} (${line.quantity})`)
          .join(", ") || "N/A";

        return {
          id: order.id,
          created_at: new Date(order.created_at).toLocaleDateString(),
          completed_at: order.completed_at ? new Date(order.completed_at).toLocaleDateString() : null,
          company_name: order.manual_company_name || (order.companies as any)?.name || "Unknown",
          items,
          total_quantity: order.total_quantity,
          total_amount: order.total_amount,
          status: order.status,
          payment_status: order.payment_status,
          notes: order.notes,
        };
      })
    );

    setOrders(ordersWithDetails);
  };

  const fetchProductStats = async () => {
    // Get all completed orders
    const { data: completedOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("status", "completed");

    if (!completedOrders || completedOrders.length === 0) {
      setProductStats([]);
      return;
    }

    const orderIds = completedOrders.map(o => o.id);

    // Get order lines with product info
    const { data: orderLines } = await supabase
      .from("order_lines")
      .select(`
        quantity,
        line_total,
        product_id,
        products (name)
      `)
      .in("order_id", orderIds);

    if (!orderLines) {
      setProductStats([]);
      return;
    }

    // Aggregate by product
    const statsMap = new Map<string, { quantity: number; revenue: number }>();
    
    orderLines.forEach((line: any) => {
      const productName = line.products?.name || "Unknown Product";
      const existing = statsMap.get(productName) || { quantity: 0, revenue: 0 };
      statsMap.set(productName, {
        quantity: existing.quantity + line.quantity,
        revenue: existing.revenue + Number(line.line_total),
      });
    });

    const stats: ProductStats[] = Array.from(statsMap.entries()).map(([name, data]) => ({
      product_name: name,
      total_quantity: data.quantity,
      total_revenue: data.revenue,
    }));

    stats.sort((a, b) => b.total_quantity - a.total_quantity);
    setProductStats(stats);
  };

  const fetchCompanyStats = async () => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select(`
        total_amount,
        company_id,
        manual_company_name,
        companies (name)
      `)
      .eq("status", "completed");

    if (!ordersData) {
      setCompanyStats([]);
      return;
    }

    // Aggregate by company
    const statsMap = new Map<string, { count: number; amount: number }>();
    
    ordersData.forEach((order: any) => {
      const companyName = order.manual_company_name || order.companies?.name || "Unknown Company";
      const existing = statsMap.get(companyName) || { count: 0, amount: 0 };
      statsMap.set(companyName, {
        count: existing.count + 1,
        amount: existing.amount + Number(order.total_amount),
      });
    });

    const stats: CompanyStats[] = Array.from(statsMap.entries()).map(([name, data]) => ({
      company_name: name,
      total_orders: data.count,
      total_amount: data.amount,
    }));

    stats.sort((a, b) => b.total_amount - a.total_amount);
    setCompanyStats(stats);
  };

  const filteredOrders = orders.filter((order) =>
    order.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.items.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openOrders = filteredOrders.filter(o => o.status === "open");
  const completedOrders = filteredOrders.filter(o => o.status === "completed");
  const totalRevenue = orders.filter(o => o.status === "completed").reduce((acc, o) => acc + o.total_amount, 0);

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
              ყველა შეკვეთა
            </h1>
            <p className="text-muted-foreground">ყველა კომპანიის შეკვეთები და სტატისტიკა</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">სულ შეკვეთები</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">მიმდინარე შეკვეთები</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{openOrders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">სრული შემოსავალი</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">${totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Product Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              პროდუქტების სტატისტიკა (გაყიდული)
            </CardTitle>
            <CardDescription>რომელი ღვინო იყიდება და რამდენი ლიტრი</CardDescription>
          </CardHeader>
          <CardContent>
            {productStats.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">სტატისტიკა არ მოიძებნა</p>
            ) : (
              <div className="space-y-3">
                {productStats.map((stat) => (
                  <div key={stat.product_name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{stat.product_name}</div>
                      <div className="text-sm text-muted-foreground">რაოდენობა: {stat.total_quantity} ლიტრი</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-success">${stat.total_revenue.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">შემოსავალი</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              კომპანიების სტატისტიკა
            </CardTitle>
            <CardDescription>რომელი კომპანია (შპს) ყიდულობს და რამდენს</CardDescription>
          </CardHeader>
          <CardContent>
            {companyStats.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">სტატისტიკა არ მოიძებნა</p>
            ) : (
              <div className="space-y-3">
                {companyStats.map((stat) => (
                  <div key={stat.company_name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{stat.company_name}</div>
                      <div className="text-sm text-muted-foreground">შეკვეთები: {stat.total_orders}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">${stat.total_amount.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">სრული თანხა</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ძებნა შეკვეთების მიხედვით..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Open Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-warning" />
              მიმდინარე შეკვეთები
            </CardTitle>
            <CardDescription>გახსნილი შეკვეთები</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {openOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">მიმდინარე შეკვეთები არ არის</p>
              ) : (
                openOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-primary">{order.id}</span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                          მიმდინარე
                        </span>
                      </div>
                      <div className="text-sm">
                        <Building2 className="inline h-3 w-3 mr-1" />
                        <span className="font-medium">{order.company_name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{order.items}</div>
                      {order.notes && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                          <FileText className="inline h-3 w-3 mr-1" />
                          <span className="font-medium">კომენტარი:</span> {order.notes}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {order.created_at}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">${order.total_amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">რაოდენობა: {order.total_quantity}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-success" />
              დასრულებული შეკვეთები
            </CardTitle>
            <CardDescription>დახურული შეკვეთები</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {completedOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">დასრულებული შეკვეთები არ არის</p>
              ) : (
                completedOrders.map((order) => (
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
                      </div>
                      <div className="text-sm">
                        <Building2 className="inline h-3 w-3 mr-1" />
                        <span className="font-medium">{order.company_name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{order.items}</div>
                      {order.notes && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                          <FileText className="inline h-3 w-3 mr-1" />
                          <span className="font-medium">კომენტარი:</span> {order.notes}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        შეიქმნა: {order.created_at} | დასრულდა: {order.completed_at}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-success">${order.total_amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">რაოდენობა: {order.total_quantity}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AllOrders;
