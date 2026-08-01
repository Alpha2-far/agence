import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Filter,
  Plus,
  Printer,
  Receipt,
  Search,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { hasMinimumRole } from "@/lib/access";
import { exportCashLedgerPDF } from "@/lib/pdfExport";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type MouvementItem = {
  id: string;
  agence_id: string | null;
  type: "Crédit" | "Débit";
  libelle: string;
  credit: number;
  debit: number;
  details: string | null;
  source: "REGLEMENT" | "MAINTENANCE" | "MANUEL";
  source_id: string | null;
  date_mvt: string;
  heure_mvt: string;
  created_at?: string;
  // Joined fields
  agence?: { nom: string; ville: string } | null;
};

export type SoldeCaisse = {
  agence_id: string;
  total_credit: number;
  total_debit: number;
  solde: number;
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function Caisse() {
  const { user } = useAuth();
  const isAdmin = hasMinimumRole(user?.type ?? "user", "Admin");

  const [mouvements, setMouvements] = React.useState<MouvementItem[]>([]);
  const [solde, setSolde] = React.useState<SoldeCaisse>({
    agence_id: "",
    total_credit: 0,
    total_debit: 0,
    solde: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  // Manual Movement Modal State
  const [isManualModalOpen, setIsManualModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form fields
  const [formType, setFormType] = React.useState<"Crédit" | "Débit">("Crédit");
  const [formLibelle, setFormLibelle] = React.useState("");
  const [formMontant, setFormMontant] = React.useState<number>(10000);
  const [formDetails, setFormDetails] = React.useState("");

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
      let mvtQuery = client
        .from("mouvement")
        .select(`
          *,
          agence:agence_id(nom, ville)
        `)
        .order("created_at", { ascending: false });

      if (user.agence_id && user.type !== "SuperAdmin") {
        mvtQuery = mvtQuery.eq("agence_id", user.agence_id);
      }

      let soldeQuery = client.from("vue_solde_caisse").select("*");
      if (user.agence_id && user.type !== "SuperAdmin") {
        soldeQuery = soldeQuery.eq("agence_id", user.agence_id);
      }

      const [mvtRes, soldeRes] = await Promise.all([mvtQuery, soldeQuery]);

      if (mvtRes.error) throw mvtRes.error;
      setMouvements((mvtRes.data as unknown as MouvementItem[]) ?? []);

      if (soldeRes.data && soldeRes.data.length > 0) {
        const aggregated = (soldeRes.data as SoldeCaisse[]).reduce(
          (acc, r) => ({
            agence_id: r.agence_id,
            total_credit: acc.total_credit + Number(r.total_credit || 0),
            total_debit: acc.total_debit + Number(r.total_debit || 0),
            solde: acc.solde + Number(r.solde || 0),
          }),
          { agence_id: "", total_credit: 0, total_debit: 0, solde: 0 }
        );
        setSolde(aggregated);
      }
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger le journal de caisse.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openManualModal = () => {
    setFormLibelle("");
    setFormMontant(10000);
    setFormDetails("");
    setFormType("Crédit");
    setIsManualModalOpen(true);
  };

  const handleCreateManualMouvement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formLibelle.trim() || formMontant <= 0) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSubmitting(true);
    try {
      const payload = {
        agence_id: user.agence_id || null,
        type: formType,
        libelle: formLibelle.trim(),
        credit: formType === "Crédit" ? formMontant : 0,
        debit: formType === "Débit" ? formMontant : 0,
        details: formDetails.trim() || "Mouvement manuel d'agence",
        source: "MANUEL",
        date_mvt: new Date().toISOString().slice(0, 10),
      };

      const { error: insertErr } = await client.from("mouvement").insert(payload);
      if (insertErr) throw insertErr;

      setIsManualModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      toastError("Erreur lors de l'enregistrement du mouvement de caisse.");
    } finally {
      setSubmitting(false);
    }
  };

  // Source Icon Helper
  const getSourceIcon = (source: MouvementItem["source"]) => {
    switch (source) {
      case "REGLEMENT":
        return <Receipt className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "MAINTENANCE":
        return <Wrench className="h-4 w-4 text-signal-display" />;
      default:
        return <CircleDollarSign className="h-4 w-4 text-accent-display" />;
    }
  };

  // Filtered List
  const filteredMouvements = mouvements.filter((m) => {
    const matchesSearch =
      m.libelle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.details && m.details.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSource = sourceFilter === "all" || m.source === sourceFilter;
    const matchesType = typeFilter === "all" || m.type === typeFilter;

    let matchesDate = true;
    if (startDate && m.date_mvt < startDate) matchesDate = false;
    if (endDate && m.date_mvt > endDate) matchesDate = false;

    return matchesSearch && matchesSource && matchesType && matchesDate;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <CircleDollarSign className="h-8 w-8 text-accent-display" />
            Mouvements & Journal de Caisse
          </h1>
          <p className="mt-1 text-ink-muted">
            Suivez les entrées de caisse (règlements), sorties (maintenances) et opérations manuelle de votre périmètre.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => {
              exportCashLedgerPDF({
                agenceNom: user?.agence_id ? "Agence Régionale" : "Réseau Global",
                solde,
                mouvements: filteredMouvements,
              });
            }}
          >
            <Printer className="h-4 w-4 text-accent-display" />
            Exporter Rapport (PDF)
          </Button>
          {isAdmin && (
            <Button onClick={openManualModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
              <Plus className="h-4 w-4" />
              Opération Manuelle
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger-faded p-4 text-sm text-danger-display">
          {error}
        </div>
      )}

      {/* Cash Summary Banner */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-hairline bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted uppercase font-semibold">Crédits Totaux (Encaissements)</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-faded text-accent-display">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-display text-2xl font-bold text-accent-display">
            {loading ? "—" : currencyFormatter.format(solde.total_credit)}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted uppercase font-semibold">Débits Totaux (Décaissements)</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-faded text-signal-display">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-display text-2xl font-bold text-signal-display">
            {loading ? "—" : currencyFormatter.format(solde.total_debit)}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted uppercase font-semibold">Solde Net de Caisse</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-page text-ink-display border border-hairline">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-display text-3xl font-bold text-ink-display">
            {loading ? "—" : currencyFormatter.format(solde.solde)}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            placeholder="Rechercher libellé, détails d'opération..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-ink-muted" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
            >
              <option value="all">Toutes les origines</option>
              <option value="REGLEMENT">Règlements Tickets</option>
              <option value="MAINTENANCE">Maintenances Parc</option>
              <option value="MANUEL">Opérations Manuelles</option>
            </select>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
          >
            <option value="all">Tous les types</option>
            <option value="Crédit">Crédits (+)</option>
            <option value="Débit">Débits (-)</option>
          </select>

          <Input
            type="date"
            placeholder="Date début"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto"
          />
          <Input
            type="date"
            placeholder="Date fin"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      {/* Mouvements Table */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement du journal de caisse...
        </div>
      ) : filteredMouvements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <CircleDollarSign className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun mouvement de caisse trouvé</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Les encaissements de tickets et dépenses de maintenance alimenteront ce journal.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-page/50 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-6 py-3">Origine</th>
                  <th className="px-6 py-3">Date & Heure</th>
                  <th className="px-6 py-3">Libellé Mouvement</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3 text-right">Crédit (+)</th>
                  <th className="px-6 py-3 text-right">Débit (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink-display">
                {filteredMouvements.map((mvt) => (
                  <tr key={mvt.id} className="hover:bg-page/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(mvt.source)}
                        <Badge tone="neutral">{mvt.source}</Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-ink-muted">
                      <div>{mvt.date_mvt}</div>
                      {mvt.heure_mvt && <div className="text-xs">{mvt.heure_mvt.slice(0, 5)}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-ink-display">{mvt.libelle}</div>
                      {mvt.details && <div className="text-xs text-ink-muted">{mvt.details}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge tone={mvt.type === "Crédit" ? "accent" : "signal"}>
                        {mvt.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-accent-display whitespace-nowrap">
                      {mvt.credit > 0 ? `+${currencyFormatter.format(mvt.credit)}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-signal-display whitespace-nowrap">
                      {mvt.debit > 0 ? `-${currencyFormatter.format(mvt.debit)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Movement Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <CircleDollarSign className="h-5 w-5 text-accent-display" />
                <h3 className="font-semibold text-lg">Opération Manuelle de Caisse</h3>
              </div>
              <button onClick={() => setIsManualModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualMouvement} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="mvt_type">Type de Mouvement</Label>
                <select
                  id="mvt_type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as "Crédit" | "Débit")}
                  className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                >
                  <option value="Crédit">Crédit (+ Entrée en Caisse)</option>
                  <option value="Débit">Débit (- Sortie de Caisse)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="mvt_libelle">Libellé de l'Opération *</Label>
                <Input
                  id="mvt_libelle"
                  placeholder="ex. Fond de caisse initial, petite fourniture agence..."
                  value={formLibelle}
                  onChange={(e) => setFormLibelle(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="mvt_montant">Montant (XOF) *</Label>
                <Input
                  id="mvt_montant"
                  type="number"
                  value={formMontant}
                  onChange={(e) => setFormMontant(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="mvt_details">Détails / Motifs</Label>
                <Input
                  id="mvt_details"
                  placeholder="ex. Justificatif ou note de frais..."
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsManualModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting} className="bg-accent text-accent-ink hover:opacity-90">
                  {submitting ? "Enregistrement..." : "Enregistrer le mouvement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
