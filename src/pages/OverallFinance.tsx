import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Building2, Trash2 } from "lucide-react";
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
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteAction, setDeleteAction] = useState<"selected" | "all">("selected");

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

  const initiateDelete = (action: "selected" | "all") => {
    setDeleteAction(action);
    setShowDeleteDialog(true);
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
                  შემოსავალი
                </div>
                <div className="text-2xl font-bold text-success">
                  ${monthlyIncome.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  ხარჯები
                </div>
                <div className="text-2xl font-bold text-destructive">
                  ${monthlyExpense.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  ბალანსი
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
            <div className="grid gap-4 md:grid-cols-3">
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
            </div>
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
                    <div className={`text-xl font-bold ${
                      entry.type === "income" ? "text-success" : 
                      entry.related_order_id ? "text-amber-500" : 
                      "text-destructive"
                    }`}>
                      {entry.type === "income" ? "+" : "-"}${entry.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
