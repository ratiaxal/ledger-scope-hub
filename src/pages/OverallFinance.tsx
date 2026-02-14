import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Building2, Trash2, ArrowDownToLine, Pencil } from "lucide-react";
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
  related_order_id?: string | null;
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
  const [clearing, setClearing] = useState(false);
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [dateRangeFrom, setDateRangeFrom] = useState<string>("");
  const [dateRangeTo, setDateRangeTo] = useState<string>("");
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteAction, setDeleteAction] = useState<"selected" | "all">("selected");
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawal, setWithdrawal] = useState({
    amount: "",
    note: "",
  });
  const [showEditEntryDialog, setShowEditEntryDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [editEntry, setEditEntry] = useState({ amount: "", type: "income" as "income" | "expense", comment: "" });

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

  const handleClearAutomatedEntries = async () => {
    setClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('clear-automated-finances');
      
      if (error) throw error;

      toast({
        title: "Success",
        description: `Cleared ${data.deleted_count} automated financial entries`,
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear entries",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map(e => e.id)));
    }
  };

  const handleDeleteEntries = async () => {
    const idsToDelete = deleteAction === "all" 
      ? entries.map(e => e.id) 
      : Array.from(selectedEntries);

    const { error } = await supabase
      .from("finance_entries")
      .delete()
      .in("id", idsToDelete);

    if (error) {
      toast({
        title: "შეცდომა",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "წარმატება",
        description: `წაიშალა ${idsToDelete.length} ჩანაწერი`,
      });
      setSelectedEntries(new Set());
      fetchData();
    }
    setShowDeleteDialog(false);
  };

  const handleEditEntry = (entry: FinanceEntry) => {
    setEditingEntry(entry);
    setEditEntry({ amount: String(entry.amount), type: entry.type, comment: entry.comment || "" });
    setShowEditEntryDialog(true);
  };

  const handleSaveEditEntry = async () => {
    if (!editingEntry || !editEntry.amount) return;
    const amount = parseFloat(editEntry.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "არასწორი თანხა", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("finance_entries")
      .update({ amount, type: editEntry.type, comment: editEntry.comment || null })
      .eq("id", editingEntry.id);
    if (error) {
      toast({ title: "შეცდომა", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "ჩანაწერი განახლდა" });
      setShowEditEntryDialog(false);
      setEditingEntry(null);
      fetchData();
    }
  };

  const initiateDelete = (action: "selected" | "all") => {
    setDeleteAction(action);
    setShowDeleteDialog(true);
  };

  const handleWithdraw = async () => {
    if (!withdrawal.amount || !user) return;

    const amount = parseFloat(withdrawal.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "არასწორი თანხა",
        description: "გთხოვთ შეიყვანოთ სწორი დადებითი თანხა",
        variant: "destructive",
      });
      return;
    }

    if (amount > balance) {
      toast({
        title: "არასაკმარისი ბალანსი",
        description: "თქვენ არ გაქვთ საკმარისი ბალანსი ამ თანხის გასატანად",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("finance_entries").insert([{
      company_id: null,
      type: "expense",
      amount,
      comment: `გატანა: ${withdrawal.note || "კომენტარის გარეშე"}`,
      created_by: user.id,
    }]);

    if (error) {
      toast({
        title: "გატანის შეცდომა",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ 
        title: "წარმატებული გატანა",
        description: `$${amount.toLocaleString()} წარმატებით გატანილია`
      });
      setWithdrawal({ amount: "", note: "" });
      setShowWithdrawDialog(false);
      fetchData();
    }
  };

  const balance = entries.reduce((acc, entry) => {
    return entry.type === "income" ? acc + entry.amount : acc - entry.amount;
  }, 0);

  const totalIncome = entries
    .filter(e => e.type === "income")
    .reduce((acc, e) => acc + e.amount, 0);

  const totalExpense = entries
    .filter(e => e.type === "expense" && !e.related_order_id)
    .reduce((acc, e) => acc + e.amount, 0);

  const totalDebt = entries
    .filter(e => e.type === "expense" && e.related_order_id)
    .reduce((acc, e) => acc + e.amount, 0);

  // Get available months and years from entries
  const availableMonths = Array.from(new Set(
    entries.map(e => new Date(e.created_at).toISOString().slice(0, 7))
  )).sort().reverse();

  const availableYears = Array.from(new Set(
    entries.map(e => new Date(e.created_at).getFullYear().toString())
  )).sort().reverse();

  // Filter entries by selected month and year combination
  const selectedMonthYearString = `${selectedMonthYear}-${selectedMonthNum}`;
  const monthlyEntries = entries.filter(e => 
    e.created_at.startsWith(selectedMonthYearString)
  );

  const monthlyIncome = monthlyEntries
    .filter(e => e.type === "income")
    .reduce((acc, e) => acc + e.amount, 0);

  const monthlyExpense = monthlyEntries
    .filter(e => e.type === "expense")
    .reduce((acc, e) => acc + e.amount, 0);

  const monthlyBalance = monthlyIncome - monthlyExpense;

  // Calculate previous month data for comparison
  const currentMonthDate = new Date(`${selectedMonthYear}-${selectedMonthNum}-01`);
  const previousMonthDate = new Date(currentMonthDate);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonthString = previousMonthDate.toISOString().slice(0, 7);

  const previousMonthEntries = entries.filter(e => 
    e.created_at.startsWith(previousMonthString)
  );

  const previousMonthIncome = previousMonthEntries
    .filter(e => e.type === "income")
    .reduce((acc, e) => acc + e.amount, 0);

  const previousMonthExpense = previousMonthEntries
    .filter(e => e.type === "expense")
    .reduce((acc, e) => acc + e.amount, 0);

  const previousMonthBalance = previousMonthIncome - previousMonthExpense;

  // Calculate percentage changes
  const incomeChange = previousMonthIncome > 0 
    ? ((monthlyIncome - previousMonthIncome) / previousMonthIncome) * 100 
    : 0;
  const expenseChange = previousMonthExpense > 0 
    ? ((monthlyExpense - previousMonthExpense) / previousMonthExpense) * 100 
    : 0;
  const balanceChange = previousMonthBalance !== 0
    ? ((monthlyBalance - previousMonthBalance) / Math.abs(previousMonthBalance)) * 100 
    : 0;

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

  // Fetch yearly sold quantities
  const [yearlySoldQuantity, setYearlySoldQuantity] = useState<number>(0);

  useEffect(() => {
    const fetchYearlySoldQuantity = async () => {
      const yearStart = `${selectedYear}-01-01T00:00:00`;
      const yearEnd = `${selectedYear}-12-31T23:59:59`;

      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, completed_at")
        .eq("status", "completed")
        .gte("completed_at", yearStart)
        .lte("completed_at", yearEnd);

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        
        const { data: orderLinesData } = await supabase
          .from("order_lines")
          .select("quantity")
          .in("order_id", orderIds);

        const totalQuantity = orderLinesData?.reduce((acc, line) => acc + line.quantity, 0) || 0;
        setYearlySoldQuantity(totalQuantity);
      } else {
        setYearlySoldQuantity(0);
      }
    };

    if (user) {
      fetchYearlySoldQuantity();
    }
  }, [selectedYear, user]);

  // Filter entries by date range
  const dateRangeEntries = dateRangeFrom && dateRangeTo 
    ? entries.filter(e => {
        const entryDate = e.created_at.split('T')[0];
        return entryDate >= dateRangeFrom && entryDate <= dateRangeTo;
      })
    : [];

  const dateRangeIncome = dateRangeEntries
    .filter(e => e.type === "income")
    .reduce((acc, e) => acc + e.amount, 0);

  const dateRangeExpense = dateRangeEntries
    .filter(e => e.type === "expense")
    .reduce((acc, e) => acc + e.amount, 0);

  const dateRangeBalance = dateRangeIncome - dateRangeExpense;

  // Get month name from date string
  const getMonthName = (dateString: string) => {
    const date = new Date(dateString + "-01");
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getMonthOnlyName = (monthNum: string) => {
    const monthNames = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 
                        'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
    return monthNames[parseInt(monthNum) - 1] || '';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">იტვირთება...</div>
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
              ← უკან მთავარზე
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-primary" />
              ზოგადი ფინანსები
            </h1>
            <p className="text-muted-foreground">სრული ფინანსური მიმოხილვა ყველა კომპანიაში</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowDownToLine className="h-4 w-4" />
                  თანხის გატანა
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>თანხის გატანა</DialogTitle>
                  <DialogDescription>
                    ხელმისაწვდომი ბალანსი: <span className="font-bold text-lg">${balance.toLocaleString()}</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="withdraw-amount">თანხა *</Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      step="0.01"
                      value={withdrawal.amount}
                      onChange={(e) => setWithdrawal({ ...withdrawal, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="withdraw-note">კომენტარი *</Label>
                    <Textarea
                      id="withdraw-note"
                      value={withdrawal.note}
                      onChange={(e) => setWithdrawal({ ...withdrawal, note: e.target.value })}
                      placeholder="რისთვის იხდით ამ თანხას?"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleWithdraw} className="flex-1">
                      თანხის გატანა
                    </Button>
                    <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
                      გაუქმება
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAutomatedEntries}
              disabled={clearing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clearing ? "იშლება..." : "ავტომატური ჩანაწერების გასუფთავება"}
            </Button>
          </div>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">სრული ბალანსი</CardTitle>
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
                სრული შემოსავალი
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
                სრული ხარჯები
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                ${totalExpense.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-500" />
                გადაუხდელი შეკვეთები (ვალი)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-500">
                ${totalDebt.toLocaleString()}
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
                  თვიური შეჯამება
                </CardTitle>
                <CardDescription>შემოსავალი და ხარჯები ყველა კომპანიაში თვის მიხედვით</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={selectedMonthNum} onValueChange={setSelectedMonthNum}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(month => (
                      <SelectItem key={month} value={month}>
                        {getMonthOnlyName(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedMonthYear} onValueChange={setSelectedMonthYear}>
                  <SelectTrigger className="w-28">
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
                      <SelectItem value={selectedMonthYear}>
                        {selectedMonthYear}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    შემოსავალი
                  </div>
                  <div className="text-2xl font-bold text-success">
                    ${monthlyIncome.toLocaleString()}
                  </div>
                  {previousMonthIncome > 0 && (
                    <div className={`text-sm mt-1 flex items-center gap-1 ${incomeChange >= 0 ? 'text-success' : 'text-warning'}`}>
                      {incomeChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(incomeChange).toFixed(1)}% წინა თვესთან შედარებით
                    </div>
                  )}
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    ხარჯები
                  </div>
                  <div className="text-2xl font-bold text-destructive">
                    ${monthlyExpense.toLocaleString()}
                  </div>
                  {previousMonthExpense > 0 && (
                    <div className={`text-sm mt-1 flex items-center gap-1 ${expenseChange <= 0 ? 'text-success' : 'text-warning'}`}>
                      {expenseChange <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {Math.abs(expenseChange).toFixed(1)}% წინა თვესთან შედარებით
                    </div>
                  )}
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4" />
                    ბალანსი
                  </div>
                  <div className={`text-2xl font-bold ${monthlyBalance >= 0 ? "text-success" : "text-destructive"}`}>
                    ${monthlyBalance.toLocaleString()}
                  </div>
                  {previousMonthBalance !== 0 && (
                    <div className={`text-sm mt-1 flex items-center gap-1 ${balanceChange >= 0 ? 'text-success' : 'text-warning'}`}>
                      {balanceChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(balanceChange).toFixed(1)}% წინა თვესთან შედარებით
                    </div>
                  )}
                </div>
              </div>

              {/* Previous Month Comparison */}
              {previousMonthIncome > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                    წინა თვე ({getMonthName(previousMonthString)})
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">შემოსავალი: </span>
                      <span className="font-bold text-success">${previousMonthIncome.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ხარჯები: </span>
                      <span className="font-bold text-destructive">${previousMonthExpense.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ბალანსი: </span>
                      <span className={`font-bold ${previousMonthBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                        ${previousMonthBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {monthlyEntries.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  არჩეულ თვეში ფინანსური ჩანაწერები არ არის
                </div>
              )}
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
                  წლიური შეჯამება
                </CardTitle>
                <CardDescription>წლიური შემოსავალი და ხარჯები ყველა კომპანიაში</CardDescription>
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
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  შემოსავალი
                </div>
                <div className="text-2xl font-bold text-success">
                  ${yearlyIncome.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  ხარჯები
                </div>
                <div className="text-2xl font-bold text-destructive">
                  ${yearlyExpense.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  ბალანსი
                </div>
                <div className={`text-2xl font-bold ${yearlyBalance >= 0 ? "text-success" : "text-destructive"}`}>
                  ${yearlyBalance.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  გაყიდული რაოდენობა
                </div>
                <div className="text-2xl font-bold text-primary">
                  {yearlySoldQuantity.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Range Summary */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  პერიოდის მიხედვით ფილტრი
                </CardTitle>
                <CardDescription>აირჩიეთ თარიღების დიაპაზონი შემოსავლის და ხარჯების სანახავად</CardDescription>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">დან</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateRangeFrom}
                    onChange={(e) => setDateRangeFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo">მდე</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateRangeTo}
                    onChange={(e) => setDateRangeTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dateRangeFrom && dateRangeTo ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    შემოსავალი
                  </div>
                  <div className="text-2xl font-bold text-success">
                    ${dateRangeIncome.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    ხარჯები
                  </div>
                  <div className="text-2xl font-bold text-destructive">
                    ${dateRangeExpense.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4" />
                    ბალანსი
                  </div>
                  <div className={`text-2xl font-bold ${dateRangeBalance >= 0 ? "text-success" : "text-destructive"}`}>
                    ${dateRangeBalance.toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                აირჩიეთ თარიღების დიაპაზონი შედეგების სანახავად
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>ყველა ტრანზაქცია</CardTitle>
                <CardDescription>სრული ფინანსური ისტორია ყველა კომპანიაში</CardDescription>
              </div>
              {entries.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => initiateDelete("selected")}
                    disabled={selectedEntries.size === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    არჩეულის წაშლა ({selectedEntries.size})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => initiateDelete("all")}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    ყველას წაშლა
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">ჯერ არ არის ტრანზაქციები</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={selectedEntries.size === entries.length && entries.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm font-medium">ყველას არჩევა</span>
                </div>
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedEntries.has(entry.id)}
                      onCheckedChange={() => toggleEntrySelection(entry.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className={`h-4 w-4 ${
                          entry.type === "income" ? "text-success" : 
                          entry.related_order_id ? "text-amber-500" : 
                          "text-destructive"
                        }`} />
                        <span className="font-medium">
                          {entry.type === "income" ? "შემოსავალი" : 
                           entry.related_order_id ? "გადაუხდელი შეკვეთა (ვალი)" : 
                           "ხარჯი"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Building2 className="h-3 w-3" />
                        <span>{entry.companies?.name || "უცნობი კომპანია"}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                      {entry.comment && (
                        <div className="text-sm text-muted-foreground mt-1 italic">"{entry.comment}"</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-xl font-bold ${
                        entry.type === "income" ? "text-success" : 
                        entry.related_order_id ? "text-amber-500" : 
                        "text-destructive"
                      }`}>
                        {entry.type === "income" ? "+" : "-"}${entry.amount.toLocaleString()}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleEditEntry(entry)} className="text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEditEntryDialog} onOpenChange={setShowEditEntryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ჩანაწერის რედაქტირება</DialogTitle>
            <DialogDescription>შეცვალეთ ფინანსური ჩანაწერის მონაცემები</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>თანხა</Label>
              <Input type="number" step="0.01" value={editEntry.amount} onChange={(e) => setEditEntry({ ...editEntry, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>ტიპი</Label>
              <div className="flex gap-4">
                <Button type="button" variant={editEntry.type === "income" ? "default" : "outline"} onClick={() => setEditEntry({ ...editEntry, type: "income" })} className="flex-1">შემოსავალი</Button>
                <Button type="button" variant={editEntry.type === "expense" ? "default" : "outline"} onClick={() => setEditEntry({ ...editEntry, type: "expense" })} className="flex-1">ხარჯი</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>კომენტარი</Label>
              <Textarea value={editEntry.comment} onChange={(e) => setEditEntry({ ...editEntry, comment: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveEditEntry} className="flex-1">შენახვა</Button>
              <Button variant="outline" onClick={() => setShowEditEntryDialog(false)}>გაუქმება</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>დარწმუნებული ხართ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAction === "all" 
                ? "ეს მოქმედება წაშლის ყველა ფინანსურ ჩანაწერს. ეს მოქმედება არ შეიძლება გაუქმდეს."
                : `ეს მოქმედება წაშლის ${selectedEntries.size} არჩეულ ჩანაწერს. ეს მოქმედება არ შეიძლება გაუქმდეს.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>გაუქმება</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntries} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              წაშლა
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OverallFinance;
