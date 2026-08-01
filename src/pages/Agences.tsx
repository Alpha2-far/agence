import * as React from "react";
import {
  Building2,
  Clock,
  Edit2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type AgencyItem = {
  id: string;
  nom: string;
  ville: string;
  telephone: string | null;
  mail: string | null;
  responsable: string | null;
  horaire_ouverture: string | null;
  created_at?: string;
};

export function Agences() {
  const { user } = useAuth();
  const isSuperAdmin = user?.type === "SuperAdmin";

  const [agencies, setAgencies] = React.useState<AgencyItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingAgency, setEditingAgency] = React.useState<AgencyItem | null>(null);

  const [formNom, setFormNom] = React.useState("");
  const [formVille, setFormVille] = React.useState("");
  const [formTel, setFormTel] = React.useState("");
  const [formMail, setFormMail] = React.useState("");
  const [formResponsable, setFormResponsable] = React.useState("");
  const [formHoraire, setFormHoraire] = React.useState("07:00 - 20:00");

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
      const { data, error: agErr } = await client.from("agence").select("*").order("nom");
      if (agErr) throw agErr;
      setAgencies((data as AgencyItem[]) ?? []);
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger la liste des agences.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingAgency(null);
    setFormNom("");
    setFormVille("");
    setFormTel("");
    setFormMail("");
    setFormResponsable("");
    setFormHoraire("07:00 - 20:00");
    setIsModalOpen(true);
  };

  const openEditModal = (ag: AgencyItem) => {
    setEditingAgency(ag);
    setFormNom(ag.nom);
    setFormVille(ag.ville);
    setFormTel(ag.telephone || "");
    setFormMail(ag.mail || "");
    setFormResponsable(ag.responsable || "");
    setFormHoraire(ag.horaire_ouverture || "07:00 - 20:00");
    setIsModalOpen(true);
  };

  const handleSaveAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formNom.trim() || !formVille.trim()) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const payload = {
        nom: formNom.trim(),
        ville: formVille.trim(),
        telephone: formTel.trim() || null,
        mail: formMail.trim() || null,
        responsable: formResponsable.trim() || null,
        horaire_ouverture: formHoraire.trim() || null,
      };

      if (editingAgency) {
        const { error: updateErr } = await client.from("agence").update(payload).eq("id", editingAgency.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await client.from("agence").insert(payload);
        if (insertErr) throw insertErr;
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de l'agence.");
    }
  };

  const filteredAgencies = agencies.filter((a) =>
    a.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.ville.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.responsable && a.responsable.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-accent-display" />
            Gestion des Agences du Réseau
          </h1>
          <p className="mt-1 text-ink-muted">
            Administrez les branches régionales, coordonnées et responsables d'agence G'NANZE.
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
            <Plus className="h-4 w-4" />
            Nouvelle Agence
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
            placeholder="Rechercher agence, ville, responsable..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des agences...
        </div>
      ) : filteredAgencies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucune agence trouvée</h3>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgencies.map((ag) => (
            <article
              key={ag.id}
              className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-6 shadow-sm hover:border-accent-display/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-ink-display">{ag.nom}</h3>
                  {isSuperAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(ag)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="mt-4 space-y-2.5 text-sm text-ink-muted">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-accent-display" />
                    <span>Ville: <strong className="text-ink-display">{ag.ville}</strong></span>
                  </div>

                  {ag.responsable && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-ink-muted" />
                      <span>Responsable: <strong className="text-ink-display">{ag.responsable}</strong></span>
                    </div>
                  )}

                  {ag.telephone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="h-3.5 w-3.5 text-ink-muted" />
                      <span>{ag.telephone}</span>
                    </div>
                  )}

                  {ag.mail && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail className="h-3.5 w-3.5 text-ink-muted" />
                      <span>{ag.mail}</span>
                    </div>
                  )}

                  {ag.horaire_ouverture && (
                    <div className="flex items-center gap-2 text-xs pt-2 border-t border-hairline">
                      <Clock className="h-3.5 w-3.5 text-accent-display" />
                      <span>Ouverture: {ag.horaire_ouverture}</span>
                    </div>
                  )}
                </div>
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
                {editingAgency ? "Modifier l'Agence" : "Nouvelle Agence"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAgency} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="ag_nom">Nom de l'Agence *</Label>
                <Input
                  id="ag_nom"
                  placeholder="ex. Agence de Cotonou"
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="ag_ville">Ville *</Label>
                <Input
                  id="ag_ville"
                  placeholder="ex. Cotonou / Parakou"
                  value={formVille}
                  onChange={(e) => setFormVille(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ag_tel">Téléphone</Label>
                  <Input
                    id="ag_tel"
                    placeholder="ex. +229 21 30 00 01"
                    value={formTel}
                    onChange={(e) => setFormTel(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ag_mail">Email</Label>
                  <Input
                    id="ag_mail"
                    type="email"
                    placeholder="ex. agence@gnanze.com"
                    value={formMail}
                    onChange={(e) => setFormMail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ag_resp">Nom du Responsable</Label>
                <Input
                  id="ag_resp"
                  placeholder="ex. M. Paul Sossa"
                  value={formResponsable}
                  onChange={(e) => setFormResponsable(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="ag_horaire">Horaires d'Ouverture</Label>
                <Input
                  id="ag_horaire"
                  placeholder="ex. 07:00 - 20:00"
                  value={formHoraire}
                  onChange={(e) => setFormHoraire(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-accent text-accent-ink hover:opacity-90">
                  {editingAgency ? "Mettre à jour" : "Créer l'agence"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
