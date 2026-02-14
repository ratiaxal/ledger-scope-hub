import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, TrendingUp, TrendingDown, DollarSign, Package, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  warehouse_id: string | null;
}

interface Warehouse {
  id: string;
  name: string;
}

const WarehouseFinance = () => {
  const { warehouseId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    amount: "",
    type: "income" as "income" | "expense",
    comment: "",
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [editEntry, setEditEntry] = useState({ amount: "", type: "income" as "income" | "expense", comment: "" });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (user && warehouseId) {
      fetchData();
    }
  }, [user, warehouseId]);

  const fetchWarehouses = async () => {
    const { data, error } = await supabase
      .from("warehouses")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Error loading warehouses",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setWarehouses(data || []);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    const { data: warehouseData, error: warehouseError } = await supabase
      .from("warehouses")
      .select("*")
      .eq("id", warehouseId)
      .single();

    if (warehouseError) {
      toast({
        title: "Error loading warehouse",
        description: warehouseError.message,
        variant: "destructive",
      });
      navigate("/warehouse");
      return;
    }

    setWarehouse(warehouseData);

    const { data: entriesData, error: entriesError } = await supabase
      .from("finance_entries")
      .select("*")
      .eq("warehouse_id", warehouseId)
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

  const handleAddEntry = async () => {
    if (!newEntry.amount || !newEntry.comment.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("finance_entries")
      .insert([{
        type: newEntry.type,
        amount: parseFloat(newEntry.amount),
        comment: newEntry.comment,
        warehouse_id: warehouseId,
        company_id: null,
        related_order_id: null,
      }]);

    if (error) {
      toast({
        title: "Error adding entry",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Entry added successfully" });
    setNewEntry({ amount: "", type: "income", comment: "" });
    setShowForm(false);
    fetchData();
  };

  const handleWarehouseChange = (newWarehouseId: string) => {
    navigate(`/warehouse-finance/${newWarehouseId}`);
  };

  const handleEditEntry = (entry: FinanceEntry) => {
    setEditingEntry(entry);
    setEditEntry({ amount: String(entry.amount), type: entry.type, comment: entry.comment || "" });
    setShowEditDialog(true);
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
      setShowEditDialog(false);
      setEditingEntry(null);
      fetchData();
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) {
      return;
    }

    const { error } = await supabase
      .from("finance_entries")
      .delete()
      .eq("id", entryId);

    if (error) {
      toast({
        title: "Error deleting entry",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Entry deleted successfully" });
    fetchData();
  };

  const totalIncome = entries.filter(e => e.type === "income").reduce((acc, e) => acc + parseFloat(e.amount.toString()), 0);
  const totalExpense = entries.filter(e => e.type === "expense").reduce((acc, e) => acc + parseFloat(e.amount.toString()), 0);
  const balance = totalIncome - totalExpense;

  if (loading || authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Link to="/warehouse" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
              ← უკან საწყობზე
            </Link>
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <DollarSign className="h-8 w-8 text-primary" />
                  {warehouse?.name} - ფინანსები
                </h1>
                <p className="text-muted-foreground">Track finances for this warehouse</p>
              </div>
              <div className="ml-8">
                <Label className="text-sm text-muted-foreground mb-2">Switch Warehouse</Label>
                <Select value={warehouseId} onValueChange={handleWarehouseChange}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Choose warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            ჩანაწერის დამატება
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                სულ შემოსავალი
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                სულ ხარჯი
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                ${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                მიმდინარე ბალანსი
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${balance >= 0 ? 'text-primary' : 'text-red-500'}`}>
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add Finance Entry</CardTitle>
              <CardDescription>Record income or expense for {warehouse?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Transaction Type *</Label>
                  <Select value={newEntry.type} onValueChange={(value: "income" | "expense") => setNewEntry({ ...newEntry, type: value })}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">შემოსავალი (Income)</SelectItem>
                      <SelectItem value="expense">ხარჯი (Expense)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="comment">Comment *</Label>
                <Textarea
                  id="comment"
                  placeholder="Enter a description for this transaction"
                  value={newEntry.comment}
                  onChange={(e) => setNewEntry({ ...newEntry, comment: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddEntry} className="flex-1">Add Entry</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Financial History</CardTitle>
            <CardDescription>All transactions for {warehouse?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="py-12 text-center">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
                <p className="text-muted-foreground mb-4">Add your first finance entry</p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-full ${entry.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {entry.type === 'income' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{entry.comment || 'No comment'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-xl font-bold ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.type === 'income' ? '+' : '-'}${parseFloat(entry.amount.toString()).toFixed(2)}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleEditEntry(entry)} className="text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
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
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>გაუქმება</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default WarehouseFinance;
