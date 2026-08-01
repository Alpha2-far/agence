import * as React from "react";
import {
  Building2,
  BusFront,
  CalendarClock,
  Clock3,
  MapPin,
  Package,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { createScopedSupabaseClient } from "@/lib/supabase";

type DashboardMetrics = {
  total_passagers: number;
  total_trajets: number;
  total_employes_actifs: number;
  total_agences: number;
  total_colis: number;
  total_reservations_actives: number;
};

type Journey = {
  id: string;
  depart: string;
  destination: string;
  date_voyage: string;
  heure_depart: string;
  statut: string;
};

const emptyMetrics: DashboardMetrics = {
  total_passagers: 0,
  total_trajets: 0,
  total_employes_actifs: 0,
  total_agences: 0,
  total_colis: 0,
  total_reservations_actives: 0,
};

const metricDefinitions = [
  { key: "total_passagers", label: "Passagers payés", icon: Users, tone: "bg-accent-faded text-accent-display" },
  { key: "total_trajets", label: "Trajets", icon: BusFront, tone: "bg-signal-faded text-signal-display" },
  { key: "total_reservations_actives", label: "Réservations actives", icon: CalendarClock, tone: "bg-accent-faded text-accent-display" },
  { key: "total_colis", label: "Colis", icon: Package, tone: "bg-signal-faded text-signal-display" },
  { key: "total_employes_actifs", label: "Employés actifs", icon: UsersRound, tone: "bg-accent-faded text-accent-display" },
  { key: "total_agences", label: "Agences", icon: Building2, tone: "bg-signal-faded text-signal-display" },
] as const;

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });

export function Dashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = React.useState(emptyMetrics);
  const [journeys, setJourneys] = React.useState<Journey[]>([]);
  const [cashBalance, setCashBalance] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!user) return;
    const currentUser = user;
    const client = createScopedSupabaseClient({ agenceId: currentUser.agence_id, role: currentUser.type });
    if (!client) {
      setError("La connexion Supabase n'est pas configurée.");
      setLoading(false);
      return;
    }

    async function loadDashboard() {
      if (!client) return;
      setLoading(true);
      setError("");
      const today = new Date().toISOString().slice(0, 10);
      let cashQuery = client.from("vue_solde_caisse").select("agence_id, solde");
      if (currentUser.agence_id) cashQuery = cashQuery.eq("agence_id", currentUser.agence_id);

      const [metricsResult, journeysResult, cashResult] = await Promise.all([
        client.from("vue_dashboard").select("*").limit(1).maybeSingle(),
        client.from("trajet").select("id, depart, destination, date_voyage, heure_depart, statut").gte("date_voyage", today).neq("statut", "Annulé").order("date_voyage").order("heure_depart").limit(5),
        cashQuery,
      ]);

      const firstError = metricsResult.error ?? journeysResult.error ?? cashResult.error;
      if (firstError) setError("Certaines données du tableau de bord n'ont pas pu être chargées.");
      if (metricsResult.data) setMetrics(metricsResult.data as DashboardMetrics);
      if (journeysResult.data) setJourneys(journeysResult.data as Journey[]);
      if (cashResult.data) setCashBalance(cashResult.data.reduce((total, row) => total + Number(row.solde ?? 0), 0));
      setLoading(false);
    }

    void loadDashboard();
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-ink-muted">{user?.agence_nom ?? "Réseau G'NANZE"}</p>
          <h1 className="mt-1">Tableau de bord</h1>
          <p className="mt-2 text-ink-muted">Suivez l'activité transport, caisse et agence en un coup d'œil.</p>
        </div>
        <Badge tone="accent">Aujourd'hui</Badge>
      </section>

      {error && <div className="rounded-lg border border-danger/40 bg-danger-faded p-4 text-sm text-danger-display">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricDefinitions.map(({ key, label, icon: Icon, tone }) => (
          <article key={key} className="rounded-xl border border-hairline bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm text-ink-muted">{label}</p><p className="mt-3 font-display text-3xl font-semibold text-ink-display">{loading ? "—" : metrics[key]}</p></div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div>
            </div>
          </article>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <section className="rounded-xl border border-hairline bg-surface p-6">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-faded text-accent-display"><BusFront className="h-5 w-5" /></div><div><h2>Prochains trajets</h2><p className="text-sm text-ink-muted">Départs planifiés pour votre périmètre.</p></div></div>
          <div className="mt-6">
            {loading ? (
              <div className="rounded-lg border border-dashed border-hairline p-10 text-center text-sm text-ink-muted">Chargement des trajets...</div>
            ) : journeys.length ? (
              <ul className="divide-y divide-hairline">
                {journeys.map((journey) => (
                  <li key={journey.id} className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-page text-accent-display"><MapPin className="h-4 w-4" /></div><div><p className="font-medium text-ink-display">{journey.depart} → {journey.destination}</p><p className="mt-1 flex items-center gap-2 text-sm text-ink-muted"><Clock3 className="h-3.5 w-3.5" />{shortDate.format(new Date(`${journey.date_voyage}T00:00:00`))} · {journey.heure_depart.slice(0, 5)}</p></div></div>
                    <Badge tone={journey.statut === "Planifié" ? "accent" : "neutral"}>{journey.statut}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-hairline px-5 py-10 text-center"><p className="font-medium text-ink-display">Aucun trajet à venir</p><p className="mt-1 text-sm text-ink-muted">Les prochains départs apparaîtront automatiquement ici.</p></div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-surface p-6">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal-faded text-signal-display"><WalletCards className="h-5 w-5" /></div><div><h2>Caisse actuelle</h2><p className="text-sm text-ink-muted">Solde des mouvements de votre périmètre.</p></div></div>
          <p className="mt-8 font-display text-4xl font-semibold text-ink-display">{loading ? "—" : currency.format(cashBalance)}</p>
          <p className="mt-2 text-sm text-ink-muted">Les règlements créditent la caisse et les maintenances avec coût la débitent automatiquement.</p>
        </section>
      </div>
    </div>
  );
}
