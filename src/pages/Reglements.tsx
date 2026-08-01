import * as React from "react";
import { BusFront, Calendar, Filter, ReceiptText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type ReglementItem = {
  id: string;
  facture_id: string;
  montant: number;
  date_reglement: string;
  heure_reglement: string;
  created_at?: string;
  // Joined fields
  facture?: {
    numero_facture: string;
    nom_client: string;
    etat: string;
    trajet?: {
      depart: string;
      destination: string;
      date_voyage: string;
    } | null;
  } | null;
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function Reglements() {
  const { user } = useAuth();

  const [reglements, setReglements] = React.useState<ReglementItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<string>("");

  const loadData = React.useCallback(async () => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) {
      setError("La connexion Supabase n'est pas configurée.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: queryErr } = await client
        .from("reglement")
        .select(`
          *,
          facture:facture_id(
            numero_facture,
            nom_client,
            etat,
            trajet:trajet_id(depart, destination, date_voyage)
          )
        `)
        .order("created_at", { ascending: false });

      if (queryErr) throw queryErr;
      setReglements((data as unknown as ReglementItem[]) ?? []);
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger le journal des règlements.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtered List
  const filteredReglements = reglements.filter((r) => {
    const ticketNo = r.facture?.numero_facture?.toLowerCase() ?? "";
    const clientName = r.facture?.nom_client?.toLowerCase() ?? "";
    const matchesSearch =
      ticketNo.includes(searchQuery.toLowerCase()) ||
      clientName.includes(searchQuery.toLowerCase());

    const matchesDate = !dateFilter || r.date_reglement === dateFilter;

    return matchesSearch && matchesDate;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <ReceiptText className="h-8 w-8 text-accent-display" />
            Historique des Règlements
          </h1>
          <p className="mt-1 text-ink-muted">
            Journal d'audit des encaissements reçus pour la billetterie et facturation.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger-faded p-4 text-sm text-danger-display">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            placeholder="Rechercher numéro ticket TKT-, nom du passager..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-ink-muted" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-auto"
          />
          {dateFilter && (
            <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>
              Effacer date
            </Button>
          )}
        </div>
      </div>

      {/* Reglements Table */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des règlements...
        </div>
      ) : filteredReglements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <ReceiptText className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun règlement trouvé</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Les paiements de tickets validés en caisse apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-page/50 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-6 py-3">Date & Heure</th>
                  <th className="px-6 py-3">N° Billet / Facture</th>
                  <th className="px-6 py-3">Passager</th>
                  <th className="px-6 py-3">Trajet</th>
                  <th className="px-6 py-3">Montant Encaissé</th>
                  <th className="px-6 py-3">Statut Facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink-display">
                {filteredReglements.map((r) => (
                  <tr key={r.id} className="hover:bg-page/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-ink-muted">
                      <div className="flex items-center gap-1.5 font-medium text-ink-display">
                        <Calendar className="h-3.5 w-3.5 text-accent-display" />
                        {r.date_reglement}
                      </div>
                      {r.heure_reglement && <div className="text-xs">{r.heure_reglement.slice(0, 5)}</div>}
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-accent-display whitespace-nowrap">
                      {r.facture?.numero_facture ?? "TKT-—"}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {r.facture?.nom_client ?? "Client Comptant"}
                    </td>
                    <td className="px-6 py-4 text-ink-muted">
                      {r.facture?.trajet ? (
                        <div className="flex items-center gap-1">
                          <BusFront className="h-3.5 w-3.5 text-ink-muted" />
                          {r.facture.trajet.depart} → {r.facture.trajet.destination}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-accent-display whitespace-nowrap">
                      {currencyFormatter.format(r.montant)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge tone="accent">
                        {r.facture?.etat ?? "Payé"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
