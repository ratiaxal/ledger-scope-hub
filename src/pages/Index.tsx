import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, LogOut, DollarSign, Package, FileText, Trash2, TrendingUp, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Company {
  id: string;
  name: string;
  identification_number: string | null;
  address: string | null;
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
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [resetting, setResetting] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: "",
    identification_number: "",
    address: "",
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
      identification_number: newCompany.identification_number || null,
      address: newCompany.address || null,
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
      setNewCompany({ name: "", identification_number: "", address: "", contact_phone: "", contact_email: "" });
      setShowAddDialog(false);
      fetchCompanies();
    }
  };

  const handleEditCompany = async () => {
    if (!editingCompany) return;
    const { error } = await supabase.from("companies").update({
      name: editingCompany.name,
      identification_number: editingCompany.identification_number || null,
      address: editingCompany.address || null,
      contact_phone: editingCompany.contact_phone || null,
      contact_email: editingCompany.contact_email || null,
    }).eq("id", editingCompany.id);

    if (error) {
      toast({ title: "შეცდომა", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "კომპანია განახლდა" });
      setEditingCompany(null);
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

  const handleResetAllData = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-all-data');
      if (error) throw error;

      toast({
        title: "სისტემა გასუფთავდა",
        description: data.message,
      });
      fetchCompanies();
    } catch (error) {
      toast({
        title: "შეცდომა",
        description: error instanceof Error ? error.message : "Failed to reset data",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) {
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
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold flex items-center gap-2">
              <Building2 className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
              ბიზნეს მენეჯერი
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">მართეთ თქვენი კომპანიები, ფინანსები, შეკვეთები და ინვენტარი</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  კომპანიის დამატება
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>ახალი კომპანიის დამატება</DialogTitle>
                  <DialogDescription>დარეგისტრირეთ ახალი კომპანია სისტემაში</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">კომპანიის სახელი *</Label>
                    <Input
                      id="name"
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="identification">საიდენტიფიკაციო ნომერი</Label>
                    <Input
                      id="identification"
                      value={newCompany.identification_number}
                      onChange={(e) => setNewCompany({ ...newCompany, identification_number: e.target.value })}
                      placeholder="000000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">მისამართი</Label>
                    <Input
                      id="address"
                      value={newCompany.address}
                      onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                      placeholder="ქ. თბილისი, ..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">საკონტაქტო ტელეფონი</Label>
                    <Input
                      id="phone"
                      value={newCompany.contact_phone}
                      onChange={(e) => setNewCompany({ ...newCompany, contact_phone: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">საკონტაქტო ელ-ფოსტა</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newCompany.contact_email}
                      onChange={(e) => setNewCompany({ ...newCompany, contact_email: e.target.value })}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddCompany} className="flex-1">კომპანიის დამატება</Button>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>გაუქმება</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="destructive" className="gap-2" size="sm" disabled={resetting} onClick={handleResetAllData}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{resetting ? "იშლება..." : "ყველას წაშლა"}</span>
              <span className="sm:hidden">{resetting ? "..." : "წაშლა"}</span>
            </Button>
            <Button variant="outline" onClick={handleSignOut} className="gap-2" size="sm">
              <LogOut className="h-4 w-4" />
              გასვლა
            </Button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {/* Overall Financials Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                ზოგადი ფინანსები
              </CardTitle>
              <CardDescription>
                იხილეთ სრული ფინანსური მიმოხილვა ყველა კომპანიაში
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/overall-finance">
                <Button className="w-full gap-2">
                  <DollarSign className="h-4 w-4" />
                  ზოგადი ფინანსების ნახვა
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Sold Products Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                გაყიდული პროდუქტები
              </CardTitle>
              <CardDescription>
                თვალი ადევნეთ გაყიდვებს, დაბრუნებებს და შემოსავალს ყველა პროდუქტზე
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/sold-products">
                <Button className="w-full gap-2">
                  <FileText className="h-4 w-4" />
                  გაყიდული პროდუქტების ნახვა
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* All Orders Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                ყველა შეკვეთა
              </CardTitle>
              <CardDescription>
                ნახეთ ყველა შეკვეთა და სტატისტიკა ყველა კომპანიისთვის
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/all-orders">
                <Button className="w-full gap-2">
                  <FileText className="h-4 w-4" />
                  ყველა შეკვეთის ნახვა
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Shared Warehouse Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                საერთო საწყობი
              </CardTitle>
              <CardDescription>
                მართეთ ინვენტარი ყველა კომპანიისთვის
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/warehouse">
                <Button className="w-full gap-2">
                  <Package className="h-4 w-4" />
                  საწყობის ნახვა
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {companies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">ჯერ არ არის კომპანიები</h3>
              <p className="text-muted-foreground mb-4">დაიწყეთ თქვენი პირველი კომპანიის დამატებით</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                კომპანიის დამატება
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
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setEditingCompany(company)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteCompany(company.id, company.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {company.identification_number && (
                    <p className="text-sm text-muted-foreground">🆔 {company.identification_number}</p>
                  )}
                  {company.address && (
                    <p className="text-sm text-muted-foreground">📍 {company.address}</p>
                  )}
                  {company.contact_phone && (
                    <p className="text-sm text-muted-foreground">📞 {company.contact_phone}</p>
                  )}
                  {company.contact_email && (
                    <p className="text-sm text-muted-foreground">✉️ {company.contact_email}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <Link to={`/finance/${company.id}`}>
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <DollarSign className="h-4 w-4" />
                        ფინანსები
                      </Button>
                    </Link>
                    <Link to={`/orders/${company.id}`}>
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <FileText className="h-4 w-4" />
                        შეკვეთები
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>კომპანიის რედაქტირება</DialogTitle>
              <DialogDescription>შეცვალეთ კომპანიის ინფორმაცია</DialogDescription>
            </DialogHeader>
            {editingCompany && (
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>კომპანიის სახელი *</Label>
                  <Input value={editingCompany.name} onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>რეგისტრაციის ნომერი</Label>
                  <Input value={editingCompany.registration_number || ""} onChange={(e) => setEditingCompany({ ...editingCompany, registration_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>საიდენტიფიკაციო ნომერი</Label>
                  <Input value={editingCompany.identification_number || ""} onChange={(e) => setEditingCompany({ ...editingCompany, identification_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>მისამართი</Label>
                  <Input value={editingCompany.address || ""} onChange={(e) => setEditingCompany({ ...editingCompany, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>საკონტაქტო ტელეფონი</Label>
                  <Input value={editingCompany.contact_phone || ""} onChange={(e) => setEditingCompany({ ...editingCompany, contact_phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>საკონტაქტო ელ-ფოსტა</Label>
                  <Input type="email" value={editingCompany.contact_email || ""} onChange={(e) => setEditingCompany({ ...editingCompany, contact_email: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleEditCompany} className="flex-1">შენახვა</Button>
                  <Button variant="outline" onClick={() => setEditingCompany(null)}>გაუქმება</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Index;
