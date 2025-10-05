import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useParams, Link } from "react-router-dom";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  comment?: string;
}

const Finance = () => {
  const { companyId } = useParams();
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: "1", date: "2025-10-05", description: "Initial Investment", amount: 50000, type: "income" },
    { id: "2", date: "2025-10-04", description: "Office Supplies", amount: 1200, type: "expense", comment: "Desk setup" },
    { id: "3", date: "2025-10-03", description: "Software License", amount: 299, type: "expense" },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    description: "",
    amount: "",
    type: "income" as "income" | "expense",
    comment: "",
  });

  const balance = transactions.reduce((acc, t) => {
    return t.type === "income" ? acc + t.amount : acc - t.amount;
  }, 0);

  const handleAddTransaction = () => {
    if (!newTransaction.description || !newTransaction.amount) return;

    const transaction: Transaction = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      description: newTransaction.description,
      amount: parseFloat(newTransaction.amount),
      type: newTransaction.type,
      comment: newTransaction.comment || undefined,
    };

    setTransactions([transaction, ...transactions]);
    setNewTransaction({ description: "", amount: "", type: "income", comment: "" });
    setShowForm(false);
  };

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
            <p className="text-muted-foreground">Company ID: {companyId}</p>
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
                ${transactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
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
                ${transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Transaction</CardTitle>
              <CardDescription>Add a new income or expense record</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="e.g., Office Rent"
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={newTransaction.type === "income" ? "default" : "outline"}
                    onClick={() => setNewTransaction({ ...newTransaction, type: "income" })}
                    className="flex-1"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Income
                  </Button>
                  <Button
                    type="button"
                    variant={newTransaction.type === "expense" ? "default" : "outline"}
                    onClick={() => setNewTransaction({ ...newTransaction, type: "expense" })}
                    className="flex-1"
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Expense
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="comment">Comment (Optional)</Label>
                <Textarea
                  id="comment"
                  placeholder="Add any notes..."
                  value={newTransaction.comment}
                  onChange={(e) => setNewTransaction({ ...newTransaction, comment: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddTransaction} className="flex-1">Add Transaction</Button>
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
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <DollarSign className={`h-4 w-4 ${transaction.type === "income" ? "text-success" : "text-destructive"}`} />
                      <span className="font-medium">{transaction.description}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{transaction.date}</div>
                    {transaction.comment && (
                      <div className="text-sm text-muted-foreground mt-1 italic">"{transaction.comment}"</div>
                    )}
                  </div>
                  <div className={`text-xl font-bold ${transaction.type === "income" ? "text-success" : "text-destructive"}`}>
                    {transaction.type === "income" ? "+" : "-"}${transaction.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Finance;
