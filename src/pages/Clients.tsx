import * as React from "react";
import {
  Briefcase,
  ContactRound,
  Edit2,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type ClientItem = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  adresse: string | null;
  profession: string | null;
  created_at?: string;
  // Stats calculated
  total_factures?: number;
};

export function Clients() {
  const { user } = useAuth();

  const [clients, setClients] = React.useState<ClientItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<ClientItem | null>(null);

  // Form fields
  const [formNom, setFormNom] = React.useState("");
  const [formPrenom, setFormPrenom] = React.useState("");
  const [formTel, setFormTel] = React.useState("");
  const [formAdresse, setFormAdresse] = React.useState("");
  const [formProfession, setFormProfession] = React.useState("");
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
      // 1. Fetch clients table
      const { data: clientsData, error: clientErr } = await client
        .from("client")
        .select("*")
        .order("nom");

      if (clientErr) throw clientErr;

      // 2. Fetch ticket counts per client
      const { data: facturesData } = await client.from("facture").select("client_id, nom_client");

      const clientList = (clientsData as ClientItem[]) ?? [];

      // Calculate tickets
      const counts: Record<string, number> = {};
      if (facturesData) {
        facturesData.forEach((f) => {
          if (f.client_id) {
            counts[f.client_id] = (counts[f.client_id] || 0) + 1;
          }
        });
      }

      setClients(
        clientList.map((c) => ({
          ...c,
          total_factures: counts[c.id] || 0,
        }))
      );
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingClient(null);
    setFormNom("");
    setFormPrenom("");
    setFormTel("");
    setFormAdresse("");
    setFormProfession("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: ClientItem) => {
    setEditingClient(c);
    setFormNom(c.nom);
    setFormPrenom(c.prenom);
    setFormTel(c.telephone || "");
    setFormAdresse(c.adresse || "");
    setFormProfession(c.profession || "");
    setIsModalOpen(true);
  };

  const handleDeleteClient = async (c: ClientItem) => {
    if (!user) return;
    if (!confirm(`Voulez-vous vraiment supprimer le client "${c.nom} ${c.prenom}" ?`)) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: delErr } = await client.from("client").delete().eq("id", c.id);
      if (delErr) throw delErr;
      await loadData();
    } catch (err) {
      console.error(err);
      toastError("Erreur lors de la suppression du client.");
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formNom.trim() || !formPrenom.trim()) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSubmitting(true);
    try {
      const payload = {
        nom: formNom.trim().toUpperCase(),
        prenom: formPrenom.trim(),
        telephone: formTel.trim() || null,
        adresse: formAdresse.trim() || null,
        profession: formProfession.trim() || null,
      };

      if (editingClient) {
        const { error: updateErr } = await client
          .from("client")
          .update(payload)
          .eq("id", editingClient.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await client.from("client").insert(payload);
        if (insertErr) throw insertErr;
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      toastError("Erreur lors de l'enregistrement du client.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const fullname = `${c.nom} ${c.prenom}`.toLowerCase();
    return (
      fullname.includes(searchQuery.toLowerCase()) ||
      (c.telephone && c.telephone.includes(searchQuery)) ||
      (c.profession && c.profession.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.adresse && c.adresse.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <ContactRound className="h-8 w-8 text-accent-display" />
            Répertoire des Clients & Voyageurs
          </h1>
          <p className="mt-1 text-ink-muted">
            Consultez le fichier des voyageurs, leurs coordonnées et l'historique de leurs billets.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nouveau Client
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
            placeholder="Rechercher nom, prénom, téléphone, profession..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement du répertoire client...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <ContactRound className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun client trouvé</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Ajoutez un premier voyageur au répertoire.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((c) => (
            <article
              key={c.id}
              className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-6 shadow-sm hover:border-accent-display/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-faded text-accent-display font-bold text-sm">
                      {c.nom.slice(0, 1)}{c.prenom.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-ink-display">
                        {c.nom} {c.prenom}
                      </h3>
                      {c.profession && (
                        <p className="text-xs text-ink-muted flex items-center gap-1">
                          <Briefcase className="h-3 w-3" /> {c.profession}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(c)} title="Modifier la fiche">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteClient(c)} title="Supprimer le client">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-ink-muted">
                  {c.telephone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-accent-display" />
                      <span className="font-mono text-xs text-ink-display">{c.telephone}</span>
                    </div>
                  )}

                  {c.adresse && (
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="h-3.5 w-3.5 text-ink-muted" />
                      <span>{c.adresse}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-hairline flex items-center justify-between">
                <span className="text-xs text-ink-muted flex items-center gap-1">
                  <ReceiptText className="h-3.5 w-3.5 text-accent-display" />
                  Voyages / Tickets:
                </span>
                <Badge tone="accent">{c.total_factures ?? 0} Billet(s)</Badge>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h3 className="font-semibold text-lg text-ink-display">
                {editingClient ? "Modifier la Fiche Client" : "Nouveau Client Voyageur"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cl_nom">Nom de Famille *</Label>
                  <Input
                    id="cl_nom"
                    placeholder="ex. SOSSOU"
                    value={formNom}
                    onChange={(e) => setFormNom(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cl_prenom">Prénom *</Label>
                  <Input
                    id="cl_prenom"
                    placeholder="ex. Marc"
                    value={formPrenom}
                    onChange={(e) => setFormPrenom(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cl_tel">Numéro Téléphone</Label>
                <Input
                  id="cl_tel"
                  placeholder="ex. +229 97 11 22 33"
                  value={formTel}
                  onChange={(e) => setFormTel(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="cl_adresse">Adresse / Quartier</Label>
                <Input
                  id="cl_adresse"
                  placeholder="ex. Akpakpa, Cotonou"
                  value={formAdresse}
                  onChange={(e) => setFormAdresse(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="cl_prof">Profession / Activité</Label>
                <Input
                  id="cl_prof"
                  placeholder="ex. Commerçant, Enseignant..."
                  value={formProfession}
                  onChange={(e) => setFormProfession(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting} className="bg-accent text-accent-ink hover:opacity-90">
                  {submitting ? "Enregistrement..." : "Enregistrer la fiche"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
