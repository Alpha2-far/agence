import * as React from "react";
import {
  Building2,
  Calendar,
  Edit2,
  Filter,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  UsersRound,
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

export type EmployeeItem = {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  agence_id: string | null;
  fonction_id: string | null;
  qualification: string | null;
  date_embauche: string | null;
  date_fin_contrat: string | null;
  actif: boolean;
  created_at?: string;
  // Joined fields
  agence?: { nom: string; ville: string } | null;
  fonction?: { intitule: string; attribut: string } | null;
};

type AgencyOption = { id: string; nom: string; ville: string };
type FonctionOption = { id: string; intitule: string };

export function Employes() {
  const { user } = useAuth();
  const isAdmin = hasMinimumRole(user?.type ?? "user", "Admin");

  const [employees, setEmployees] = React.useState<EmployeeItem[]>([]);
  const [agencies, setAgencies] = React.useState<AgencyOption[]>([]);
  const [fonctions, setFonctions] = React.useState<FonctionOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<EmployeeItem | null>(null);

  // Form Fields
  const [formMatricule, setFormMatricule] = React.useState("");
  const [formNom, setFormNom] = React.useState("");
  const [formPrenom, setFormPrenom] = React.useState("");
  const [formTel, setFormTel] = React.useState("");
  const [formAgenceId, setFormAgenceId] = React.useState("");
  const [formFonctionId, setFormFonctionId] = React.useState("");
  const [formQualification, setFormQualification] = React.useState("");
  const [formDateEmbauche, setFormDateEmbauche] = React.useState(new Date().toISOString().slice(0, 10));
  const [formActif, setFormActif] = React.useState(true);

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
        .from("employe")
        .select(`
          *,
          agence:agence_id(nom, ville),
          fonction:fonction_id(intitule, attribut)
        `)
        .order("matricule");

      if (user.agence_id && user.type !== "SuperAdmin") {
        query = query.eq("agence_id", user.agence_id);
      }

      const [empRes, agRes, fnRes] = await Promise.all([
        query,
        client.from("agence").select("id, nom, ville").order("nom"),
        client.from("fonction").select("id, intitule").order("intitule"),
      ]);

      if (empRes.error) throw empRes.error;
      setEmployees((empRes.data as unknown as EmployeeItem[]) ?? []);

      if (agRes.data) setAgencies(agRes.data as AgencyOption[]);
      if (fnRes.data) setFonctions(fnRes.data as FonctionOption[]);
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger les employés.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setFormMatricule(`EMP-${String(employees.length + 1).padStart(3, "0")}`);
    setFormNom("");
    setFormPrenom("");
    setFormTel("");
    setFormAgenceId(user?.agence_id || (agencies[0]?.id ?? ""));
    setFormFonctionId(fonctions[0]?.id ?? "");
    setFormQualification("");
    setFormDateEmbauche(new Date().toISOString().slice(0, 10));
    setFormActif(true);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    setFormMatricule(emp.matricule);
    setFormNom(emp.nom);
    setFormPrenom(emp.prenom);
    setFormTel(emp.telephone || "");
    setFormAgenceId(emp.agence_id || "");
    setFormFonctionId(emp.fonction_id || "");
    setFormQualification(emp.qualification || "");
    setFormDateEmbauche(emp.date_embauche || new Date().toISOString().slice(0, 10));
    setFormActif(emp.actif);
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formNom.trim() || !formPrenom.trim()) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const payload = {
        matricule: formMatricule.trim().toUpperCase(),
        nom: formNom.trim().toUpperCase(),
        prenom: formPrenom.trim(),
        telephone: formTel.trim() || null,
        agence_id: formAgenceId || user.agence_id || null,
        fonction_id: formFonctionId || null,
        qualification: formQualification.trim() || null,
        date_embauche: formDateEmbauche || null,
        actif: formActif,
      };

      if (editingEmployee) {
        const { error: updateErr } = await client
          .from("employe")
          .update(payload)
          .eq("id", editingEmployee.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await client.from("employe").insert(payload);
        if (insertErr) throw insertErr;
      }

      setIsModalOpen(false);
      toastSuccess(editingEmployee ? "Employé mis à jour." : "Employé créé avec succès.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur enregistrement employé : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  const handleToggleActive = async (emp: EmployeeItem) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: toggleErr } = await client
        .from("employe")
        .update({ actif: !emp.actif })
        .eq("id", emp.id);
      if (toggleErr) throw toggleErr;
      toastSuccess("Statut employé mis à jour.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur statut employé : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  const handleDeleteEmployee = async (emp: EmployeeItem) => {
    if (!user) return;
    if (!confirm(`Voulez-vous vraiment supprimer l'employé "${emp.nom} ${emp.prenom}" (${emp.matricule}) ?`)) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: delErr } = await client.from("employe").delete().eq("id", emp.id);
      if (delErr) throw delErr;
      toastSuccess("Employé supprimé.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(`Erreur suppression employé : ${err?.message || err?.details || "Échec de l'opération."}`);
    }
  };

  // Filtered List
  const filteredEmployees = employees.filter((e) => {
    const fullname = `${e.nom} ${e.prenom}`.toLowerCase();
    const matchesSearch =
      fullname.includes(searchQuery.toLowerCase()) ||
      e.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.telephone && e.telephone.includes(searchQuery));

    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && e.actif) ||
      (activeFilter === "inactive" && !e.actif);

    return matchesSearch && matchesActive;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8 px-3 py-4 sm:px-6 sm:py-8 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold">
            <UsersRound className="h-7 w-7 text-accent-display shrink-0" />
            Gestion des Employés & Personnel
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Gérez l'annuaire du personnel d'agence, les fonctions attribuées et l'état des contrats.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90 self-start sm:self-auto text-xs sm:text-sm">
            <Plus className="h-4 w-4" />
            Nouveau Membre
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
            placeholder="Rechercher nom, matricule EMP-, téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-ink-muted" />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs seulement</option>
            <option value="inactive">Inactifs seulement</option>
          </select>
        </div>
      </div>

      {/* Employee List / Table */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement du personnel...
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <UsersRound className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun employé trouvé</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Enregistrez un nouveau membre pour l'ajouter à l'effectif d'agence.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-page/50 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-6 py-3">Matricule</th>
                  <th className="px-6 py-3">Nom & Prénom</th>
                  <th className="px-6 py-3">Fonction</th>
                  <th className="px-6 py-3">Agence</th>
                  <th className="px-6 py-3">Téléphone</th>
                  <th className="px-6 py-3">Statut</th>
                  {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink-display">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-page/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-accent-display whitespace-nowrap">
                      {emp.matricule}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{emp.nom} {emp.prenom}</div>
                      {emp.qualification && (
                        <div className="text-xs text-ink-muted">{emp.qualification}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium">
                        <ShieldCheck className="h-4 w-4 text-accent-display" />
                        {emp.fonction?.intitule ?? "Non spécifiée"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-ink-muted whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {emp.agence?.nom ?? "Réseau Global"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {emp.telephone ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Phone className="h-3 w-3 text-ink-muted" />
                          {emp.telephone}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge tone={emp.actif ? "accent" : "muted"}>
                        {emp.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(emp)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(emp)}
                            title={emp.actif ? "Désactiver" : "Activer"}
                          >
                            {emp.actif ? <UserX className="h-3.5 w-3.5 text-danger" /> : <UserCheck className="h-3.5 w-3.5 text-accent-display" />}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteEmployee(emp)}
                            title="Supprimer l'employé"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h3 className="font-semibold text-lg text-ink-display">
                {editingEmployee ? "Modifier l'Employé" : "Nouveau Membre du Personnel"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp_mat">Matricule *</Label>
                  <Input
                    id="emp_mat"
                    value={formMatricule}
                    onChange={(e) => setFormMatricule(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="emp_tel">Téléphone</Label>
                  <Input
                    id="emp_tel"
                    placeholder="ex. +229 97 00 11 22"
                    value={formTel}
                    onChange={(e) => setFormTel(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp_nom">Nom de Famille *</Label>
                  <Input
                    id="emp_nom"
                    placeholder="ex. KOFFI"
                    value={formNom}
                    onChange={(e) => setFormNom(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="emp_prenom">Prénom *</Label>
                  <Input
                    id="emp_prenom"
                    placeholder="ex. Jean"
                    value={formPrenom}
                    onChange={(e) => setFormPrenom(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp_agence">Agence d'Affectation</Label>
                  <select
                    id="emp_agence"
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
                  <Label htmlFor="emp_fonction">Fonction Occupée</Label>
                  <select
                    id="emp_fonction"
                    value={formFonctionId}
                    onChange={(e) => setFormFonctionId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    <option value="">Sélectionner une fonction</option>
                    {fonctions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.intitule}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp_qualif">Qualification / Permis</Label>
                  <Input
                    id="emp_qualif"
                    placeholder="ex. Permis D, FIMO, Comptable"
                    value={formQualification}
                    onChange={(e) => setFormQualification(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="emp_embauche">Date d'Embauche</Label>
                  <Input
                    id="emp_embauche"
                    type="date"
                    value={formDateEmbauche}
                    onChange={(e) => setFormDateEmbauche(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-page p-3 border border-hairline flex items-center justify-between">
                <span className="text-sm font-medium text-ink-display">Employé en Service Actif</span>
                <input
                  type="checkbox"
                  checked={formActif}
                  onChange={(e) => setFormActif(e.target.checked)}
                  className="h-5 w-5 rounded border-hairline text-accent focus:ring-accent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-accent text-accent-ink hover:opacity-90">
                  {editingEmployee ? "Mettre à jour" : "Enregistrer l'employé"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
