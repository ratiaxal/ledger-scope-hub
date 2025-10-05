import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, LogOut, DollarSign, Package, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Company {
  id: string;
  name: string;
  registration_number: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: "",
    registration_number: "",
    contact_phone: "",
    contact_email: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanies();
    }
  }, [user]);

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading companies",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCompanies(data || []);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.name) {
      toast({
        title: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("companies").insert([{
      name: newCompany.name,
      registration_number: newCompany.registration_number || null,
      contact_phone: newCompany.contact_phone || null,
      contact_email: newCompany.contact_email || null,
    }]);

    if (error) {
      toast({
        title: "Error adding company",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Company added successfully" });
      setNewCompany({ name: "", registration_number: "", contact_phone: "", contact_email: "" });
      setShowAddDialog(false);
      fetchCompanies();
    }
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", companyId);

    if (error) {
      toast({
        title: "Error deleting company",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: `${companyName} deleted successfully` });
      fetchCompanies();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) {
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
            <h1 className="text-4xl font-bold flex items-center gap-2">
              <Building2 className="h-10 w-10 text-primary" />
              Business Manager
            </h1>
            <p className="text-muted-foreground mt-2">Manage your companies, finances, orders, and inventory</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Company
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Company</DialogTitle>
                  <DialogDescription>Register a new company in the system</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input
                      id="name"
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registration">Registration Number</Label>
                    <Input
                      id="registration"
                      value={newCompany.registration_number}
                      onChange={(e) => setNewCompany({ ...newCompany, registration_number: e.target.value })}
                      placeholder="123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Contact Phone</Label>
                    <Input
                      id="phone"
                      value={newCompany.contact_phone}
                      onChange={(e) => setNewCompany({ ...newCompany, contact_phone: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newCompany.contact_email}
                      onChange={(e) => setNewCompany({ ...newCompany, contact_email: e.target.value })}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddCompany} className="flex-1">Add Company</Button>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {companies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No companies yet</h3>
              <p className="text-muted-foreground mb-4">Get started by adding your first company</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Company
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <Card key={company.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {company.name}
                      </CardTitle>
                      <CardDescription>
                        {company.registration_number && `Reg: ${company.registration_number}`}
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Company</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{company.name}"? This action cannot be undone and will remove all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCompany(company.id, company.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {company.contact_phone && (
                    <p className="text-sm text-muted-foreground">📞 {company.contact_phone}</p>
                  )}
                  {company.contact_email && (
                    <p className="text-sm text-muted-foreground">✉️ {company.contact_email}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Link to={`/finance/${company.id}`}>
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <DollarSign className="h-4 w-4" />
                        Finance
                      </Button>
                    </Link>
                    <Link to={`/orders/${company.id}`}>
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <FileText className="h-4 w-4" />
                        Orders
                      </Button>
                    </Link>
                    <Link to={`/warehouse/${company.id}`}>
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <Package className="h-4 w-4" />
                        Stock
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
