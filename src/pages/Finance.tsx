import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
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
}

interface Company {
  id: string;
  name: string;
}

const Finance = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    amount: "",
    type: "income" as "income" | "expense",
    comment: "",
  });

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

    setLoading(false);
  };

  const balance = entries.reduce((acc, entry) => {
    return entry.type === "income" ? acc + entry.amount : acc - entry.amount;
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Loading...</div>
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
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Finance Management
            </h1>
            <p className="text-muted-foreground">{company.name}</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
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
                ${entries.filter(e => e.type === "income").reduce((acc, e) => acc + e.amount, 0).toLocaleString()}
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
                ${entries.filter(e => e.type === "expense").reduce((acc, e) => acc + e.amount, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Entry</CardTitle>
              <CardDescription>Add a new income or expense record</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
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
                <Label htmlFor="type">Type</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={newEntry.type === "income" ? "default" : "outline"}
                    onClick={() => setNewEntry({ ...newEntry, type: "income" })}
                    className="flex-1"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Income
                  </Button>
                  <Button
                    type="button"
                    variant={newEntry.type === "expense" ? "default" : "outline"}
                    onClick={() => setNewEntry({ ...newEntry, type: "expense" })}
                    className="flex-1"
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Expense
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="comment">Comment</Label>
                <Textarea
                  id="comment"
                  placeholder="Add details about this transaction..."
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
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All financial records for this company</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No entries yet</p>
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

export default Finance;
