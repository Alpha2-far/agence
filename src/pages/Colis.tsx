import * as React from "react";
import {
  ArrowRight,
  Building2,
  BusFront,
  Filter,
  Package,
  Phone,
  Plus,
  Printer,
  Search,
  Send,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { exportParcelsManifestPDF } from "@/lib/pdfExport";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type ColisItem = {
  id: string;
  numero: string;
  trajet_id: string | null;
  agence_depart_id: string | null;
  agence_arrivee_id: string | null;
  envoyeur: string;
  receveur: string;
  telephone_envoyeur: string | null;
  telephone_receveur: string | null;
  contenu: string | null;
  statut: "En Attente" | "Assigné" | "En Transit" | "Livré" | "Retourné";
  priorite: 1 | 2 | 3; // 1=Normal, 2=Urgent, 3=Express
  created_at?: string;
  // Joined fields
  agence_depart?: { nom: string; ville: string } | null;
  agence_arrivee?: { nom: string; ville: string } | null;
  trajet?: {
    depart: string;
    destination: string;
    date_voyage: string;
    heure_depart: string;
  } | null;
};

type AgencyOption = {
  id: string;
  nom: string;
  ville: string;
};

type JourneyOption = {
  id: string;
  depart: string;
  destination: string;
  date_voyage: string;
  heure_depart: string;
};

export function Colis() {
  const { user } = useAuth();

  const [colisList, setColisList] = React.useState<ColisItem[]>([]);
  const [agencies, setAgencies] = React.useState<AgencyOption[]>([]);
  const [activeJourneys, setActiveJourneys] = React.useState<JourneyOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Assign Journey Modal State
  const [assigningColis, setAssigningColis] = React.useState<ColisItem | null>(null);
  const [selectedTrajetId, setSelectedTrajetId] = React.useState("");

  // Printable Deposit Receipt Modal
  const [receiptColis, setReceiptColis] = React.useState<ColisItem | null>(null);

  // Form input fields
  const [envoyeurNom, setEnvoyeurNom] = React.useState("");
  const [envoyeurTel, setEnvoyeurTel] = React.useState("");
  const [receveurNom, setReceveurNom] = React.useState("");
  const [receveurTel, setReceveurTel] = React.useState("");
  const [agenceDepartId, setAgenceDepartId] = React.useState("");
  const [agenceArriveeId, setAgenceArriveeId] = React.useState("");
  const [contenuColis, setContenuColis] = React.useState("");
  const [prioriteColis, setPrioriteColis] = React.useState<1 | 2 | 3>(1);

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
      let query = client
        .from("colis")
        .select(`
          *,
          agence_depart:agence!agence_depart_id(nom, ville),
          agence_arrivee:agence!agence_arrivee_id(nom, ville),
          trajet:trajet_id(depart, destination, date_voyage, heure_depart)
        `)
        .order("created_at", { ascending: false });

      if (user.agence_id && user.type !== "SuperAdmin") {
        query = query.or(`agence_depart_id.eq.${user.agence_id},agence_arrivee_id.eq.${user.agence_id}`);
      }

      const today = new Date().toISOString().slice(0, 10);
      let journeysQuery = client
        .from("trajet")
        .select("id, depart, destination, date_voyage, heure_depart")
        .gte("date_voyage", today)
        .neq("statut", "Annulé")
        .order("date_voyage", { ascending: true })
        .order("heure_depart", { ascending: true });

      if (user.agence_id && user.type !== "SuperAdmin") {
        journeysQuery = journeysQuery.eq("agence_id", user.agence_id);
      }

      const [colisRes, agencesRes, journeysRes] = await Promise.all([
        query,
        client.from("agence").select("id, nom, ville").order("nom"),
        journeysQuery,
      ]);

      if (colisRes.error) throw colisRes.error;
      setColisList((colisRes.data as unknown as ColisItem[]) ?? []);

      if (agencesRes.data) {
        const agencyList = agencesRes.data as AgencyOption[];
        setAgencies(agencyList);
        if (agencyList.length > 0 && !agenceDepartId) {
          setAgenceDepartId(user.agence_id || agencyList[0].id);
          const arrival = agencyList.find((a) => a.id !== (user.agence_id || agencyList[0].id));
          setAgenceArriveeId(arrival?.id || agencyList[0].id);
        }
      }

      if (journeysRes.data) {
        setActiveJourneys(journeysRes.data as JourneyOption[]);
      }
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger les colis.");
    } finally {
      setLoading(false);
    }
  }, [user, agenceDepartId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEnvoyeurNom("");
    setEnvoyeurTel("");
    setReceveurNom("");
    setReceveurTel("");
    setContenuColis("");
    setPrioriteColis(1);

    if (agencies.length > 0) {
      const defaultDep = user?.agence_id || agencies[0].id;
      setAgenceDepartId(defaultDep);
      const defaultArr = agencies.find((a) => a.id !== defaultDep);
      setAgenceArriveeId(defaultArr?.id || agencies[0].id);
    }
    setIsCreateModalOpen(true);
  };

  const handleCreateColis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !envoyeurNom.trim() || !receveurNom.trim()) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSubmitting(true);
    try {
      const payload = {
        envoyeur: envoyeurNom.trim(),
        telephone_envoyeur: envoyeurTel.trim() || null,
        receveur: receveurNom.trim(),
        telephone_receveur: receveurTel.trim() || null,
        agence_depart_id: agenceDepartId || user.agence_id || null,
        agence_arrivee_id: agenceArriveeId || null,
        contenu: contenuColis.trim() || "Colis standard",
        priorite: prioriteColis,
        statut: "En Attente",
      };

      const { data: inserted, error: insertErr } = await client
        .from("colis")
        .insert(payload)
        .select("*")
        .single();

      if (insertErr) throw insertErr;

      setIsCreateModalOpen(false);
      await loadData();

      if (inserted) {
        setReceiptColis(inserted as ColisItem);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du colis.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignModal = (colis: ColisItem) => {
    setAssigningColis(colis);
    if (activeJourneys.length > 0) {
      setSelectedTrajetId(activeJourneys[0].id);
    }
  };

  const handleAssignJourney = async () => {
    if (!user || !assigningColis || !selectedTrajetId) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: updateErr } = await client
        .from("colis")
        .update({
          trajet_id: selectedTrajetId,
          statut: "Assigné",
        })
        .eq("id", assigningColis.id);

      if (updateErr) throw updateErr;

      setAssigningColis(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'assignation du colis au trajet.");
    }
  };

  const handleUpdateStatus = async (colisId: string, newStatut: ColisItem["statut"]) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: updateErr } = await client
        .from("colis")
        .update({ statut: newStatut })
        .eq("id", colisId);

      if (updateErr) throw updateErr;
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du changement de statut du colis.");
    }
  };

  // Priority Label Helper
  const getPriorityBadge = (p: 1 | 2 | 3) => {
    switch (p) {
      case 3:
        return <Badge tone="accent">Express</Badge>;
      case 2:
        return <Badge tone="signal">Urgent</Badge>;
      default:
        return <Badge tone="neutral">Normal</Badge>;
    }
  };

  // Filtered List
  const filteredColis = colisList.filter((c) => {
    const matchesSearch =
      c.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.envoyeur.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.receveur.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.telephone_envoyeur && c.telephone_envoyeur.includes(searchQuery)) ||
      (c.telephone_receveur && c.telephone_receveur.includes(searchQuery));

    const matchesStatus = statusFilter === "all" || c.statut === statusFilter;
    const matchesPriority = priorityFilter === "all" || c.priorite === Number(priorityFilter);

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <Package className="h-8 w-8 text-accent-display" />
            Gestion des Colis & Bagages
          </h1>
          <p className="mt-1 text-ink-muted">
            Enregistrez les dépôts de colis (`COL-XXXX`), assignez-les aux bus et suivez l'acheminement jusqu'à la livraison.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => {
              exportParcelsManifestPDF({
                trajet: {
                  depart: "Agence Départ",
                  destination: "Agence Arrivée",
                  date_voyage: new Date().toLocaleDateString("fr-FR"),
                },
                parcels: filteredColis.map((c) => ({
                  code_suivi: c.numero,
                  expediteur_nom: c.envoyeur,
                  expediteur_tel: c.telephone_envoyeur || "—",
                  destinataire_nom: c.receveur,
                  destinataire_tel: c.telephone_receveur || "—",
                  description: c.contenu || "Colis standard",
                  priorite: c.priorite === 3 ? "Express" : c.priorite === 2 ? "Urgent" : "Normal",
                  etat: c.statut,
                })),
                agenceNom: user?.agence_id ? "Agence Régionale" : "Réseau Global",
              });
            }}
          >
            <Printer className="h-4 w-4 text-accent-display" />
            Exporter Bordereau (PDF)
          </Button>
          <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
            <Plus className="h-4 w-4" />
            Enregistrer un Colis
          </Button>
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
            placeholder="Rechercher numéro COL-, expéditeur, destinataire, téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-ink-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
            >
              <option value="all">Tous les statuts</option>
              <option value="En Attente">En Attente</option>
              <option value="Assigné">Assignés</option>
              <option value="En Transit">En Transit</option>
              <option value="Livré">Livrés</option>
              <option value="Retourné">Retournés</option>
            </select>
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
          >
            <option value="all">Toutes les priorités</option>
            <option value="1">Normal</option>
            <option value="2">Urgent</option>
            <option value="3">Express</option>
          </select>
        </div>
      </div>

      {/* Colis Grid / List */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des colis...
        </div>
      ) : filteredColis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun colis trouvé</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Enregistrez un dépôt de colis pour commencer le suivi d'expédition.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredColis.map((colis) => (
            <article
              key={colis.id}
              className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-6 shadow-sm hover:border-accent-display/40 transition-colors"
            >
              <div>
                {/* Header: Number & Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-base text-accent-display tracking-wide">
                    {colis.numero}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getPriorityBadge(colis.priorite)}
                    <Badge
                      tone={
                        colis.statut === "Livré"
                          ? "accent"
                          : colis.statut === "En Transit"
                          ? "accent"
                          : colis.statut === "Assigné"
                          ? "neutral"
                          : colis.statut === "En Attente"
                          ? "neutral"
                          : "signal"
                      }
                    >
                      {colis.statut}
                    </Badge>
                  </div>
                </div>

                {/* Route Agencies */}
                <div className="mt-4 flex items-center justify-between rounded-lg bg-page p-3 border border-hairline text-xs">
                  <div className="flex items-center gap-1 text-ink-display font-medium">
                    <Building2 className="h-3.5 w-3.5 text-accent-display" />
                    {colis.agence_depart?.ville ?? "Départ"}
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-muted" />
                  <div className="flex items-center gap-1 text-ink-display font-medium">
                    <Building2 className="h-3.5 w-3.5 text-accent-display" />
                    {colis.agence_arrivee?.ville ?? "Arrivée"}
                  </div>
                </div>

                {/* People details */}
                <div className="mt-4 space-y-2 text-sm text-ink-muted">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-ink-muted">Expéditeur:</span>
                    <div className="text-right">
                      <p className="font-medium text-ink-display">{colis.envoyeur}</p>
                      {colis.telephone_envoyeur && (
                        <p className="text-xs flex items-center justify-end gap-1 text-ink-muted">
                          <Phone className="h-3 w-3" /> {colis.telephone_envoyeur}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="text-xs text-ink-muted">Destinataire:</span>
                    <div className="text-right">
                      <p className="font-medium text-ink-display">{colis.receveur}</p>
                      {colis.telephone_receveur && (
                        <p className="text-xs flex items-center justify-end gap-1 text-ink-muted">
                          <Phone className="h-3 w-3" /> {colis.telephone_receveur}
                        </p>
                      )}
                    </div>
                  </div>

                  {colis.contenu && (
                    <div className="pt-2 border-t border-hairline text-xs text-ink-muted">
                      Contenu: <span className="italic text-ink-display">{colis.contenu}</span>
                    </div>
                  )}

                  {/* Assigned journey info */}
                  {colis.trajet && (
                    <div className="mt-2 text-xs text-accent-display font-medium flex items-center gap-1">
                      <BusFront className="h-3.5 w-3.5" />
                      Trajet: {colis.trajet.depart} → {colis.trajet.destination} ({colis.trajet.date_voyage})
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-6 pt-4 border-t border-hairline flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => setReceiptColis(colis)}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Récépissé
                  </Button>

                  {colis.statut === "En Attente" && (
                    <Button
                      size="sm"
                      onClick={() => openAssignModal(colis)}
                      className="gap-1 bg-accent text-accent-ink hover:opacity-90"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Assigner Bus
                    </Button>
                  )}
                </div>

                {/* Status Transitions */}
                <div className="flex items-center justify-between text-xs pt-1">
                  {colis.statut === "Assigné" && (
                    <button
                      onClick={() => handleUpdateStatus(colis.id, "En Transit")}
                      className="text-accent-display font-medium hover:underline"
                    >
                      Marquer En Transit ➔
                    </button>
                  )}
                  {colis.statut === "En Transit" && (
                    <button
                      onClick={() => handleUpdateStatus(colis.id, "Livré")}
                      className="text-green-600 dark:text-green-400 font-medium hover:underline"
                    >
                      Confirmer Livraison ✔
                    </button>
                  )}
                  {colis.statut !== "Livré" && colis.statut !== "Retourné" && (
                    <button
                      onClick={() => handleUpdateStatus(colis.id, "Retourné")}
                      className="text-danger hover:underline ml-auto"
                    >
                      Retourner
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Register Parcel Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <Package className="h-5 w-5 text-accent-display" />
                <h3 className="font-semibold text-lg">Enregistrer un Colis / Bagage</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateColis} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="env_nom">Nom Expéditeur *</Label>
                  <Input
                    id="env_nom"
                    placeholder="ex. Koffi Jean"
                    value={envoyeurNom}
                    onChange={(e) => setEnvoyeurNom(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="env_tel">Téléphone Expéditeur</Label>
                  <Input
                    id="env_tel"
                    placeholder="ex. +229 97 00 11 22"
                    value={envoyeurTel}
                    onChange={(e) => setEnvoyeurTel(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rec_nom">Nom Destinataire *</Label>
                  <Input
                    id="rec_nom"
                    placeholder="ex. Toko Alice"
                    value={receveurNom}
                    onChange={(e) => setReceveurNom(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="rec_tel">Téléphone Destinataire</Label>
                  <Input
                    id="rec_tel"
                    placeholder="ex. +229 95 33 44 55"
                    value={receveurTel}
                    onChange={(e) => setReceveurTel(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ag_dep">Agence Départ</Label>
                  <select
                    id="ag_dep"
                    value={agenceDepartId}
                    onChange={(e) => setAgenceDepartId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nom} ({a.ville})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="ag_arr">Agence Arrivée</Label>
                  <select
                    id="ag_arr"
                    value={agenceArriveeId}
                    onChange={(e) => setAgenceArriveeId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nom} ({a.ville})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="contenu">Description du Contenu</Label>
                <Input
                  id="contenu"
                  placeholder="ex. Carton d'effets personnels, documents..."
                  value={contenuColis}
                  onChange={(e) => setContenuColis(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="priorite">Niveau de Priorité</Label>
                <select
                  id="priorite"
                  value={prioriteColis}
                  onChange={(e) => setPrioriteColis(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                >
                  <option value={1}>1 - Normal</option>
                  <option value={2}>2 - Urgent</option>
                  <option value={3}>3 - Express</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting} className="bg-accent text-accent-ink hover:opacity-90">
                  {submitting ? "Enregistrement..." : "Valider le Dépôt"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Parcel to Journey Modal */}
      {assigningColis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <BusFront className="h-5 w-5 text-accent-display" />
                <h3 className="font-semibold text-lg">Assigner au Trajet</h3>
              </div>
              <button onClick={() => setAssigningColis(null)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <p>
                Colis N° <strong className="text-accent-display">{assigningColis.numero}</strong> ({assigningColis.envoyeur} → {assigningColis.receveur})
              </p>

              <div>
                <Label htmlFor="journey_select">Choisir un bus en départ</Label>
                {activeJourneys.length === 0 ? (
                  <p className="text-xs text-danger">Aucun trajet à venir disponible.</p>
                ) : (
                  <select
                    id="journey_select"
                    value={selectedTrajetId}
                    onChange={(e) => setSelectedTrajetId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    {activeJourneys.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.depart} → {j.destination} ({j.date_voyage} à {j.heure_depart.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" onClick={() => setAssigningColis(null)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleAssignJourney}
                  disabled={activeJourneys.length === 0}
                  className="bg-accent text-accent-ink hover:opacity-90"
                >
                  Confirmer l'assignation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Receipt Modal */}
      {receiptColis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h3 className="font-semibold text-lg text-ink-display">Récépissé Colis</h3>
              <button onClick={() => setReceiptColis(null)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-page font-mono text-xs text-ink-display border border-hairline space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-hairline">
                <p className="font-bold text-sm">G'NANZE TRANSPORT</p>
                <p className="text-[10px] text-ink-muted">RÉCÉPISSÉ DE DÉPÔT COLIS</p>
              </div>

              <div className="text-center font-bold text-base text-accent-display py-1">
                {receiptColis.numero}
              </div>

              <div className="space-y-1 text-ink-muted border-b border-dashed border-hairline pb-2">
                <p>Expéditeur: <strong className="text-ink-display">{receiptColis.envoyeur}</strong></p>
                {receiptColis.telephone_envoyeur && <p>Tél: {receiptColis.telephone_envoyeur}</p>}
                <p>Destinataire: <strong className="text-ink-display">{receiptColis.receveur}</strong></p>
                {receiptColis.telephone_receveur && <p>Tél: {receiptColis.telephone_receveur}</p>}
              </div>

              <div className="space-y-1 text-ink-muted pt-1">
                <p>Contenu: {receiptColis.contenu ?? "Colis"}</p>
                <p>Priorité: {receiptColis.priorite === 3 ? "Express" : receiptColis.priorite === 2 ? "Urgent" : "Normal"}</p>
                <p>Date: {new Date().toLocaleDateString("fr-FR")}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setReceiptColis(null)}>
                Fermer
              </Button>
              <Button onClick={() => window.print()} className="gap-2 bg-accent text-accent-ink">
                <Printer className="h-4 w-4" />
                Imprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
