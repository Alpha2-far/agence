import * as React from "react";
import {
  Building2,
  BusFront,
  CalendarClock,
  ChevronLeft,
  CircleDollarSign,
  ContactRound,
  Gauge,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Search,
  ShieldCheck,
  Ticket,
  UserCog,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/context/AuthContext";
import { hasMinimumRole, type AppRole } from "@/lib/access";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  minimumRole: AppRole;
};

const navigation: { label: string; items: NavItem[] }[] = [
  {
    label: "Opérations",
    items: [
      { label: "Tableau de bord", path: "/", icon: Gauge, minimumRole: "user" },
      { label: "Tickets / Vente", path: "/tickets", icon: Ticket, minimumRole: "user" },
      { label: "Réservations", path: "/reservations", icon: CalendarClock, minimumRole: "user" },
      { label: "Colis", path: "/colis", icon: Package, minimumRole: "user" },
      { label: "Clients", path: "/clients", icon: ContactRound, minimumRole: "user" },
    ],
  },
  {
    label: "Gestion d'agence",
    items: [
      { label: "Trajets", path: "/trajets", icon: BusFront, minimumRole: "Admin" },
      { label: "Règlements", path: "/reglements", icon: ReceiptText, minimumRole: "Admin" },
      { label: "Mouvements / Caisse", path: "/caisse", icon: CircleDollarSign, minimumRole: "Admin" },
      { label: "Parc automobile", path: "/parc", icon: Wrench, minimumRole: "Admin" },
      { label: "Employés", path: "/employes", icon: UsersRound, minimumRole: "Admin" },
    ],
  },
  {
    label: "Administration globale",
    items: [
      { label: "Agences", path: "/agences", icon: Building2, minimumRole: "SuperAdmin" },
      { label: "Utilisateurs", path: "/utilisateurs", icon: UserCog, minimumRole: "SuperAdmin" },
      { label: "Fonctions", path: "/fonctions", icon: ShieldCheck, minimumRole: "SuperAdmin" },
    ],
  },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(() => window.localStorage.getItem("gnanze-sidebar-open") !== "false");
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => setMobileOpen(false), [location.pathname]);
  React.useEffect(() => window.localStorage.setItem("gnanze-sidebar-open", String(desktopOpen)), [desktopOpen]);

  if (!user) return null;

  const sidebarContent = (
    <>
      <div className="flex h-20 items-center gap-3 border-b border-hairline px-4">
        <img src="/logo.png" alt="G'NANZE" className="h-14 w-14 shrink-0 rounded-md bg-white object-contain p-1" />
        <div className={cn("min-w-0", !desktopOpen && "lg:hidden")}>
          <p className="truncate font-display text-sm font-semibold text-ink-display">G'NANZE</p>
          <p className="truncate text-xs text-ink-muted">Transport et Tourisme</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Navigation principale">
        {navigation.map((group) => {
          const items = group.items.filter((item) => hasMinimumRole(user.type, item.minimumRole));
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-6">
              <p className={cn("mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted", !desktopOpen && "lg:hidden")}>{group.label}</p>
              <ul className="space-y-1">
                {items.map(({ label, path, icon: Icon }) => (
                  <li key={path}>
                    <NavLink
                      to={path}
                      end={path === "/"}
                      title={!desktopOpen ? label : undefined}
                      className={({ isActive }) => cn(
                        "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                        isActive ? "bg-accent-faded text-accent-display" : "text-ink-body hover:bg-surface hover:text-ink-display",
                        !desktopOpen && "lg:justify-center lg:px-0",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={cn("truncate", !desktopOpen && "lg:hidden")}>{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-hairline p-3 space-y-3">
        <div className={cn("rounded-md bg-surface p-3", !desktopOpen && "lg:hidden")}>
          <p className="truncate text-sm font-medium text-ink-display">{[user.employe_prenom, user.employe_nom].filter(Boolean).join(" ") || user.nom_utilisateur}</p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{user.type} · {user.agence_nom ?? "Toutes les agences"}</p>
        </div>
        <div className={cn("px-1", !desktopOpen && "lg:hidden")}>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Thème d'affichage</p>
          <ThemeToggle block />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-page text-ink-body">
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-hairline bg-page transition-[width] duration-200 lg:flex lg:flex-col", desktopOpen ? "w-72" : "w-20")}>
        {sidebarContent}
        <button type="button" onClick={() => setDesktopOpen((open) => !open)} className="absolute -right-3 top-24 flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-page text-ink-muted shadow-sm hover:text-ink-display" aria-label={desktopOpen ? "Réduire le menu" : "Déployer le menu"}>
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !desktopOpen && "rotate-180")} />
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink-display/45" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-80 max-w-[88vw] flex-col bg-page shadow-xl">
            {sidebarContent}
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface" aria-label="Fermer"><X className="h-5 w-5" /></button>
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200 min-w-0 overflow-x-hidden", desktopOpen ? "lg:pl-72" : "lg:pl-20")}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-hairline bg-page/90 px-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button size="icon" variant="ghost" className="lg:hidden shrink-0" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></Button>
            <div className="min-w-0"><p className="truncate text-xs sm:text-sm font-medium text-ink-display">{user.agence_nom ?? "Administration globale"}</p><p className="truncate text-[10px] sm:text-xs text-ink-muted">Connecté en tant que {user.type}</p></div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSearchOpen(true)}
              className="gap-1.5 px-2.5 sm:px-3 text-xs text-ink-muted hover:text-ink-display"
              aria-label="Recherche globale"
            >
              <Search className="h-3.5 w-3.5 text-accent-display shrink-0" />
              <span className="hidden sm:inline">Recherche globale</span>
              <kbd className="hidden md:inline-block rounded bg-page px-1.5 py-0.5 text-[10px] font-mono border border-hairline">⌘K</kbd>
            </Button>
            <ThemeToggle className="hidden sm:inline-flex" />
            <Button size="sm" variant="ghost" onClick={() => void signOut()} className="px-2 sm:px-3 text-xs" title="Déconnexion">
              <LogOut className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </header>
        <main><Outlet /></main>
      </div>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
