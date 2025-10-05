import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Building2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface FinanceEntry {
  id: string;
  type: "income" | "expense";
  amount: number;
  comment: string | null;
  created_at: string;
  company_id: string | null;
  companies?: {
    name: string;
  };
}

const OverallFinance = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
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

    const { data: entriesData, error: entriesError } = await supabase
      .from("finance_entries")
      .select(`
        *,
        companies (
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (entriesError) {
      toast({
        title: "Error loading entries",
        description: entriesError.message,
        variant: "destructive",
      });
    } else {
      setEntries(entriesData || []);
    }

    setLoading(false);
  };

  const balance = entries.reduce((acc, entry) => {
    return entry.type === "income" ? acc + entry.amount : acc - entry.amount;
  }, 0);

  const totalIncome = entries
    .filter(e => e.type === "income")
    .reduce((acc, e) => acc + e.amount, 0);

  const totalExpense = entries
    .filter(e => e.type === "expense")
    .reduce((acc, e) => acc + e.amount, 0);

  // Get available months and years from entries
  const availableMonths = Array.from(new Set(
    entries.map(e => new Date(e.created_at).toISOString().slice(0, 7))
  )).sort().reverse();

  const availableYears = Array.from(new Set(
    entries.map(e => new Date(e.created_at).getFullYear().toString())
  )).sort().reverse();

  // Filter entries by selected month
  const monthlyEntries = entries.filter(e => 
    e.created_at.startsWith(selectedMonth)
  );

  const monthlyIncome = monthlyEntries
    .filter(e => e.type === "income")
    .reduce((acc, e) => acc + e.amount, 0);

  const monthlyExpense = monthlyEntries
    .filter(e => e.type === "expense")
    .reduce((acc, e) => acc + e.amount, 0);

  const monthlyBalance = monthlyIncome - monthlyExpense;

  // Filter entries by selected year
  const yearlyEntries = entries.filter(e => 
    new Date(e.created_at).getFullYear().toString() === selectedYear
  );

  const yearlyIncome = yearlyEntries
    .filter(e => e.type === "income")
    .reduce((acc, e) => acc + e.amount, 0);

  const yearlyExpense = yearlyEntries
    .filter(e => e.type === "expense")
    .reduce((acc, e) => acc + e.amount, 0);

  const yearlyBalance = yearlyIncome - yearlyExpense;

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
              <DollarSign className="h-8 w-8 text-primary" />
              Overall Financials
            </h1>
            <p className="text-muted-foreground">Complete financial overview across all companies</p>
          </div>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                ${balance.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                Total Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                ${totalIncome.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                ${totalExpense.toLocaleString()}
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
                <CardDescription>Income and expenses across all companies by month</CardDescription>
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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  Income
                </div>
                <div className="text-2xl font-bold text-success">
                  ${monthlyIncome.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Expenses
                </div>
                <div className="text-2xl font-bold text-destructive">
                  ${monthlyExpense.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  Balance
                </div>
                <div className={`text-2xl font-bold ${monthlyBalance >= 0 ? "text-success" : "text-destructive"}`}>
                  ${monthlyBalance.toLocaleString()}
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
                <CardDescription>Annual income and expenses across all companies</CardDescription>
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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  Income
                </div>
                <div className="text-2xl font-bold text-success">
                  ${yearlyIncome.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Expenses
                </div>
                <div className="text-2xl font-bold text-destructive">
                  ${yearlyExpense.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  Balance
                </div>
                <div className={`text-2xl font-bold ${yearlyBalance >= 0 ? "text-success" : "text-destructive"}`}>
                  ${yearlyBalance.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>Complete financial history across all companies</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className={`h-4 w-4 ${entry.type === "income" ? "text-success" : "text-destructive"}`} />
                        <span className="font-medium">{entry.type === "income" ? "Income" : "Expense"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Building2 className="h-3 w-3" />
                        <span>{entry.companies?.name || "Unknown Company"}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                      {entry.comment && (
                        <div className="text-sm text-muted-foreground mt-1 italic">"{entry.comment}"</div>
                      )}
                    </div>
                    <div className={`text-xl font-bold ${entry.type === "income" ? "text-success" : "text-destructive"}`}>
                      {entry.type === "income" ? "+" : "-"}${entry.amount.toLocaleString()}
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

export default OverallFinance;
