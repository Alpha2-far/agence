import * as React from "react";
import {
  BusFront,
  Calendar,
  Clock,
  Filter,
  MapPin,
  Plus,
  Printer,
  Receipt,
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

export type TicketItem = {
  id: string;
  numero_facture: string;
  nom_client: string;
  client_id: string | null;
  trajet_id: string;
  reservation_id: string | null;
  etat: "Payé" | "Non Payé" | "Annulé";
  montant: number;
  agence_id: string | null;
  gare_depart: string | null;
  gare_arrivee: string | null;
  date_facture: string;
  heure_facture: string;
  created_at?: string;
  // Joined relation fields
  trajet?: {
    depart: string;
    destination: string;
    date_voyage: string;
    heure_depart: string;
    tarif_standard: number;
  } | null;
  client?: {
    telephone: string;
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
  places_disponibles?: number;
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function Tickets() {
  const { user } = useAuth();

  const [tickets, setTickets] = React.useState<TicketItem[]>([]);
  const [activeJourneys, setActiveJourneys] = React.useState<ActiveJourneyOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dateFilter, setDateFilter] = React.useState<string>("");

  // Ticket Sales Modal state
  const [isSaleModalOpen, setIsSaleModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Thermal Print Modal state
  const [printableTicket, setPrintableTicket] = React.useState<TicketPrintData | null>(null);

  // Form fields
  const [selectedTrajetId, setSelectedTrajetId] = React.useState("");
  const [nomClient, setNomClient] = React.useState("");
  const [telephoneClient, setTelephoneClient] = React.useState("");
  const [gareDepart, setGareDepart] = React.useState("");
  const [gareArrivee, setGareArrivee] = React.useState("");
  const [montantTicket, setMontantTicket] = React.useState<number>(7000);
  const [isImmediatePayment, setIsImmediatePayment] = React.useState(true);

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
        .from("facture")
        .select(`
          *,
          trajet:trajet_id(depart, destination, date_voyage, heure_depart, tarif_standard),
          client:client_id(telephone),
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

      const [ticketsRes, journeysRes] = await Promise.all([query, journeysQuery]);

      if (ticketsRes.error) throw ticketsRes.error;
      setTickets((ticketsRes.data as unknown as TicketItem[]) ?? []);

      if (journeysRes.data) {
        const journeyList = journeysRes.data as ActiveJourneyOption[];
        setActiveJourneys(journeyList);
        if (journeyList.length > 0 && !selectedTrajetId) {
          setSelectedTrajetId(journeyList[0].id);
          setGareDepart(journeyList[0].depart);
          setGareArrivee(journeyList[0].destination);
          setMontantTicket(journeyList[0].tarif_standard);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger les billets.");
    } finally {
      setLoading(false);
    }
  }, [user, selectedTrajetId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle journey selection in sale modal
  const handleTrajetChange = (trajetId: string) => {
    setSelectedTrajetId(trajetId);
    const found = activeJourneys.find((j) => j.id === trajetId);
    if (found) {
      setGareDepart(found.depart);
      setGareArrivee(found.destination);
      setMontantTicket(found.tarif_standard);
    }
  };

  const openSaleModal = () => {
    setNomClient("");
    setTelephoneClient("");
    setIsImmediatePayment(true);
    if (activeJourneys.length > 0) {
      const first = activeJourneys[0];
      setSelectedTrajetId(first.id);
      setGareDepart(first.depart);
      setGareArrivee(first.destination);
      setMontantTicket(first.tarif_standard);
    }
    setIsSaleModalOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTrajetId || !nomClient.trim()) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSubmitting(true);
    try {
      const selectedJourney = activeJourneys.find((j) => j.id === selectedTrajetId);

      // Create client entry if telephone provided
      let clientId: string | null = null;
      if (telephoneClient.trim()) {
        const { data: existingClient } = await client
          .from("client")
          .select("id")
          .eq("telephone", telephoneClient.trim())
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const parts = nomClient.trim().split(" ");
          const prenom = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
          const nom = parts[0];
          const { data: newClient } = await client
            .from("client")
            .insert({
              nom,
              prenom,
              telephone: telephoneClient.trim(),
            })
            .select("id")
            .single();

          if (newClient) clientId = newClient.id;
        }
      }

      // Insert Facture
      const facturePayload = {
        nom_client: nomClient.trim(),
        client_id: clientId,
        trajet_id: selectedTrajetId,
        etat: isImmediatePayment ? "Payé" : "Non Payé",
        montant: montantTicket,
        agence_id: user.agence_id || null,
        gare_depart: gareDepart || selectedJourney?.depart || "Départ",
        gare_arrivee: gareArrivee || selectedJourney?.destination || "Arrivée",
        date_facture: new Date().toISOString().slice(0, 10),
      };

      const { data: insertedFacture, error: factureErr } = await client
        .from("facture")
        .insert(facturePayload)
        .select("*")
        .single();

      if (factureErr) throw factureErr;

      // If immediate payment, insert reglement record
      if (isImmediatePayment && insertedFacture) {
        const { error: reglementErr } = await client.from("reglement").insert({
          facture_id: insertedFacture.id,
          montant: montantTicket,
          date_reglement: new Date().toISOString().slice(0, 10),
        });

        if (reglementErr) console.error("Règlement auto trigger:", reglementErr);
      }

      setIsSaleModalOpen(false);
      await loadData();

      // Open print preview automatically for the created ticket
      if (insertedFacture) {
        setPrintableTicket({
          numero_facture: insertedFacture.numero_facture,
          nom_client: insertedFacture.nom_client,
          telephone_client: telephoneClient,
          depart: selectedJourney?.depart ?? gareDepart,
          destination: selectedJourney?.destination ?? gareArrivee,
          gare_depart: gareDepart,
          gare_arrivee: gareArrivee,
          date_voyage: selectedJourney?.date_voyage ?? new Date().toISOString().slice(0, 10),
          heure_depart: selectedJourney?.heure_depart ?? "07:00",
          montant: montantTicket,
          date_facture: insertedFacture.date_facture,
          heure_facture: insertedFacture.heure_facture,
          agence_nom: user.agence_nom ?? "G'NANZE AGENCE",
          agence_telephone: "+229 21 30 00 01",
          vendeur_nom: `${user.employe_prenom ?? ""} ${user.employe_nom ?? user.nom_utilisateur}`.trim(),
        });
        toastSuccess("Ticket vendu et facturé avec succès !");
      }
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur vente de ticket : ${err?.message || err?.details || "Échec de l'opération."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintTicket = (ticket: TicketItem) => {
    setPrintableTicket({
      numero_facture: ticket.numero_facture,
      nom_client: ticket.nom_client,
      telephone_client: ticket.client?.telephone,
      depart: ticket.trajet?.depart ?? ticket.gare_depart ?? "Cotonou",
      destination: ticket.trajet?.destination ?? ticket.gare_arrivee ?? "Parakou",
      gare_depart: ticket.gare_depart ?? undefined,
      gare_arrivee: ticket.gare_arrivee ?? undefined,
      date_voyage: ticket.trajet?.date_voyage ?? ticket.date_facture,
      heure_depart: ticket.trajet?.heure_depart ?? "07:00",
      montant: ticket.montant,
      date_facture: ticket.date_facture,
      heure_facture: ticket.heure_facture,
      agence_nom: ticket.agence?.nom ?? user?.agence_nom ?? "G'NANZE AGENCE",
      agence_telephone: ticket.agence?.telephone ?? "+229 21 30 00 01",
      vendeur_nom: `${user?.employe_prenom ?? ""} ${user?.employe_nom ?? user?.nom_utilisateur}`.trim(),
    });
  };

  // Filtered List
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.numero_facture.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.nom_client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.trajet?.depart.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.trajet?.destination.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || t.etat === statusFilter;
    const matchesDate = !dateFilter || t.date_facture === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <TicketIcon className="h-8 w-8 text-accent-display" />
            Billetterie & Vente Directe
          </h1>
          <p className="mt-1 text-ink-muted">
            Vendez des billets de transport, délivrez des factures et imprimez des reçus thermiques 57 mm.
          </p>
        </div>
        <Button onClick={openSaleModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
          <Plus className="h-4 w-4" />
          Vendre un Ticket
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
            placeholder="Rechercher ticket N°, nom du client, trajet..."
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
              <option value="all">Tous les états</option>
              <option value="Payé">Payés</option>
              <option value="Non Payé">Non Payés</option>
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

      {/* Tickets List / Table */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des billets...
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <Receipt className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun billet trouvé</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Effectuez une vente directe pour délivrer le premier ticket de transport.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-page/50 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-6 py-3">N° Billet</th>
                  <th className="px-6 py-3">Passager</th>
                  <th className="px-6 py-3">Trajet</th>
                  <th className="px-6 py-3">Date Voyage</th>
                  <th className="px-6 py-3">Montant</th>
                  <th className="px-6 py-3">État</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink-display">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-page/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-accent-display">
                      {ticket.numero_facture}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{ticket.nom_client}</div>
                      {ticket.client?.telephone && (
                        <div className="text-xs text-ink-muted">{ticket.client.telephone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-medium">
                        <BusFront className="h-4 w-4 text-ink-muted" />
                        {ticket.trajet ? `${ticket.trajet.depart} → ${ticket.trajet.destination}` : `${ticket.gare_depart} → ${ticket.gare_arrivee}`}
                      </div>
                      {(ticket.gare_depart || ticket.gare_arrivee) && (
                        <div className="text-xs text-ink-muted">
                          {ticket.gare_depart} - {ticket.gare_arrivee}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-ink-muted">
                        <Calendar className="h-3.5 w-3.5" />
                        {ticket.trajet?.date_voyage ?? ticket.date_facture}
                      </div>
                      {ticket.trajet?.heure_depart && (
                        <div className="flex items-center gap-1 text-xs text-ink-muted mt-0.5">
                          <Clock className="h-3 w-3" />
                          {ticket.trajet.heure_depart.slice(0, 5)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold whitespace-nowrap">
                      {currencyFormatter.format(ticket.montant)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge tone={ticket.etat === "Payé" ? "accent" : ticket.etat === "Non Payé" ? "neutral" : "signal"}>
                        {ticket.etat}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePrintTicket(ticket)}
                        className="gap-1.5"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Imprimer (57mm)
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sale Direct Ticket Modal */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-ink-display">
                <TicketIcon className="h-5 w-5 text-accent-display" />
                <h3 className="font-semibold text-lg">Vente Directe de Billet</h3>
              </div>
              <button onClick={() => setIsSaleModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="mt-4 space-y-4">
              {/* Journey selection */}
              <div>
                <Label htmlFor="trajet">Sélectionner un Trajet</Label>
                {activeJourneys.length === 0 ? (
                  <p className="mt-1 text-xs text-danger">Aucun trajet actif planifié pour aujourd'hui ou les jours à venir.</p>
                ) : (
                  <select
                    id="trajet"
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

              {/* Passenger Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nom_client">Nom & Prénom du Passager *</Label>
                  <Input
                    id="nom_client"
                    placeholder="ex. Koffi Emmanuel"
                    value={nomClient}
                    onChange={(e) => setNomClient(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="telephone">Téléphone Passager</Label>
                  <Input
                    id="telephone"
                    placeholder="ex. +229 97 00 11 22"
                    value={telephoneClient}
                    onChange={(e) => setTelephoneClient(e.target.value)}
                  />
                </div>
              </div>

              {/* Stations & Amount */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="gare_depart">Gare Départ</Label>
                  <Input
                    id="gare_depart"
                    value={gareDepart}
                    onChange={(e) => setGareDepart(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="gare_arrivee">Gare Arrivée</Label>
                  <Input
                    id="gare_arrivee"
                    value={gareArrivee}
                    onChange={(e) => setGareArrivee(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="montant">Prix Billet (XOF)</Label>
                  <Input
                    id="montant"
                    type="number"
                    value={montantTicket}
                    onChange={(e) => setMontantTicket(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Payment toggle */}
              <div className="rounded-lg bg-page p-3 border border-hairline flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-display">Règlement Immédiat en Caisse</p>
                  <p className="text-xs text-ink-muted">Enregistre le crédit en caisse et marque le billet PAYÉ.</p>
                </div>
                <input
                  type="checkbox"
                  checked={isImmediatePayment}
                  onChange={(e) => setIsImmediatePayment(e.target.checked)}
                  className="h-5 w-5 rounded border-hairline text-accent focus:ring-accent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsSaleModalOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || activeJourneys.length === 0}
                  className="bg-accent text-accent-ink hover:opacity-90 gap-2"
                >
                  <Printer className="h-4 w-4" />
                  {submitting ? "Création en cours..." : "Valider & Imprimer (57mm)"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 57mm Thermal Print Receipt Modal */}
      <TicketPrintModal
        ticket={printableTicket}
        onClose={() => setPrintableTicket(null)}
      />
    </div>
  );
}
