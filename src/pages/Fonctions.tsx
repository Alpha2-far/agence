import * as React from "react";
import {
  Banknote,
  Edit2,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type FonctionItem = {
  id: string;
  intitule: string;
  salaire: number | null;
  attribut: string | null;
  details: string | null;
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function Fonctions() {
  const { user } = useAuth();
  const isSuperAdmin = user?.type === "SuperAdmin";

  const [fonctions, setFonctions] = React.useState<FonctionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingFonction, setEditingFonction] = React.useState<FonctionItem | null>(null);

  const [formIntitule, setFormIntitule] = React.useState("");
  const [formSalaire, setFormSalaire] = React.useState<number>(250000);
  const [formAttribut, setFormAttribut] = React.useState("");
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
      const { data, error: fnErr } = await client.from("fonction").select("*").order("intitule");
      if (fnErr) throw fnErr;
      setFonctions((data as FonctionItem[]) ?? []);
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger les fonctions.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingFonction(null);
    setFormIntitule("");
    setFormSalaire(250000);
    setFormAttribut("Opérationnel");
    setFormDetails("");
    setIsModalOpen(true);
  };

  const openEditModal = (fn: FonctionItem) => {
    setEditingFonction(fn);
    setFormIntitule(fn.intitule);
    setFormSalaire(fn.salaire ?? 250000);
    setFormAttribut(fn.attribut || "");
    setFormDetails(fn.details || "");
    setIsModalOpen(true);
  };

  const handleSaveFonction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formIntitule.trim()) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const payload = {
        intitule: formIntitule.trim(),
        salaire: formSalaire,
        attribut: formAttribut.trim() || null,
        details: formDetails.trim() || null,
      };

      if (editingFonction) {
        const { error: updateErr } = await client.from("fonction").update(payload).eq("id", editingFonction.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await client.from("fonction").insert(payload);
        if (insertErr) throw insertErr;
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la fonction.");
    }
  };

  const filteredFonctions = fonctions.filter((f) =>
    f.intitule.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.attribut && f.attribut.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-accent-display" />
            Référentiel des Fonctions RH
          </h1>
          <p className="mt-1 text-ink-muted">
            Définissez les métiers, grilles salariales de référence et responsabilités pour le personnel.
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
            <Plus className="h-4 w-4" />
            Nouvelle Fonction
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
            placeholder="Rechercher intitulé de fonction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des fonctions...
        </div>
      ) : filteredFonctions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucune fonction trouvée</h3>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFonctions.map((fn) => (
            <article
              key={fn.id}
              className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-6 shadow-sm hover:border-accent-display/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-ink-display">{fn.intitule}</h3>
                  {isSuperAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(fn)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-sm text-ink-muted">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-accent-display" />
                    <span>Salaire Réf: <strong className="text-ink-display">{fn.salaire ? currencyFormatter.format(fn.salaire) : "N/A"}</strong></span>
                  </div>

                  {fn.attribut && (
                    <p className="text-xs text-ink-muted pt-1">
                      Attribut: <span className="font-medium text-ink-display">{fn.attribut}</span>
                    </p>
                  )}

                  {fn.details && (
                    <p className="text-xs text-ink-muted pt-2 border-t border-hairline italic">
                      {fn.details}
                    </p>
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
                {editingFonction ? "Modifier la Fonction" : "Nouvelle Fonction RH"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFonction} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="fn_intitule">Intitulé du Poste *</Label>
                <Input
                  id="fn_intitule"
                  placeholder="ex. Chef d'Agence, Conducteur, Caissier..."
                  value={formIntitule}
                  onChange={(e) => setFormIntitule(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="fn_salaire">Salaire de Référence (XOF)</Label>
                <Input
                  id="fn_salaire"
                  type="number"
                  value={formSalaire}
                  onChange={(e) => setFormSalaire(Number(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="fn_attribut">Domaine / Attribut</Label>
                <Input
                  id="fn_attribut"
                  placeholder="ex. Administration, Billetterie, Transport"
                  value={formAttribut}
                  onChange={(e) => setFormAttribut(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="fn_details">Détails des Responsabilités</Label>
                <Input
                  id="fn_details"
                  placeholder="ex. Responsable de la gestion des trajets et caisse"
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-accent text-accent-ink hover:opacity-90">
                  {editingFonction ? "Mettre à jour" : "Créer la fonction"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
