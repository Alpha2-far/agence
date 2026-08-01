import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DesignSystem from "@/admin/design-system/page";
import { AppShell } from "@/components/AppShell";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { hasMinimumRole, type AppRole } from "@/lib/access";
import { Agences } from "@/pages/Agences";
import { Caisse } from "@/pages/Caisse";
import { Clients } from "@/pages/Clients";
import { Colis } from "@/pages/Colis";
import { Dashboard } from "@/pages/Dashboard";
import { Employes } from "@/pages/Employes";
import { Fonctions } from "@/pages/Fonctions";
import { Login } from "@/pages/Login";
import { Parc } from "@/pages/Parc";
import { Reglements } from "@/pages/Reglements";
import { Reservations } from "@/pages/Reservations";
import { Tickets } from "@/pages/Tickets";
import { Trajets } from "@/pages/Trajets";
import { Utilisateurs } from "@/pages/Utilisateurs";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { configured, user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-page text-ink-muted">Chargement...</div>;
  if (configured && !user) return <Login />;
  return children;
}

function RequireRole({ role, children }: { role: AppRole; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !hasMinimumRole(user.type, role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/design-system" element={<RequireAuth><RequireRole role="Admin"><DesignSystem /></RequireRole></RequireAuth>} />
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="trajets" element={<RequireRole role="Admin"><Trajets /></RequireRole>} />
            <Route path="tickets" element={<RequireRole role="user"><Tickets /></RequireRole>} />
            <Route path="reservations" element={<RequireRole role="user"><Reservations /></RequireRole>} />
            <Route path="colis" element={<RequireRole role="user"><Colis /></RequireRole>} />
            <Route path="clients" element={<RequireRole role="user"><Clients /></RequireRole>} />
            <Route path="caisse" element={<RequireRole role="Admin"><Caisse /></RequireRole>} />
            <Route path="reglements" element={<RequireRole role="Admin"><Reglements /></RequireRole>} />
            <Route path="parc" element={<RequireRole role="Admin"><Parc /></RequireRole>} />
            <Route path="employes" element={<RequireRole role="Admin"><Employes /></RequireRole>} />
            <Route path="fonctions" element={<RequireRole role="SuperAdmin"><Fonctions /></RequireRole>} />
            <Route path="agences" element={<RequireRole role="SuperAdmin"><Agences /></RequireRole>} />
            <Route path="utilisateurs" element={<RequireRole role="SuperAdmin"><Utilisateurs /></RequireRole>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
