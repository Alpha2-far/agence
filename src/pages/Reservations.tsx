import * as React from "react";
import {
  ArrowRightLeft,
  BusFront,
  Calendar,
  CalendarClock,
  Clock,
  Filter,
  MapPin,
  Phone,
  Plus,
  Printer,
  Search,
  Ticket as TicketIcon,
  User,
  X,
} from "lucide-react";
import { TicketPrintModal, type TicketPrintData } from "@/components/TicketPrint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type ReservationItem = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  trajet_id: string;
  client_id: string | null;
  date_voyage: string;
  statut: "En Attente" | "Confirmée" | "Convertie" | "Annulée";
  agence_id: string | null;
  gare_depart: string | null;
  gare_arrivee: string | null;
  created_at?: string;
  heure_creation?: string;
  // Joined fields
  trajet?: {
    depart: string;
    destination: string;
    date_voyage: string;
    heure_depart: string;
    tarif_standard: number;
  } | null;
  agence?: {
    nom: string;
    telephone: string;
  } | null;
};

type ActiveJourneyOption = {
  id: string;
  depart: string;
  destination: string;
  date_voyage: string;
  heure_depart: string;
  tarif_standard: number;
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function Reservations() {
  const { user } = useAuth();

  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [activeJourneys, setActiveJourneys] = React.useState<ActiveJourneyOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dateFilter, setDateFilter] = React.useState<string>("");

  // Create Reservation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Conversion Modal State
  const [convertingReservation, setConvertingReservation] = React.useState<ReservationItem | null>(null);
  const [convertAmount, setConvertAmount] = React.useState<number>(7000);
  const [convertGareDepart, setConvertGareDepart] = React.useState("");
  const [convertGareArrivee, setConvertGareArrivee] = React.useState("");

  // Printable Ticket Thermal Modal
  const [printableTicket, setPrintableTicket] = React.useState<TicketPrintData | null>(null);

  // Form input fields
  const [selectedTrajetId, setSelectedTrajetId] = React.useState("");
  const [nomPassenger, setNomPassenger] = React.useState("");
  const [prenomPassenger, setPrenomPassenger] = React.useState("");
  const [telephonePassenger, setTelephonePassenger] = React.useState("");
  const [gareDepart, setGareDepart] = React.useState("");
  const [gareArrivee, setGareArrivee] = React.useState("");
  const [dateVoyage, setDateVoyage] = React.useState("");
  const [initialStatut, setInitialStatut] = React.useState<"En Attente" | "Confirmée">("Confirmée");

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
        .from("reservation")
        .select(`
          *,
          trajet:trajet_id(depart, destination, date_voyage, heure_depart, tarif_standard),
          agence:agence_id(nom, telephone)
        `)
        .order("created_at", { ascending: false });

      if (user.agence_id && user.type !== "SuperAdmin") {
        query = query.eq("agence_id", user.agence_id);
      }

      const today = new Date().toISOString().slice(0, 10);
      let journeysQuery = client
        .from("trajet")
        .select("id, depart, destination, date_voyage, heure_depart, tarif_standard")
        .gte("date_voyage", today)
        .neq("statut", "Annulé")
        .order("date_voyage", { ascending: true })
        .order("heure_depart", { ascending: true });

      if (user.agence_id && user.type !== "SuperAdmin") {
        journeysQuery = journeysQuery.eq("agence_id", user.agence_id);
      }

      const [reservationsRes, journeysRes] = await Promise.all([query, journeysQuery]);

      if (reservationsRes.error) throw reservationsRes.error;
      setReservations((reservationsRes.data as unknown as ReservationItem[]) ?? []);

      if (journeysRes.data) {
        const journeyList = journeysRes.data as ActiveJourneyOption[];
        setActiveJourneys(journeyList);
        if (journeyList.length > 0 && !selectedTrajetId) {
          setSelectedTrajetId(journeyList[0].id);
          setGareDepart(journeyList[0].depart);
          setGareArrivee(journeyList[0].destination);
          setDateVoyage(journeyList[0].date_voyage);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger les réservations.");
    } finally {
      setLoading(false);
    }
  }, [user, selectedTrajetId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTrajetChange = (trajetId: string) => {
    setSelectedTrajetId(trajetId);
    const found = activeJourneys.find((j) => j.id === trajetId);
    if (found) {
      setGareDepart(found.depart);
      setGareArrivee(found.destination);
      setDateVoyage(found.date_voyage);
    }
  };

  const openCreateModal = () => {
    setNomPassenger("");
    setPrenomPassenger("");
    setTelephonePassenger("");
    setInitialStatut("Confirmée");
    if (activeJourneys.length > 0) {
      const first = activeJourneys[0];
      setSelectedTrajetId(first.id);
      setGareDepart(first.depart);
      setGareArrivee(first.destination);
      setDateVoyage(first.date_voyage);
    }
    setIsCreateModalOpen(true);
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTrajetId || !nomPassenger.trim() || !telephonePassenger.trim()) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSubmitting(true);
    try {
      const selectedJourney = activeJourneys.find((j) => j.id === selectedTrajetId);

      const reservationPayload = {
        nom: nomPassenger.trim(),
        prenom: prenomPassenger.trim() || nomPassenger.trim(),
        telephone: telephonePassenger.trim(),
        trajet_id: selectedTrajetId,
        date_voyage: dateVoyage || selectedJourney?.date_voyage || new Date().toISOString().slice(0, 10),
        statut: initialStatut,
        agence_id: user.agence_id || null,
        gare_depart: gareDepart || selectedJourney?.depart,
        gare_arrivee: gareArrivee || selectedJourney?.destination,
      };

      const { error: insertErr } = await client.from("reservation").insert(reservationPayload);
      if (insertErr) throw insertErr;

      setIsCreateModalOpen(false);
      toastSuccess("Réservation créée avec succès.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur création réservation : ${err?.message || err?.details || "Échec de l'opération."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const updateReservationStatus = async (id: string, newStatut: ReservationItem["statut"]) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: updateErr } = await client.from("reservation").update({ statut: newStatut }).eq("id", id);
      if (updateErr) throw updateErr;
      toastSuccess("Statut réservation mis à jour.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur statut réservation : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  // Open conversion modal
  const openConversionModal = (res: ReservationItem) => {
    setConvertingReservation(res);
    setConvertAmount(res.trajet?.tarif_standard ?? 7000);
    setConvertGareDepart(res.gare_depart || res.trajet?.depart || "Départ");
    setConvertGareArrivee(res.gare_arrivee || res.trajet?.destination || "Arrivée");
  };

  // Process conversion: reservation -> paid invoice (facture + reglement) -> print ticket
  const handleConfirmConversion = async () => {
    if (!user || !convertingReservation) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSubmitting(true);
    try {
      const fullname = `${convertingReservation.nom} ${convertingReservation.prenom}`.trim();

      // 1. Create Facture
      const { data: createdFacture, error: factureErr } = await client
        .from("facture")
        .insert({
          nom_client: fullname,
          trajet_id: convertingReservation.trajet_id,
          reservation_id: convertingReservation.id,
          etat: "Payé",
          montant: convertAmount,
          agence_id: user.agence_id || null,
          gare_depart: convertGareDepart,
          gare_arrivee: convertGareArrivee,
          date_facture: new Date().toISOString().slice(0, 10),
        })
        .select("*")
        .single();

      if (factureErr) throw factureErr;

      // 2. Create Reglement (triggers cash credit & ensures Payé state)
      if (createdFacture) {
        const { error: reglementErr } = await client.from("reglement").insert({
          facture_id: createdFacture.id,
          montant: convertAmount,
          date_reglement: new Date().toISOString().slice(0, 10),
        });
        if (reglementErr) console.error(reglementErr);
      }

      // 3. Update reservation status to 'Convertie'
      const { error: resUpdateErr } = await client
        .from("reservation")
        .update({ statut: "Convertie" })
        .eq("id", convertingReservation.id);

      if (resUpdateErr) throw resUpdateErr;

      const targetRes = convertingReservation;
      setConvertingReservation(null);
      toastSuccess("Réservation convertie en ticket payé.");
      await loadData();

      // 4. Trigger print modal
      if (createdFacture) {
        setPrintableTicket({
          numero_facture: createdFacture.numero_facture,
          nom_client: fullname,
          telephone_client: targetRes.telephone,
          depart: targetRes.trajet?.depart ?? convertGareDepart,
          destination: targetRes.trajet?.destination ?? convertGareArrivee,
          gare_depart: convertGareDepart,
          gare_arrivee: convertGareArrivee,
          date_voyage: targetRes.date_voyage,
          heure_depart: targetRes.trajet?.heure_depart ?? "07:00",
          montant: convertAmount,
          date_facture: createdFacture.date_facture,
          heure_facture: createdFacture.heure_facture,
          agence_nom: user.agence_nom ?? "G'NANZE AGENCE",
          agence_telephone: "+229 21 30 00 01",
          vendeur_nom: `${user.employe_prenom ?? ""} ${user.employe_nom ?? user.nom_utilisateur}`.trim(),
        });
      }
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur conversion réservation : ${err?.message || err?.details || "Échec de l'opération."}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered List
  const filteredReservations = reservations.filter((r) => {
    const fullname = `${r.nom} ${r.prenom}`.toLowerCase();
    const matchesSearch =
      fullname.includes(searchQuery.toLowerCase()) ||
      r.telephone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.trajet?.depart.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.trajet?.destination.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || r.statut === statusFilter;
    const matchesDate = !dateFilter || r.date_voyage === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <CalendarClock className="h-8 w-8 text-accent-display" />
            Réservations Téléphoniques
          </h1>
          <p className="mt-1 text-ink-muted">
            Enregistrez les réservations à l'avance et convertissez-les en tickets payés lors du départ.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nouvelle Réservation
        </Button>
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
            placeholder="Rechercher nom, téléphone, trajet..."
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
              <option value="Confirmée">Confirmées</option>
              <option value="En Attente">En Attente</option>
              <option value="Convertie">Converties en Ticket</option>
              <option value="Annulée">Annulées</option>
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

      {/* Reservations List */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des réservations...
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <CalendarClock className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucune réservation trouvée</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Enregistrez un appel client pour créer la première réservation.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReservations.map((res) => (
            <article
              key={res.id}
              className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-6 shadow-sm hover:border-accent-display/40 transition-colors"
            >
              <div>
                {/* Status & Date badge */}
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    tone={
                      res.statut === "Confirmée"
                        ? "accent"
                        : res.statut === "Convertie"
                        ? "accent"
                        : res.statut === "En Attente"
                        ? "neutral"
                        : "signal"
                    }
                  >
                    {res.statut}
                  </Badge>
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {res.date_voyage}
                  </span>
                </div>

                {/* Passenger Info */}
                <div className="mt-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-page text-accent-display border border-hairline">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-ink-display">
                      {res.nom} {res.prenom}
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-ink-muted mt-0.5">
                      <Phone className="h-3 w-3" />
                      {res.telephone}
                    </p>
                  </div>
                </div>

                {/* Journey & Station Info */}
                <div className="mt-6 space-y-2 text-sm text-ink-muted rounded-lg bg-page p-3 border border-hairline">
                  <div className="flex items-center gap-2 font-medium text-ink-display">
                    <BusFront className="h-4 w-4 text-accent-display" />
                    <span>
                      {res.trajet ? `${res.trajet.depart} → ${res.trajet.destination}` : `${res.gare_depart} → ${res.gare_arrivee}`}
                    </span>
                  </div>
                  {res.trajet?.heure_depart && (
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <Clock className="h-3.5 w-3.5" />
                      Heure de départ: {res.trajet.heure_depart.slice(0, 5)}
                    </div>
                  )}
                  {(res.gare_depart || res.gare_arrivee) && (
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <MapPin className="h-3.5 w-3.5" />
                      Gares: {res.gare_depart} → {res.gare_arrivee}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-6 pt-4 border-t border-hairline flex flex-col gap-2">
                {res.statut !== "Convertie" && res.statut !== "Annulée" && (
                  <Button
                    onClick={() => openConversionModal(res)}
                    className="w-full gap-2 bg-accent text-accent-ink hover:opacity-90"
                    size="sm"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Convertir en Ticket
                  </Button>
                )}

                <div className="flex items-center justify-between text-xs pt-1">
                  {res.statut === "En Attente" && (
                    <button
                      onClick={() => updateReservationStatus(res.id, "Confirmée")}
                      className="text-accent-display font-medium hover:underline"
                    >
                      Confirmer la réservation
                    </button>
                  )}
                  {res.statut !== "Annulée" && res.statut !== "Convertie" && (
                    <button
                      onClick={() => updateReservationStatus(res.id, "Annulée")}
                      className="text-danger hover:underline ml-auto"
                    >
                      Annuler
                    </button>
                  )}
                  {res.statut === "Convertie" && (
                    <span className="text-accent-display font-medium flex items-center gap-1">
                      <TicketIcon className="h-3.5 w-3.5" /> Billet Émis
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create Reservation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <CalendarClock className="h-5 w-5 text-accent-display" />
                <h3 className="font-semibold text-lg">Nouvelle Réservation Téléphonique</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="trajet_res">Trajet de voyage</Label>
                {activeJourneys.length === 0 ? (
                  <p className="mt-1 text-xs text-danger">Aucun trajet disponible.</p>
                ) : (
                  <select
                    id="trajet_res"
                    value={selectedTrajetId}
                    onChange={(e) => handleTrajetChange(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                    required
                  >
                    {activeJourneys.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.depart} → {j.destination} ({j.date_voyage} à {j.heure_depart.slice(0, 5)}) - {currencyFormatter.format(j.tarif_standard)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nom_passager">Nom du Passager *</Label>
                  <Input
                    id="nom_passager"
                    placeholder="ex. Sossa"
                    value={nomPassenger}
                    onChange={(e) => setNomPassenger(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="prenom_passager">Prénom</Label>
                  <Input
                    id="prenom_passager"
                    placeholder="ex. Paul"
                    value={prenomPassenger}
                    onChange={(e) => setPrenomPassenger(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="telephone_passager">Numéro de Téléphone *</Label>
                <Input
                  id="telephone_passager"
                  placeholder="ex. +229 97 22 33 44"
                  value={telephonePassenger}
                  onChange={(e) => setTelephonePassenger(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gare_depart_res">Gare Départ</Label>
                  <Input
                    id="gare_depart_res"
                    value={gareDepart}
                    onChange={(e) => setGareDepart(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="gare_arrivee_res">Gare Arrivée</Label>
                  <Input
                    id="gare_arrivee_res"
                    value={gareArrivee}
                    onChange={(e) => setGareArrivee(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_res">Date de voyage</Label>
                  <Input
                    id="date_res"
                    type="date"
                    value={dateVoyage}
                    onChange={(e) => setDateVoyage(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="statut_res">Statut Initial</Label>
                  <select
                    id="statut_res"
                    value={initialStatut}
                    onChange={(e) => setInitialStatut(e.target.value as "En Attente" | "Confirmée")}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    <option value="Confirmée">Confirmée</option>
                    <option value="En Attente">En Attente</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting} className="bg-accent text-accent-ink hover:opacity-90">
                  {submitting ? "Enregistrement..." : "Enregistrer la réservation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Reservation to Paid Ticket Modal */}
      {convertingReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <ArrowRightLeft className="h-5 w-5 text-accent-display" />
                <h3 className="font-semibold text-lg">Convertir en Ticket Payé</h3>
              </div>
              <button onClick={() => setConvertingReservation(null)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-lg bg-page p-3 border border-hairline space-y-1">
                <p className="font-semibold text-ink-display">
                  {convertingReservation.nom} {convertingReservation.prenom}
                </p>
                <p className="text-xs text-ink-muted">Tél: {convertingReservation.telephone}</p>
                <p className="text-xs text-accent-display font-medium pt-1">
                  Trajet: {convertingReservation.trajet?.depart ?? convertGareDepart} → {convertingReservation.trajet?.destination ?? convertGareArrivee} ({convertingReservation.date_voyage})
                </p>
              </div>

              <div>
                <Label htmlFor="convert_montant">Montant du Règlement (XOF)</Label>
                <Input
                  id="convert_montant"
                  type="number"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="conv_g_dep">Gare Départ</Label>
                  <Input
                    id="conv_g_dep"
                    value={convertGareDepart}
                    onChange={(e) => setConvertGareDepart(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="conv_g_arr">Gare Arrivée</Label>
                  <Input
                    id="conv_g_arr"
                    value={convertGareArrivee}
                    onChange={(e) => setConvertGareArrivee(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-ink-muted">
                En confirmant, une nouvelle facture <strong>TKT-XXXX</strong> sera créée, le règlement sera comptabilisé en caisse, et la réservation passera à l'état <strong>Convertie</strong>.
              </p>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setConvertingReservation(null)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleConfirmConversion}
                  disabled={submitting}
                  className="bg-accent text-accent-ink hover:opacity-90 gap-2"
                >
                  <Printer className="h-4 w-4" />
                  {submitting ? "Conversion..." : "Valider & Imprimer (57mm)"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal */}
      <TicketPrintModal
        ticket={printableTicket}
        onClose={() => setPrintableTicket(null)}
      />
    </div>
  );
}
