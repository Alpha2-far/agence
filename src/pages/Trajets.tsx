import * as React from "react";
import {
  BusFront,
  Calendar,
  Clock,
  Edit2,
  Filter,
  Info,
  MapPin,
  Plus,
  Printer,
  Search,
  Trash2,
  User,
  Users,
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
import { exportJourneyManifestPDF } from "@/lib/pdfExport";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type JourneyItem = {
  id: string;
  depart: string;
  destination: string;
  distance_km: number | null;
  duree_minutes: number | null;
  tarif_standard: number;
  conducteur_id: string | null;
  vehicule_id: string | null;
  agence_id: string | null;
  date_voyage: string;
  heure_depart: string;
  statut: "Planifié" | "En Cours" | "Terminé" | "Annulé";
  created_at?: string;
  // Joined relation fields
  conducteur?: { nom: string; prenom: string } | null;
  vehicule?: { immatriculation: string; marque: string; capacite: number } | null;
};

export type JourneyOccupancy = {
  trajet_id: string;
  depart: string;
  destination: string;
  date_voyage: string;
  heure_depart: string;
  capacite_vehicule: number;
  nb_passagers_confirmes: number;
  nb_reservations_actives: number;
  nb_colis: number;
  places_disponibles: number;
};

type VehicleOption = {
  id: string;
  immatriculation: string;
  marque: string;
  capacite: number;
  etat: string;
};

type DriverOption = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function Trajets() {
  const { user } = useAuth();
  const isAdmin = hasMinimumRole(user?.type ?? "user", "Admin");

  const [journeys, setJourneys] = React.useState<JourneyItem[]>([]);
  const [vehicles, setVehicles] = React.useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = React.useState<DriverOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dateFilter, setDateFilter] = React.useState<string>("");

  // Modal / Drawer state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingJourney, setEditingJourney] = React.useState<JourneyItem | null>(null);

  // Occupancy modal
  const [occupancyData, setOccupancyData] = React.useState<JourneyOccupancy | null>(null);
  const [occupancyLoading, setOccupancyLoading] = React.useState(false);

  // Form inputs
  const [formDepart, setFormDepart] = React.useState("Cotonou");
  const [formDestination, setFormDestination] = React.useState("Parakou");
  const [formDistance, setFormDistance] = React.useState<number>(415);
  const [formDuree, setFormDuree] = React.useState<number>(360);
  const [formTarif, setFormTarif] = React.useState<number>(7000);
  const [formVehiculeId, setFormVehiculeId] = React.useState("");
  const [formConducteurId, setFormConducteurId] = React.useState("");
  const [formDateVoyage, setFormDateVoyage] = React.useState(new Date().toISOString().slice(0, 10));
  const [formHeureDepart, setFormHeureDepart] = React.useState("07:00");
  const [formStatut, setFormStatut] = React.useState<"Planifié" | "En Cours" | "Terminé" | "Annulé">("Planifié");

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
        .from("trajet")
        .select(`
          *,
          conducteur:employe!conducteur_id(nom, prenom),
          vehicule:vehicule!vehicule_id(immatriculation, marque, capacite)
        `)
        .order("date_voyage", { ascending: true })
        .order("heure_depart", { ascending: true });

      if (user.agence_id && user.type !== "SuperAdmin") {
        query = query.eq("agence_id", user.agence_id);
      }

      const [journeysRes, vehiclesRes, driversRes] = await Promise.all([
        query,
        client.from("vehicule").select("id, immatriculation, marque, capacite, etat"),
        client.from("employe").select("id, nom, prenom, telephone").eq("actif", true),
      ]);

      if (journeysRes.error) throw journeysRes.error;
      setJourneys((journeysRes.data as unknown as JourneyItem[]) ?? []);

      if (vehiclesRes.data) setVehicles(vehiclesRes.data as VehicleOption[]);
      if (driversRes.data) setDrivers(driversRes.data as DriverOption[]);
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger la liste des trajets.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingJourney(null);
    setFormDepart(user?.agence_nom?.includes("Parakou") ? "Parakou" : "Cotonou");
    setFormDestination(user?.agence_nom?.includes("Parakou") ? "Cotonou" : "Parakou");
    setFormDistance(415);
    setFormDuree(360);
    setFormTarif(7000);
    setFormVehiculeId(vehicles[0]?.id ?? "");
    setFormConducteurId(drivers[0]?.id ?? "");
    setFormDateVoyage(new Date().toISOString().slice(0, 10));
    setFormHeureDepart("07:00");
    setFormStatut("Planifié");
    setIsModalOpen(true);
  };

  const openEditModal = (journey: JourneyItem) => {
    setEditingJourney(journey);
    setFormDepart(journey.depart);
    setFormDestination(journey.destination);
    setFormDistance(journey.distance_km ?? 415);
    setFormDuree(journey.duree_minutes ?? 360);
    setFormTarif(journey.tarif_standard);
    setFormVehiculeId(journey.vehicule_id ?? "");
    setFormConducteurId(journey.conducteur_id ?? "");
    setFormDateVoyage(journey.date_voyage);
    setFormHeureDepart(journey.heure_depart.slice(0, 5));
    setFormStatut(journey.statut);
    setIsModalOpen(true);
  };

  const handleSaveJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const payload = {
        depart: formDepart,
        destination: formDestination,
        distance_km: formDistance,
        duree_minutes: formDuree,
        tarif_standard: formTarif,
        vehicule_id: formVehiculeId || null,
        conducteur_id: formConducteurId || null,
        agence_id: user.agence_id || null,
        date_voyage: formDateVoyage,
        heure_depart: formHeureDepart,
        statut: formStatut,
      };

      if (editingJourney) {
        const { error: updateErr } = await client.from("trajet").update(payload).eq("id", editingJourney.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await client.from("trajet").insert(payload);
        if (insertErr) throw insertErr;
      }

      setIsModalOpen(false);
      toastSuccess(editingJourney ? "Trajet mis à jour." : "Trajet créé avec succès.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur enregistrement trajet : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  const handleQuickStatusChange = async (journeyId: string, newStatut: JourneyItem["statut"]) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: updateErr } = await client.from("trajet").update({ statut: newStatut }).eq("id", journeyId);
      if (updateErr) throw updateErr;
      toastSuccess("Statut trajet mis à jour.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur statut trajet : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  const handleDeleteTrajet = async (journey: JourneyItem) => {
    if (!user) return;
    if (!confirm(`Voulez-vous vraiment supprimer le trajet "${journey.depart} ➔ ${journey.destination}" du ${journey.date_voyage} ?`)) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: delErr } = await client.from("trajet").delete().eq("id", journey.id);
      if (delErr) throw delErr;
      toastSuccess("Trajet supprimé.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur suppression trajet : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  const viewOccupancy = async (journey: JourneyItem) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setOccupancyLoading(true);
    try {
      const { data, error: occErr } = await client
        .from("vue_occupation_trajet")
        .select("*")
        .eq("trajet_id", journey.id)
        .maybeSingle();

      if (occErr) throw occErr;

      if (data) {
        setOccupancyData(data as JourneyOccupancy);
      } else {
        // Fallback default
        setOccupancyData({
          trajet_id: journey.id,
          depart: journey.depart,
          destination: journey.destination,
          date_voyage: journey.date_voyage,
          heure_depart: journey.heure_depart,
          capacite_vehicule: journey.vehicule?.capacite ?? 15,
          nb_passagers_confirmes: 0,
          nb_reservations_actives: 0,
          nb_colis: 0,
          places_disponibles: journey.vehicule?.capacite ?? 15,
        });
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la récupération de l'occupation.");
    } finally {
      setOccupancyLoading(false);
    }
  };

  // Filtered List
  const filteredJourneys = journeys.filter((j) => {
    const matchesSearch =
      j.depart.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.vehicule?.immatriculation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${j.conducteur?.nom} ${j.conducteur?.prenom}`.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || j.statut === statusFilter;
    const matchesDate = !dateFilter || j.date_voyage === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleExportManifestPDF = async (journeyId: string) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const [journeyRes, ticketsRes] = await Promise.all([
        client.from("trajet").select("*, vehicule:vehicule_id(immatriculation), conducteur:conducteur_id(nom, prenom)").eq("id", journeyId).single(),
        client.from("facture").select("numero_facture, nom_client, telephone, numero_siege, etat").eq("trajet_id", journeyId).eq("type_facture", "Ticket"),
      ]);

      if (journeyRes.data) {
        const j = journeyRes.data;
        exportJourneyManifestPDF({
          trajet: {
            depart: j.depart,
            destination: j.destination,
            date_voyage: j.date_voyage,
            heure_depart: j.heure_depart,
            prix_ticket: j.prix_ticket,
            immatriculation: j.vehicule?.immatriculation,
            chauffeur: j.conducteur ? `${j.conducteur.nom} ${j.conducteur.prenom}` : undefined,
          },
          tickets: ticketsRes.data ?? [],
          agenceNom: user.agence_id ? "Agence Régionale" : "Réseau Global",
        });
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'export du manifeste passagers.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <BusFront className="h-8 w-8 text-accent-display" />
            Gestion des Trajets
          </h1>
          <p className="mt-1 text-ink-muted">
            Planifiez les départs, assignez les véhicules et conducteurs, et surveillez l'occupation des lignes.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
            <Plus className="h-4 w-4" />
            Nouveau Trajet
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
            placeholder="Rechercher ville, bus, chauffeur..."
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
              <option value="Planifié">Planifiés</option>
              <option value="En Cours">En Cours</option>
              <option value="Terminé">Terminés</option>
              <option value="Annulé">Annulés</option>
            </select>
          </div>
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

      {/* Journey Grid / List */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des trajets...
        </div>
      ) : filteredJourneys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <BusFront className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun trajet trouvé</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {searchQuery || statusFilter !== "all" || dateFilter
              ? "Essayez de modifier vos filtres de recherche."
              : "Créez un nouveau trajet pour commencer à enregistrer des départs."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredJourneys.map((journey) => (
            <article
              key={journey.id}
              className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-6 shadow-sm hover:border-accent-display/40 transition-colors"
            >
              <div>
                {/* Status Badge & Actions */}
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    tone={
                      journey.statut === "En Cours"
                        ? "accent"
                        : journey.statut === "Planifié"
                        ? "neutral"
                        : journey.statut === "Terminé"
                        ? "accent"
                        : "signal"
                    }
                  >
                    {journey.statut}
                  </Badge>
                  <span className="font-display font-semibold text-accent-display">
                    {currencyFormatter.format(journey.tarif_standard)}
                  </span>
                </div>

                {/* Route Header */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-faded text-accent-display">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-ink-display">
                      {journey.depart} → {journey.destination}
                    </h3>
                    <p className="text-xs text-ink-muted">
                      {journey.distance_km ? `${journey.distance_km} km` : ""}
                      {journey.duree_minutes ? ` · ~${Math.floor(journey.duree_minutes / 60)}h${journey.duree_minutes % 60 ? journey.duree_minutes % 60 : ""}` : ""}
                    </p>
                  </div>
                </div>

                {/* Time & Vehicle details */}
                <div className="mt-6 space-y-2.5 text-sm text-ink-muted">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-accent-display" />
                    <span>
                      {new Date(`${journey.date_voyage}T00:00:00`).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-accent-display" />
                    <span>Départ à <strong>{journey.heure_depart.slice(0, 5)}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-ink-muted" />
                    <span>
                      Bus: {journey.vehicule ? `${journey.vehicule.marque} (${journey.vehicule.immatriculation}) - ${journey.vehicule.capacite} pl.` : "Non assigné"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-ink-muted" />
                    <span>
                      Chauffeur: {journey.conducteur ? `${journey.conducteur.prenom} ${journey.conducteur.nom}` : "Non assigné"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-6 pt-4 border-t border-hairline flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => viewOccupancy(journey)}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Occupation
                  </Button>

                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(journey)}
                        title="Modifier trajet"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteTrajet(journey)}
                        title="Supprimer le trajet"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Status Toggle Quick Buttons */}
                {isAdmin && (
                  <div className="flex items-center justify-between text-xs gap-1 pt-1">
                    {journey.statut === "Planifié" && (
                      <button
                        onClick={() => handleQuickStatusChange(journey.id, "En Cours")}
                        className="text-accent-display hover:underline font-medium"
                      >
                        Lancer le trajet ➔
                      </button>
                    )}
                    {journey.statut === "En Cours" && (
                      <button
                        onClick={() => handleQuickStatusChange(journey.id, "Terminé")}
                        className="text-green-600 dark:text-green-400 hover:underline font-medium"
                      >
                        Marquer Terminé ✔
                      </button>
                    )}
                    {journey.statut !== "Annulé" && journey.statut !== "Terminé" && (
                      <button
                        onClick={() => handleQuickStatusChange(journey.id, "Annulé")}
                        className="text-danger hover:underline ml-auto"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit Journey Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h3 className="font-semibold text-lg text-ink-display">
                {editingJourney ? "Modifier le Trajet" : "Nouveau Trajet"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJourney} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="depart">Ville de Départ</Label>
                  <Input
                    id="depart"
                    value={formDepart}
                    onChange={(e) => setFormDepart(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="destination">Destination</Label>
                  <Input
                    id="destination"
                    value={formDestination}
                    onChange={(e) => setFormDestination(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="distance">Distance (km)</Label>
                  <Input
                    id="distance"
                    type="number"
                    value={formDistance}
                    onChange={(e) => setFormDistance(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="duree">Durée (min)</Label>
                  <Input
                    id="duree"
                    type="number"
                    value={formDuree}
                    onChange={(e) => setFormDuree(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="tarif">Tarif Standard (XOF)</Label>
                  <Input
                    id="tarif"
                    type="number"
                    value={formTarif}
                    onChange={(e) => setFormTarif(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_voyage">Date du voyage</Label>
                  <Input
                    id="date_voyage"
                    type="date"
                    value={formDateVoyage}
                    onChange={(e) => setFormDateVoyage(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="heure_depart">Heure de départ</Label>
                  <Input
                    id="heure_depart"
                    type="time"
                    value={formHeureDepart}
                    onChange={(e) => setFormHeureDepart(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicule">Véhicule / Bus</Label>
                  <select
                    id="vehicule"
                    value={formVehiculeId}
                    onChange={(e) => setFormVehiculeId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    <option value="">Sélectionner un véhicule</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.marque} ({v.immatriculation}) - {v.capacite} places [{v.etat}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="conducteur">Chauffeur</Label>
                  <select
                    id="conducteur"
                    value={formConducteurId}
                    onChange={(e) => setFormConducteurId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    <option value="">Sélectionner un chauffeur</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.prenom} {d.nom} ({d.telephone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="statut">Statut du Trajet</Label>
                <select
                  id="statut"
                  value={formStatut}
                  onChange={(e) => setFormStatut(e.target.value as JourneyItem["statut"])}
                  className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                >
                  <option value="Planifié">Planifié</option>
                  <option value="En Cours">En Cours</option>
                  <option value="Terminé">Terminé</option>
                  <option value="Annulé">Annulé</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-accent text-accent-ink hover:opacity-90">
                  {editingJourney ? "Mettre à jour" : "Créer le trajet"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Occupancy Modal Drawer */}
      {occupancyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <Info className="h-5 w-5 text-accent-display" />
                <h3 className="font-semibold text-lg">Occupation du Trajet</h3>
              </div>
              <button onClick={() => setOccupancyData(null)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            {occupancyLoading ? (
              <div className="py-8 text-center text-sm text-ink-muted">Chargement des données d'occupation...</div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="text-center">
                  <p className="font-bold text-xl text-ink-display">
                    {occupancyData.depart} → {occupancyData.destination}
                  </p>
                  <p className="text-sm text-ink-muted mt-0.5">
                    {occupancyData.date_voyage} à {occupancyData.heure_depart.slice(0, 5)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="rounded-lg bg-page p-4 border border-hairline">
                    <p className="text-xs text-ink-muted">Capacité totale</p>
                    <p className="mt-1 font-display text-2xl font-bold text-ink-display">
                      {occupancyData.capacite_vehicule}
                    </p>
                  </div>
                  <div className="rounded-lg bg-accent-faded p-4 border border-accent-display/20">
                    <p className="text-xs text-accent-display font-medium">Places restantes</p>
                    <p className="mt-1 font-display text-2xl font-bold text-accent-display">
                      {occupancyData.places_disponibles}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-hairline p-4 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-hairline">
                    <span className="text-ink-muted">Passagers confirmés (Tickets):</span>
                    <span className="font-semibold text-ink-display">{occupancyData.nb_passagers_confirmes}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-hairline">
                    <span className="text-ink-muted">Réservations actives:</span>
                    <span className="font-semibold text-ink-display">{occupancyData.nb_reservations_actives}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Colis en soute:</span>
                    <span className="font-semibold text-ink-display">{occupancyData.nb_colis}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={() => handleExportManifestPDF(occupancyData.trajet_id)}
                  >
                    <Printer className="h-4 w-4 text-accent-display" />
                    Exporter Passagers (PDF)
                  </Button>
                  <Button onClick={() => setOccupancyData(null)}>Fermer</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
