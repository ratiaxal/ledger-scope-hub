import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Trash2, ArrowDownToLine, Pencil } from "lucide-react";
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

interface ProductPurchase {
  product_id: string;
  product_name: string;
  total_quantity: number;
  unit_price: number;
  total_amount: number;
}

const Finance = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [supplierSummaries, setSupplierSummaries] = useState<SupplierSummary[]>([]);
  const [productPurchases, setProductPurchases] = useState<ProductPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    amount: "",
    type: "income" as "income" | "expense",
    comment: "",
  });
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteAction, setDeleteAction] = useState<"selected" | "all">("selected");
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawal, setWithdrawal] = useState({
    amount: "",
    note: "",
  });
  const [selectedPurchases, setSelectedPurchases] = useState<Set<string>>(new Set());
  const [showDeletePurchasesDialog, setShowDeletePurchasesDialog] = useState(false);
  const [deletePurchasesAction, setDeletePurchasesAction] = useState<"selected" | "all">("selected");
  const [showEditEntryDialog, setShowEditEntryDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [editEntry, setEditEntry] = useState({ amount: "", type: "income" as "income" | "expense", comment: "" });

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
    
    // Fetch product purchases for this company
    await fetchProductPurchases();

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

  const fetchProductPurchases = async () => {
    // First get all orders for this company
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'completed');

    if (ordersError || !ordersData || ordersData.length === 0) {
      setProductPurchases([]);
      return;
    }

    const orderIds = ordersData.map(order => order.id);

    // Then get order lines for these orders
    const { data: orderLinesData, error: orderLinesError } = await supabase
      .from("order_lines")
      .select(`
        product_id,
        quantity,
        unit_price,
        products (name)
      `)
      .in('order_id', orderIds);

    if (orderLinesError) {
      console.error("Error loading product purchases:", orderLinesError);
      return;
    }

    // Group by product and calculate totals
    const productMap = new Map<string, ProductPurchase>();

    orderLinesData?.forEach((line: any) => {
      const productId = line.product_id;
      const productName = line.products?.name || "Unknown Product";

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          product_id: productId,
          product_name: productName,
          total_quantity: 0,
          unit_price: line.unit_price,
          total_amount: 0,
        });
      }

      const product = productMap.get(productId)!;
      product.total_quantity += line.quantity;
      product.total_amount += line.quantity * line.unit_price;
    });

    setProductPurchases(Array.from(productMap.values()).sort((a, b) => b.total_quantity - a.total_quantity));
  };

  const balance = entries.reduce((acc, entry) => {
    return entry.type === "income" ? acc + entry.amount : acc - entry.amount;
  }, 0);

  // Calculate debt from order-related entries
  const debtEntries = entries.filter(e => e.related_order_id);
  const totalDebt = debtEntries.reduce((acc, entry) => {
    return entry.type === "expense" ? acc + entry.amount : acc - entry.amount;
  }, 0);

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
      company_id: companyId,
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

  const togglePurchaseSelection = (productId: string) => {
    const newSelection = new Set(selectedPurchases);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedPurchases(newSelection);
  };

  const toggleSelectAllPurchases = () => {
    if (selectedPurchases.size === productPurchases.length) {
      setSelectedPurchases(new Set());
    } else {
      setSelectedPurchases(new Set(productPurchases.map(p => p.product_id)));
    }
  };

  const initiateDeletePurchases = (action: "selected" | "all") => {
    if (action === "selected" && selectedPurchases.size === 0) {
      toast({
        title: "პროდუქტები არ არის არჩეული",
        description: "გთხოვთ აირჩიოთ პროდუქტები წასაშლელად",
        variant: "destructive",
      });
      return;
    }
    setDeletePurchasesAction(action);
    setShowDeletePurchasesDialog(true);
  };

  const handleDeletePurchases = async () => {
    const productsToDelete = deletePurchasesAction === "all"
      ? productPurchases
      : productPurchases.filter(p => selectedPurchases.has(p.product_id));

    if (productsToDelete.length === 0) return;

    try {
      // Get all orders for this company
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', 'completed');

      if (ordersError) throw ordersError;
      if (!ordersData || ordersData.length === 0) return;

      const orderIds = ordersData.map(order => order.id);

      // For each product to delete
      for (const product of productsToDelete) {
        // Get order lines for this product
        const { data: orderLinesData, error: orderLinesError } = await supabase
          .from('order_lines')
          .select('*')
          .in('order_id', orderIds)
          .eq('product_id', product.product_id);

        if (orderLinesError) throw orderLinesError;
        if (!orderLinesData) continue;

        // Calculate total quantity to return to inventory
        const totalQuantity = orderLinesData.reduce((sum, line) => sum + line.quantity, 0);

        // Update product inventory - add back the quantities
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', product.product_id)
          .single();

        if (!productError && productData) {
          await supabase
            .from('products')
            .update({ current_stock: productData.current_stock + totalQuantity })
            .eq('id', product.product_id);
        }

        // Delete the order lines
        await supabase
          .from('order_lines')
          .delete()
          .in('id', orderLinesData.map(line => line.id));

        // Record inventory transactions for returns
        await supabase
          .from('inventory_transactions')
          .insert(orderLinesData.map(line => ({
            product_id: product.product_id,
            change_quantity: line.quantity,
            reason: 'correction' as const,
            comment: 'დაბრუნება - შესყიდვის წაშლა',
          })));
      }

      toast({
        title: "წარმატებით წაიშალა",
        description: `${productsToDelete.length} პროდუქტის შესყიდვა წაიშალა და მარაგები განახლდა`,
      });

      setSelectedPurchases(new Set());
      setShowDeletePurchasesDialog(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "წაშლის შეცდომა",
        description: error.message,
        variant: "destructive",
      });
    }
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
          <div className="flex gap-2">
            <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
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
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="h-4 w-4" />
              ტრანზაქციის დამატება
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
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
                <TrendingDown className="h-4 w-4 text-warning" />
                გადასახდელი ვალი
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${totalDebt > 0 ? "text-warning" : "text-muted-foreground"}`}>
                ${totalDebt.toLocaleString()}
              </div>
              {totalDebt > 0 && (
                <p className="text-xs text-muted-foreground mt-2">შეკვეთებიდან გადასახდელი</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Product Purchases */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  პროდუქტების შესყიდვები
                </CardTitle>
                <CardDescription>რა პროდუქტებს ყიდულობს ეს კომპანია და რა რაოდენობით</CardDescription>
              </div>
              {productPurchases.length > 0 && (
                <div className="flex gap-2">
                  {selectedPurchases.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => initiateDeletePurchases("selected")}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      არჩეულის წაშლა ({selectedPurchases.size})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => initiateDeletePurchases("all")}
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
            {productPurchases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ჯერ არ არის შესყიდული პროდუქტები
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={selectedPurchases.size === productPurchases.length}
                    onCheckedChange={toggleSelectAllPurchases}
                  />
                  <span className="text-sm text-muted-foreground">ყველას არჩევა</span>
                </div>
                {productPurchases.map((product) => (
                  <div
                    key={product.product_id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedPurchases.has(product.product_id)}
                        onCheckedChange={() => togglePurchaseSelection(product.product_id)}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{product.product_name}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>რაოდენობა: <span className="font-bold text-foreground">{product.total_quantity.toLocaleString()} ლიტრი</span></span>
                            <span>ფასი: <span className="font-bold text-foreground">${product.unit_price.toFixed(2)}</span></span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground mb-1">სულ ღირებულება</div>
                          <div className="text-2xl font-bold text-primary">
                            ${product.total_amount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    <div className="flex items-center gap-2">
                      <div className={`text-xl font-bold ${entry.type === "income" ? "text-success" : "text-destructive"}`}>
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

        <AlertDialog open={showDeletePurchasesDialog} onOpenChange={setShowDeletePurchasesDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>შესყიდვების წაშლა და დაბრუნება</AlertDialogTitle>
              <AlertDialogDescription>
                {deletePurchasesAction === "all" 
                  ? `ეს წაშლის ყველა ${productPurchases.length} პროდუქტის შესყიდვას და დააბრუნებს რაოდენობებს საწყობში. ეს მოქმედება ვერ გაუქმდება.`
                  : `ეს წაშლის ${selectedPurchases.size} პროდუქტის შესყიდვას და დააბრუნებს რაოდენობებს საწყობში. ეს მოქმედება ვერ გაუქმდება.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>გაუქმება</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePurchases} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                წაშლა და დაბრუნება
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Finance;
