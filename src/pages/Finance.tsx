import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Trash2 } from "lucide-react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface FinanceEntry {
  id: string;
  type: "income" | "expense";
  amount: number;
  comment: string | null;
  created_at: string;
  created_by: string | null;
  related_order_id?: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface SupplierSummary {
  company_id: string | null;
  company_name: string;
  total_items: number;
  total_amount: number;
  amount_paid: number;
  outstanding_debt: number;
}

const Finance = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [supplierSummaries, setSupplierSummaries] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [newEntry, setNewEntry] = useState({
    amount: "",
    type: "income" as "income" | "expense",
    comment: "",
  });
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteAction, setDeleteAction] = useState<"selected" | "all">("selected");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && companyId) {
      fetchData();
    }
  }, [user, companyId]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .single();

    if (companyError) {
      toast({
        title: "Error loading company",
        description: companyError.message,
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setCompany(companyData);

    const { data: entriesData, error: entriesError } = await supabase
      .from("finance_entries")
      .select("*")
      .eq("company_id", companyId)
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

    // Fetch supplier summaries from orders
    await fetchSupplierSummaries();

    setLoading(false);
  };

  const fetchSupplierSummaries = async () => {
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        company_id,
        manual_company_name,
        total_quantity,
        total_amount,
        payment_received_amount,
        companies (name)
      `)
      .eq("status", "completed");

    if (ordersError) {
      toast({
        title: "Error loading supplier data",
        description: ordersError.message,
        variant: "destructive",
      });
      return;
    }

    // Group orders by company and calculate summaries
    const summaryMap = new Map<string, SupplierSummary>();

    ordersData?.forEach((order: any) => {
      const companyKey = order.company_id || `manual-${order.manual_company_name}`;
      const companyName = order.companies?.name || order.manual_company_name || "Unknown Supplier";

      if (!summaryMap.has(companyKey)) {
        summaryMap.set(companyKey, {
          company_id: order.company_id,
          company_name: companyName,
          total_items: 0,
          total_amount: 0,
          amount_paid: 0,
          outstanding_debt: 0,
        });
      }

      const summary = summaryMap.get(companyKey)!;
      summary.total_items += order.total_quantity;
      summary.total_amount += parseFloat(order.total_amount);
      summary.amount_paid += parseFloat(order.payment_received_amount);
      summary.outstanding_debt = summary.total_amount - summary.amount_paid;
    });

    setSupplierSummaries(Array.from(summaryMap.values()));
  };

  const balance = entries.reduce((acc, entry) => {
    return entry.type === "income" ? acc + entry.amount : acc - entry.amount;
  }, 0);

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

  const handleAddEntry = async () => {
    if (!newEntry.amount || !user) return;

    const amount = parseFloat(newEntry.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("finance_entries").insert([{
      company_id: companyId,
      type: newEntry.type,
      amount,
      comment: newEntry.comment || null,
      created_by: user.id,
    }]);

    if (error) {
      toast({
        title: "Error adding entry",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Entry added successfully" });
      setNewEntry({ amount: "", type: "income", comment: "" });
      setShowForm(false);
      fetchData();
    }
  };

  const toggleEntrySelection = (entryId: string) => {
    const newSelection = new Set(selectedEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedEntries(newSelection);
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

    if (idsToDelete.length === 0) return;

    const { error } = await supabase
      .from("finance_entries")
      .delete()
      .in("id", idsToDelete);

    if (error) {
      toast({
        title: "წაშლის შეცდომა",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "წარმატებით წაიშალა",
        description: `${idsToDelete.length} ჩანაწერი წაიშალა`,
      });
      setSelectedEntries(new Set());
      setShowDeleteDialog(false);
      fetchData();
    }
  };

  const initiateDelete = (action: "selected" | "all") => {
    if (action === "selected" && selectedEntries.size === 0) {
      toast({
        title: "ჩანაწერები არ არის არჩეული",
        description: "გთხოვთ აირჩიოთ ჩანაწერები წასაშლელად",
        variant: "destructive",
      });
      return;
    }
    setDeleteAction(action);
    setShowDeleteDialog(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">იტვირთება...</div>
      </div>
    );
  }

  if (!user || !company) {
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
              <Building2 className="h-8 w-8 text-primary" />
              ფინანსური მენეჯმენტი
            </h1>
            <p className="text-muted-foreground">{company.name}</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            ტრანზაქციის დამატება
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">მიმდინარე ბალანსი</CardTitle>
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
                ${entries.filter(e => e.type === "income").reduce((acc, e) => acc + e.amount, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                სრული ხარჯები/ვალი
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                ${entries.filter(e => e.type === "expense").reduce((acc, e) => acc + e.amount, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              მიმწოდებლებისგან შესყიდვების შეჯამება
            </CardTitle>
            <CardDescription>ყველა მიმწოდებლისგან შესყიდვების მიმოხილვა</CardDescription>
          </CardHeader>
          <CardContent>
            {supplierSummaries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ჯერ არ არის დასრულებული შეკვეთები
              </div>
            ) : (
              <div className="space-y-4">
                {supplierSummaries.map((supplier, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg">{supplier.company_name}</h3>
                      {supplier.outstanding_debt > 0 && (
                        <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs rounded-full">
                          გადასახდელი ვალი
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">სულ ერთეული</div>
                        <div className="text-xl font-bold">{supplier.total_items}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">სულ დახარჯული</div>
                        <div className="text-xl font-bold">${supplier.total_amount.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">გადახდილი თანხა</div>
                        <div className="text-xl font-bold text-success">
                          ${supplier.amount_paid.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">გადასახდელი ვალი</div>
                        <div className={`text-xl font-bold ${supplier.outstanding_debt > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          ${supplier.outstanding_debt.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  თვიური შეჯამება
                </CardTitle>
                <CardDescription>იხილეთ შემოსავალი და ხარჯები თვის მიხედვით</CardDescription>
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
                <CardDescription>იხილეთ წლიური შემოსავალი და ხარჯები</CardDescription>
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

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>ახალი ჩანაწერი</CardTitle>
              <CardDescription>დაამატეთ ახალი შემოსავლის ან ხარჯის ჩანაწერი</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">თანხა</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newEntry.amount}
                  onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">ტიპი</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={newEntry.type === "income" ? "default" : "outline"}
                    onClick={() => setNewEntry({ ...newEntry, type: "income" })}
                    className="flex-1"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    შემოსავალი
                  </Button>
                  <Button
                    type="button"
                    variant={newEntry.type === "expense" ? "default" : "outline"}
                    onClick={() => setNewEntry({ ...newEntry, type: "expense" })}
                    className="flex-1"
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    ხარჯი/ვალი
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="comment">კომენტარი</Label>
                <Textarea
                  id="comment"
                  placeholder="დაამატეთ ინფორმაცია ტრანზაქციის შესახებ..."
                  value={newEntry.comment}
                  onChange={(e) => setNewEntry({ ...newEntry, comment: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddEntry} className="flex-1">ჩანაწერის დამატება</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>გაუქმება</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>ტრანზაქციების ისტორია</CardTitle>
                <CardDescription>ყველა ფინანსური ჩანაწერი ამ კომპანიისთვის</CardDescription>
              </div>
              {entries.length > 0 && (
                <div className="flex gap-2">
                  {selectedEntries.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => initiateDelete("selected")}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      არჩეულის წაშლა ({selectedEntries.size})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => initiateDelete("all")}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    ყველას წაშლა
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">ჯერ არ არის ჩანაწერები</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={selectedEntries.size === entries.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">ყველას არჩევა</span>
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
                        <DollarSign className={`h-4 w-4 ${entry.type === "income" ? "text-success" : "text-destructive"}`} />
                        <span className="font-medium">{entry.type === "income" ? "შემოსავალი" : "ხარჯი/ვალი"}</span>
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

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>დარწმუნებული ხართ?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteAction === "all" 
                  ? `ეს წაშლის ყველა ${entries.length} ფინანსურ ჩანაწერს. ეს მოქმედება ვერ გაუქმდება.`
                  : `ეს წაშლის ${selectedEntries.size} არჩეულ ჩანაწერს. ეს მოქმედება ვერ გაუქმდება.`
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
    </div>
  );
};

export default Finance;
