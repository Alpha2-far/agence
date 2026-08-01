import * as React from "react";
import {
  Building2,
  Calendar,
  Clock,
  Edit2,
  Filter,
  History,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { hasMinimumRole } from "@/lib/access";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type VehicleItem = {
  id: string;
  immatriculation: string;
  type: string | null;
  marque: string | null;
  capacite: number;
  etat: "Disponible" | "En Service" | "En Maintenance" | "Hors Service";
  agence_id: string | null;
  created_at?: string;
  // Joined fields
  agence?: { nom: string; ville: string } | null;
};

export type MaintenanceItem = {
  id: string;
  vehicule_id: string;
  type_maintenance: string;
  description: string | null;
  cout: number | null;
  agence_id: string | null;
  date_maintenance: string;
  heure_maintenance: string;
  created_at?: string;
};

type AgencyOption = {
  id: string;
  nom: string;
  ville: string;
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function Parc() {
  const { user } = useAuth();
  const isAdmin = hasMinimumRole(user?.type ?? "user", "Admin");

  const [vehicles, setVehicles] = React.useState<VehicleItem[]>([]);
  const [agencies, setAgencies] = React.useState<AgencyOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [stateFilter, setStateFilter] = React.useState<string>("all");

  // Create/Edit Vehicle Modal State
  const [isVehicleModalOpen, setIsVehicleModalOpen] = React.useState(false);
  const [editingVehicle, setEditingVehicle] = React.useState<VehicleItem | null>(null);

  // Maintenance Modal State
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = React.useState(false);
  const [targetVehicleForMaint, setTargetVehicleForMaint] = React.useState<VehicleItem | null>(null);

  // Maintenance History Drawer State
  const [historyVehicle, setHistoryVehicle] = React.useState<VehicleItem | null>(null);
  const [historyLogs, setHistoryLogs] = React.useState<MaintenanceItem[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  // Form Fields - Vehicle
  const [formImmatriculation, setFormImmatriculation] = React.useState("");
  const [formMarque, setFormMarque] = React.useState("Toyota Coaster");
  const [formTypeBus, setFormTypeBus] = React.useState("Minibus");
  const [formCapacite, setFormCapacite] = React.useState<number>(15);
  const [formAgenceId, setFormAgenceId] = React.useState("");
  const [formEtat, setFormEtat] = React.useState<VehicleItem["etat"]>("Disponible");

  // Form Fields - Maintenance
  const [maintType, setMaintType] = React.useState("Vidange & Révision");
  const [maintDescription, setMaintDescription] = React.useState("");
  const [maintCout, setMaintCout] = React.useState<number>(25000);
  const [maintDate, setMaintDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = React.useState(false);

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
        .from("vehicule")
        .select(`
          *,
          agence:agence_id(nom, ville)
        `)
        .order("immatriculation");

      if (user.agence_id && user.type !== "SuperAdmin") {
        query = query.eq("agence_id", user.agence_id);
      }

      const [vehRes, agRes] = await Promise.all([
        query,
        client.from("agence").select("id, nom, ville").order("nom"),
      ]);

      if (vehRes.error) throw vehRes.error;
      setVehicles((vehRes.data as unknown as VehicleItem[]) ?? []);

      if (agRes.data) {
        setAgencies(agRes.data as AgencyOption[]);
      }
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger les véhicules du parc.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateVehicleModal = () => {
    setEditingVehicle(null);
    setFormImmatriculation("");
    setFormMarque("Toyota Coaster");
    setFormTypeBus("Minibus");
    setFormCapacite(15);
    setFormAgenceId(user?.agence_id || (agencies[0]?.id ?? ""));
    setFormEtat("Disponible");
    setIsVehicleModalOpen(true);
  };

  const openEditVehicleModal = (veh: VehicleItem) => {
    setEditingVehicle(veh);
    setFormImmatriculation(veh.immatriculation);
    setFormMarque(veh.marque || "");
    setFormTypeBus(veh.type || "");
    setFormCapacite(veh.capacite);
    setFormAgenceId(veh.agence_id || "");
    setFormEtat(veh.etat);
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formImmatriculation.trim()) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const payload = {
        immatriculation: formImmatriculation.trim().toUpperCase(),
        marque: formMarque.trim() || null,
        type: formTypeBus.trim() || null,
        capacite: formCapacite,
        agence_id: formAgenceId || user.agence_id || null,
        etat: formEtat,
      };

      if (editingVehicle) {
        const { error: updateErr } = await client
          .from("vehicule")
          .update(payload)
          .eq("id", editingVehicle.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await client.from("vehicule").insert(payload);
        if (insertErr) throw insertErr;
      }

      setIsVehicleModalOpen(false);
      toastSuccess(editingVehicle ? "Véhicule mis à jour." : "Véhicule enregistré avec succès.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur enregistrement véhicule : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  const handleDeleteVehicle = async (veh: VehicleItem) => {
    if (!user) return;
    if (!confirm(`Voulez-vous vraiment supprimer le bus "${veh.immatriculation}" (${veh.marque}) ?`)) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: delErr } = await client.from("vehicule").delete().eq("id", veh.id);
      if (delErr) throw delErr;
      toastSuccess("Véhicule supprimé.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur suppression véhicule : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  const openMaintenanceModal = (veh: VehicleItem) => {
    setTargetVehicleForMaint(veh);
    setMaintType("Vidange & Filtres");
    setMaintDescription("");
    setMaintCout(25000);
    setMaintDate(new Date().toISOString().slice(0, 10));
    setIsMaintenanceModalOpen(true);
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !targetVehicleForMaint) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSubmitting(true);
    try {
      const payload = {
        vehicule_id: targetVehicleForMaint.id,
        type_maintenance: maintType,
        description: maintDescription.trim() || null,
        cout: maintCout,
        agence_id: targetVehicleForMaint.agence_id || user.agence_id || null,
        date_maintenance: maintDate,
      };

      // 1. Insert Maintenance record (trigger maintenance_to_mouvement automatically posts cash debit)
      const { error: maintErr } = await client.from("maintenance").insert(payload);
      if (maintErr) throw maintErr;

      // 2. Update vehicle state to 'En Maintenance'
      await client.from("vehicule").update({ etat: "En Maintenance" }).eq("id", targetVehicleForMaint.id);

      setIsMaintenanceModalOpen(false);
      toastSuccess("Maintenance enregistrée avec succès.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur enregistrement maintenance : ${err?.message || err?.details || "Échec de l'opération."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openHistoryDrawer = async (veh: VehicleItem) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setHistoryVehicle(veh);
    setHistoryLoading(true);

    try {
      const { data, error: histErr } = await client
        .from("maintenance")
        .select("*")
        .eq("vehicule_id", veh.id)
        .order("date_maintenance", { ascending: false });

      if (histErr) throw histErr;
      setHistoryLogs((data as MaintenanceItem[]) ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleQuickStateChange = async (vehId: string, newEtat: VehicleItem["etat"]) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: updateErr } = await client
        .from("vehicule")
        .update({ etat: newEtat })
        .eq("id", vehId);
      if (updateErr) throw updateErr;
      toastSuccess("État du véhicule mis à jour.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur changement état : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  // Filtered List
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.immatriculation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.marque && v.marque.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.type && v.type.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesState = stateFilter === "all" || v.etat === stateFilter;

    return matchesSearch && matchesState;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <Wrench className="h-8 w-8 text-accent-display" />
            Gestion du Parc & Maintenances
          </h1>
          <p className="mt-1 text-ink-muted">
            Gérez la flotte de bus, leur disponibilité et enregistrez les travaux de maintenance avec suivi comptable automatique.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateVehicleModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
            <Plus className="h-4 w-4" />
            Nouveau Véhicule
          </Button>
        )}
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
            placeholder="Rechercher immatriculation, marque, type de bus..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-ink-muted" />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
          >
            <option value="all">Tous les états</option>
            <option value="Disponible">Disponible</option>
            <option value="En Service">En Service</option>
            <option value="En Maintenance">En Maintenance</option>
            <option value="Hors Service">Hors Service</option>
          </select>
        </div>
      </div>

      {/* Vehicle Grid */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des véhicules...
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <Wrench className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun véhicule trouvé</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Ajoutez un bus pour enregistrer le premier véhicule du parc.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((veh) => (
            <article
              key={veh.id}
              className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-6 shadow-sm hover:border-accent-display/40 transition-colors"
            >
              <div>
                {/* Header: Immat & State */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-lg text-ink-display tracking-wider">
                    {veh.immatriculation}
                  </span>
                  <Badge
                    tone={
                      veh.etat === "Disponible"
                        ? "accent"
                        : veh.etat === "En Service"
                        ? "accent"
                        : veh.etat === "En Maintenance"
                        ? "signal"
                        : "muted"
                    }
                  >
                    {veh.etat}
                  </Badge>
                </div>

                {/* Bus Description */}
                <div className="mt-4 space-y-1">
                  <h3 className="font-semibold text-lg text-ink-display">
                    {veh.marque || "Bus G'NANZE"}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {veh.type || "Minibus"} · Capacité: <strong className="text-ink-display">{veh.capacite} places</strong>
                  </p>
                  <p className="text-xs text-ink-muted flex items-center gap-1 pt-1">
                    <Building2 className="h-3.5 w-3.5 text-accent-display" />
                    {veh.agence?.nom ?? "Agence Régionale"}
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-6 pt-4 border-t border-hairline flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => openHistoryDrawer(veh)}
                  >
                    <History className="h-3.5 w-3.5" />
                    Historique
                  </Button>

                  {isAdmin && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1 text-signal-display"
                      onClick={() => openMaintenanceModal(veh)}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Maintenance
                    </Button>
                  )}

                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditVehicleModal(veh)}
                        title="Modifier bus"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteVehicle(veh)}
                        title="Supprimer le véhicule"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>

                {/* State toggles */}
                {isAdmin && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    {veh.etat !== "Disponible" && (
                      <button
                        onClick={() => handleQuickStateChange(veh.id, "Disponible")}
                        className="text-accent-display font-medium hover:underline"
                      >
                        Marquer Disponible ✔
                      </button>
                    )}
                    {veh.etat === "Disponible" && (
                      <button
                        onClick={() => handleQuickStateChange(veh.id, "En Service")}
                        className="text-accent-display font-medium hover:underline"
                      >
                        Placer En Service ➔
                      </button>
                    )}
                    {veh.etat !== "Hors Service" && (
                      <button
                        onClick={() => handleQuickStateChange(veh.id, "Hors Service")}
                        className="text-danger hover:underline ml-auto"
                      >
                        Hors Service
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit Vehicle Modal */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h3 className="font-semibold text-lg text-ink-display">
                {editingVehicle ? "Modifier le Véhicule" : "Nouveau Véhicule du Parc"}
              </h3>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="immat">Immatriculation *</Label>
                  <Input
                    id="immat"
                    placeholder="ex. BR-4012-RB"
                    value={formImmatriculation}
                    onChange={(e) => setFormImmatriculation(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="marque">Marque / Modèle</Label>
                  <Input
                    id="marque"
                    placeholder="ex. Toyota Coaster"
                    value={formMarque}
                    onChange={(e) => setFormMarque(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type_bus">Type de Bus</Label>
                  <Input
                    id="type_bus"
                    placeholder="ex. Minibus / Autocar"
                    value={formTypeBus}
                    onChange={(e) => setFormTypeBus(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="capacite">Capacité (Places) *</Label>
                  <Input
                    id="capacite"
                    type="number"
                    value={formCapacite}
                    onChange={(e) => setFormCapacite(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="agence_bus">Agence d'Attachement</Label>
                  <select
                    id="agence_bus"
                    value={formAgenceId}
                    onChange={(e) => setFormAgenceId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    <option value="">Sélectionner une agence</option>
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nom} ({a.ville})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="etat_bus">État Opérationnel</Label>
                  <select
                    id="etat_bus"
                    value={formEtat}
                    onChange={(e) => setFormEtat(e.target.value as VehicleItem["etat"])}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    <option value="Disponible">Disponible</option>
                    <option value="En Service">En Service</option>
                    <option value="En Maintenance">En Maintenance</option>
                    <option value="Hors Service">Hors Service</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsVehicleModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-accent text-accent-ink hover:opacity-90">
                  {editingVehicle ? "Mettre à jour" : "Ajouter au Parc"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Entry Modal */}
      {isMaintenanceModalOpen && targetVehicleForMaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <Wrench className="h-5 w-5 text-signal-display" />
                <h3 className="font-semibold text-lg">Enregistrer Maintenance</h3>
              </div>
              <button onClick={() => setIsMaintenanceModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaintenance} className="mt-4 space-y-4">
              <div className="rounded-lg bg-page p-3 border border-hairline">
                <p className="font-bold text-ink-display">{targetVehicleForMaint.immatriculation}</p>
                <p className="text-xs text-ink-muted">{targetVehicleForMaint.marque}</p>
              </div>

              <div>
                <Label htmlFor="maint_type">Type d'Intervention *</Label>
                <Input
                  id="maint_type"
                  placeholder="ex. Vidange, Changement Pneus, Freinage..."
                  value={maintType}
                  onChange={(e) => setMaintType(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="maint_cout">Coût de la Maintenance (XOF) *</Label>
                <Input
                  id="maint_cout"
                  type="number"
                  value={maintCout}
                  onChange={(e) => setMaintCout(Number(e.target.value))}
                  required
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Saisir le coût débitera automatiquement le journal de caisse d'agence.
                </p>
              </div>

              <div>
                <Label htmlFor="maint_desc">Description / Réparations effectuées</Label>
                <Input
                  id="maint_desc"
                  placeholder="ex. Remplacement huile moteur, filtre à air..."
                  value={maintDescription}
                  onChange={(e) => setMaintDescription(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="maint_date">Date de Maintenance</Label>
                <Input
                  id="maint_date"
                  type="date"
                  value={maintDate}
                  onChange={(e) => setMaintDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsMaintenanceModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting} className="bg-accent text-accent-ink hover:opacity-90">
                  {submitting ? "Enregistrement..." : "Valider & Débiter Caisse"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance History Drawer */}
      {historyVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <History className="h-5 w-5 text-accent-display" />
                <h3 className="font-semibold text-lg">Historique Maintenance</h3>
              </div>
              <button onClick={() => setHistoryVehicle(null)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-page p-3 border border-hairline">
                <p className="font-bold text-ink-display">{historyVehicle.immatriculation} - {historyVehicle.marque}</p>
                <p className="text-xs text-ink-muted">Historique des réparations & dépenses d'entretien</p>
              </div>

              {historyLoading ? (
                <p className="text-center py-6 text-sm text-ink-muted">Chargement de l'historique...</p>
              ) : historyLogs.length === 0 ? (
                <p className="text-center py-6 text-sm text-ink-muted">Aucune maintenance enregistrée pour ce véhicule.</p>
              ) : (
                <ul className="divide-y divide-hairline max-h-80 overflow-y-auto pr-1">
                  {historyLogs.map((log) => (
                    <li key={log.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-ink-display">{log.type_maintenance}</p>
                          {log.description && <p className="text-xs text-ink-muted">{log.description}</p>}
                          <p className="text-[11px] text-ink-muted flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" /> {log.date_maintenance}
                            {log.heure_maintenance && <Clock className="h-3 w-3 ml-2" />} {log.heure_maintenance?.slice(0, 5)}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-signal-display text-sm whitespace-nowrap">
                          {log.cout ? currencyFormatter.format(log.cout) : "Gratuit"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-end pt-4 border-t border-hairline">
                <Button variant="secondary" onClick={() => setHistoryVehicle(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
