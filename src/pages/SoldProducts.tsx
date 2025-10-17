import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, TrendingUp, TrendingDown, Calendar, DollarSign } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ProductSale {
  product_id: string;
  product_name: string;
  total_sold: number;
  total_returned: number;
  net_sold: number;
  total_revenue: number;
  total_refunds: number;
  net_revenue: number;
}

interface SaleTransaction {
  id: string;
  product_name: string;
  company_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
  order_id: string;
  is_return: boolean;
}

const SoldProducts = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [productSales, setProductSales] = useState<ProductSale[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all order lines with product and company information
    const { data: orderLinesData, error: orderLinesError } = await supabase
      .from("order_lines")
      .select(`
        id,
        quantity,
        unit_price,
        line_total,
        order_id,
        products (
          id,
          name
        ),
        orders (
          created_at,
          companies (
            name
          )
        )
      `)
      .order("orders(created_at)", { ascending: false });

    if (orderLinesError) {
      toast({
        title: "Error loading sales data",
        description: orderLinesError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Fetch inventory transactions to identify returns
    const { data: returnsData, error: returnsError } = await supabase
      .from("inventory_transactions")
      .select(`
        id,
        product_id,
        change_quantity,
        created_at,
        related_order_id,
        reason,
        products (
          name
        )
      `)
      .eq("reason", "correction");

    if (returnsError) {
      toast({
        title: "Error loading returns data",
        description: returnsError.message,
        variant: "destructive",
      });
    }

    // Process data to calculate product sales statistics
    const salesMap = new Map<string, ProductSale>();
    const transactionsList: SaleTransaction[] = [];

    // Process regular sales
    orderLinesData?.forEach((line: any) => {
      const productId = line.products?.id || "unknown";
      const productName = line.products?.name || "Unknown Product";
      const companyName = line.orders?.companies?.name || "Unknown Company";
      
      if (!salesMap.has(productId)) {
        salesMap.set(productId, {
          product_id: productId,
          product_name: productName,
          total_sold: 0,
          total_returned: 0,
          net_sold: 0,
          total_revenue: 0,
          total_refunds: 0,
          net_revenue: 0,
        });
      }

      const sale = salesMap.get(productId)!;
      sale.total_sold += line.quantity;
      sale.total_revenue += Number(line.line_total);

      transactionsList.push({
        id: line.id,
        product_name: productName,
        company_name: companyName,
        quantity: line.quantity,
        unit_price: Number(line.unit_price),
        line_total: Number(line.line_total),
        created_at: line.orders?.created_at || "",
        order_id: line.order_id,
        is_return: false,
      });
    });

    // Process returns
    returnsData?.forEach((ret: any) => {
      const productId = ret.product_id;
      const productName = ret.products?.name || "Unknown Product";

      if (salesMap.has(productId)) {
        const sale = salesMap.get(productId)!;
        sale.total_returned += ret.change_quantity;
        // Estimate refund amount (this is approximate since we don't store exact refund amounts)
        const estimatedRefund = ret.change_quantity * (sale.total_revenue / sale.total_sold);
        sale.total_refunds += estimatedRefund;
      }
    });

    // Calculate net values
    salesMap.forEach((sale) => {
      sale.net_sold = sale.total_sold - sale.total_returned;
      sale.net_revenue = sale.total_revenue - sale.total_refunds;
    });

    setProductSales(Array.from(salesMap.values()));
    setTransactions(transactionsList);
    setLoading(false);
  };

  // Calculate totals
  const totalSold = productSales.reduce((acc, p) => acc + p.total_sold, 0);
  const totalReturned = productSales.reduce((acc, p) => acc + p.total_returned, 0);
  const netSold = productSales.reduce((acc, p) => acc + p.net_sold, 0);
  const totalRevenue = productSales.reduce((acc, p) => acc + p.total_revenue, 0);

  // Get available months and years from transactions
  const availableMonths = Array.from(new Set(
    transactions.map(t => new Date(t.created_at).toISOString().slice(0, 7))
  )).sort().reverse();

  const availableYears = Array.from(new Set(
    transactions.map(t => new Date(t.created_at).getFullYear().toString())
  )).sort().reverse();

  // Filter transactions by selected month
  const monthlyTransactions = transactions.filter(t => 
    t.created_at.startsWith(selectedMonth)
  );

  const monthlySold = monthlyTransactions.reduce((acc, t) => acc + t.quantity, 0);
  const monthlyRevenue = monthlyTransactions.reduce((acc, t) => acc + t.line_total, 0);

  // Filter transactions by selected year
  const yearlyTransactions = transactions.filter(t => 
    new Date(t.created_at).getFullYear().toString() === selectedYear
  );

  const yearlySold = yearlyTransactions.reduce((acc, t) => acc + t.quantity, 0);
  const yearlyRevenue = yearlyTransactions.reduce((acc, t) => acc + t.line_total, 0);

  // Get month name from date string
  const getMonthName = (dateString: string) => {
    const date = new Date(dateString + "-01");
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
              Sold Products Overview
            </h1>
            <p className="text-muted-foreground">Track sales, returns, and revenue for all products</p>
          </div>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {totalSold.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-warning" />
                Items Returned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {totalReturned.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                Net Items Sold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {netSold.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                ${totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Summary
                </CardTitle>
                <CardDescription>Sales and returns by month</CardDescription>
              </div>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.length > 0 ? (
                    availableMonths.map(month => (
                      <SelectItem key={month} value={month}>
                        {getMonthName(month)}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={selectedMonth}>
                      {getMonthName(selectedMonth)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-primary" />
                  Items Sold
                </div>
                <div className="text-2xl font-bold text-primary">
                  {monthlySold.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  Revenue
                </div>
                <div className="text-2xl font-bold text-success">
                  ${monthlyRevenue.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Yearly Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Yearly Summary
                </CardTitle>
                <CardDescription>Annual sales performance</CardDescription>
              </div>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.length > 0 ? (
                    availableYears.map(year => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={selectedYear}>
                      {selectedYear}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-primary" />
                  Items Sold
                </div>
                <div className="text-2xl font-bold text-primary">
                  {yearlySold.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  Revenue
                </div>
                <div className="text-2xl font-bold text-success">
                  ${yearlyRevenue.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle>Products Summary</CardTitle>
            <CardDescription>Detailed breakdown by product</CardDescription>
          </CardHeader>
          <CardContent>
            {productSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No sales data yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Total Sold</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Net Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Net Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSales.map((product) => (
                    <TableRow key={product.product_id}>
                      <TableCell className="font-medium">{product.product_name}</TableCell>
                      <TableCell className="text-right text-primary font-medium">
                        {product.total_sold}
                      </TableCell>
                      <TableCell className="text-right text-warning">
                        {product.total_returned}
                      </TableCell>
                      <TableCell className="text-right text-success font-medium">
                        {product.net_sold}
                      </TableCell>
                      <TableCell className="text-right">
                        ${product.total_revenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${product.net_revenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales Transactions</CardTitle>
            <CardDescription>Latest product sales across all companies</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <div className="space-y-4">
                {transactions.slice(0, 20).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium">{transaction.product_name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Company: {transaction.company_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString()} • {transaction.quantity} items @ ${transaction.unit_price.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-success">
                      ${transaction.line_total.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SoldProducts;
