import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NewRun from "./pages/NewRun";
import RunsList from "./pages/RunsList";
import RunDetails from "./pages/RunDetails";
import Documentation from "./pages/Documentation";
import UnitEconomics from "./pages/UnitEconomics";
import UnitEconomicsDetail from "./pages/UnitEconomicsDetail";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/docs" element={<Documentation />} />
            <Route
              path="/new"
              element={
                <ProtectedRoute>
                  <NewRun />
                </ProtectedRoute>
              }
            />
            <Route
              path="/runs"
              element={
                <ProtectedRoute>
                  <RunsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/runs/:id"
              element={
                <ProtectedRoute>
                  <RunDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/unit-economics"
              element={
                <ProtectedRoute>
                  <UnitEconomics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/unit-economics/:article"
              element={
                <ProtectedRoute>
                  <UnitEconomicsDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
