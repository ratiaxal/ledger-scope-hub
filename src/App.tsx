import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Finance from "./pages/Finance";
import OverallFinance from "./pages/OverallFinance";
import SoldProducts from "./pages/SoldProducts";
import Orders from "./pages/Orders";
import AllOrders from "./pages/AllOrders";
import Warehouse from "./pages/Warehouse";
import WarehouseFinance from "./pages/WarehouseFinance";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Index />} />
            <Route path="/overall-finance" element={<OverallFinance />} />
            <Route path="/sold-products" element={<SoldProducts />} />
            <Route path="/finance/:companyId" element={<Finance />} />
            <Route path="/orders/:companyId" element={<Orders />} />
            <Route path="/all-orders" element={<AllOrders />} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/warehouse-finance/:warehouseId" element={<WarehouseFinance />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
