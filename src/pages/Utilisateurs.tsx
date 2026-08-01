import * as React from "react";
import {
  Building2,
  Edit2,
  KeyRound,
  Plus,
  Search,
  Shield,
  UserCheck,
  UserCog,
  UserX,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { type AppRole } from "@/lib/access";
import { createScopedSupabaseClient } from "@/lib/supabase";

export type UserAccountItem = {
  id: string;
  nom_utilisateur: string;
  type: AppRole;
  employe_id: string | null;
  agence_id: string | null;
  actif: boolean;
  created_at?: string;
  // Joined fields
  agence?: { nom: string; ville: string } | null;
  employe?: { nom: string; prenom: string } | null;
};

type EmployeeOption = { id: string; nom: string; prenom: string; matricule: string };
type AgencyOption = { id: string; nom: string; ville: string };

export function Utilisateurs() {
  const { user } = useAuth();
  const isSuperAdmin = user?.type === "SuperAdmin";

  const [userAccounts, setUserAccounts] = React.useState<UserAccountItem[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [agencies, setAgencies] = React.useState<AgencyOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserAccountItem | null>(null);

  // Form Fields
  const [formUsername, setFormUsername] = React.useState("");
  const [formPassword, setFormPassword] = React.useState("");
  const [formTypeRole, setFormTypeRole] = React.useState<AppRole>("user");
  const [formEmployeId, setFormEmployeId] = React.useState("");
  const [formAgenceId, setFormAgenceId] = React.useState("");
  const [formActif, setFormActif] = React.useState(true);
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
      const [usrRes, empRes, agRes] = await Promise.all([
        client
          .from("utilisateur")
          .select(`
            *,
            agence:agence_id(nom, ville),
            employe:employe_id(nom, prenom)
          `)
          .order("nom_utilisateur"),
        client.from("employe").select("id, nom, prenom, matricule").order("nom"),
        client.from("agence").select("id, nom, ville").order("nom"),
      ]);

      if (usrRes.error) throw usrRes.error;
      setUserAccounts((usrRes.data as unknown as UserAccountItem[]) ?? []);

      if (empRes.data) setEmployees(empRes.data as EmployeeOption[]);
      if (agRes.data) setAgencies(agRes.data as AgencyOption[]);
    } catch (err: unknown) {
      console.error(err);
      setError("Impossible de charger les comptes utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormPassword("");
    setFormTypeRole("user");
    setFormEmployeId("");
    setFormAgenceId("");
    setFormActif(true);
    setIsModalOpen(true);
  };

  const openEditModal = (u: UserAccountItem) => {
    setEditingUser(u);
    setFormUsername(u.nom_utilisateur);
    setFormPassword(""); // Left empty unless changing
    setFormTypeRole(u.type);
    setFormEmployeId(u.employe_id || "");
    setFormAgenceId(u.agence_id || "");
    setFormActif(u.actif);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formUsername.trim()) return;
    if (!editingUser && !formPassword) {
      toastError("Veuillez saisir un mot de passe pour le nouveau compte.");
      return;
    }
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSubmitting(true);
    try {
      const cleanEmployeId = formEmployeId && formEmployeId.trim() !== "" ? formEmployeId : null;
      const cleanAgenceId = formAgenceId && formAgenceId.trim() !== "" ? formAgenceId : null;

      // 1. Attempt stored RPC save_utilisateur (runs SECURITY DEFINER to bypass RLS)
      const { error: rpcErr } = await client.rpc("save_utilisateur", {
        p_id: editingUser ? editingUser.id : null,
        p_nom_utilisateur: formUsername.trim().toLowerCase(),
        p_mot_de_passe: formPassword || "",
        p_type: formTypeRole,
        p_employe_id: cleanEmployeId,
        p_agence_id: cleanAgenceId,
        p_actif: formActif,
      });

      if (rpcErr) {
        console.warn("RPC save_utilisateur failed, fallback to direct table operation:", rpcErr);
        if (editingUser) {
          const updatePayload: Record<string, unknown> = {
            nom_utilisateur: formUsername.trim().toLowerCase(),
            type: formTypeRole,
            employe_id: cleanEmployeId,
            agence_id: cleanAgenceId,
            actif: formActif,
          };
          if (formPassword) {
            updatePayload.mot_de_passe = formPassword;
          }
          const { error: directErr } = await client
            .from("utilisateur")
            .update(updatePayload)
            .eq("id", editingUser.id);
          if (directErr) throw directErr;
        } else {
          const insertPayload: Record<string, unknown> = {
            nom_utilisateur: formUsername.trim().toLowerCase(),
            mot_de_passe: formPassword,
            type: formTypeRole,
            employe_id: cleanEmployeId,
            agence_id: cleanAgenceId,
            actif: formActif,
          };
          const { error: directErr } = await client
            .from("utilisateur")
            .insert(insertPayload);
          if (directErr) throw directErr;
        }
      }

      setIsModalOpen(false);
      toastSuccess(editingUser ? "Compte utilisateur mis à jour." : "Compte utilisateur créé avec succès.");
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
      if (errMsg.includes("42501") || errMsg.includes("row-level security")) {
        toastError("Erreur RLS Supabase (42501) : veuillez ré-exécuter le script SQL dans votre SQL Editor.");
      } else {
        toastError(`Erreur lors de l'enregistrement : ${errMsg}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: UserAccountItem) => {
    if (!user) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: rpcErr } = await client.rpc("save_utilisateur", {
        p_id: u.id,
        p_nom_utilisateur: u.nom_utilisateur,
        p_mot_de_passe: "",
        p_type: u.type,
        p_employe_id: u.employe_id,
        p_agence_id: u.agence_id,
        p_actif: !u.actif,
      });

      if (rpcErr) {
        const { error: directErr } = await client
          .from("utilisateur")
          .update({ actif: !u.actif })
          .eq("id", u.id);
        if (directErr) throw directErr;
      }
      toastSuccess("Statut du compte mis à jour.");
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
      toastError(`Erreur changement d'état : ${errMsg}`);
    }
  };

  const handleDeleteUser = async (u: UserAccountItem) => {
    if (!user) return;
    if (!confirm(`Voulez-vous vraiment supprimer le compte "${u.nom_utilisateur}" ?`)) return;
    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    try {
      const { error: delErr } = await client.from("utilisateur").delete().eq("id", u.id);
      if (delErr) throw delErr;
      toastSuccess("Compte utilisateur supprimé.");
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
      toastError(`Erreur lors de la suppression : ${errMsg}`);
    }
  };

  const filteredUsers = userAccounts.filter((u) => {
    const matchesSearch =
      u.nom_utilisateur.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.employe && `${u.employe.nom} ${u.employe.prenom}`.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === "all" || u.type === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3">
            <UserCog className="h-8 w-8 text-accent-display" />
            Gestion des Comptes Utilisateurs
          </h1>
          <p className="mt-1 text-ink-muted">
            Créez les identifiants d'accès applicatifs, attribuez les rôles et associez chaque compte à son agence.
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
            <Plus className="h-4 w-4" />
            Nouveau Compte
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
            placeholder="Rechercher nom d'utilisateur, employé lié..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
          >
            <option value="all">Tous les rôles</option>
            <option value="user">Utilisateur (Caissier / Secrétaire)</option>
            <option value="Admin">Admin (Chef Agence)</option>
            <option value="SuperAdmin">SuperAdmin (Réseau)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center text-ink-muted">
          Chargement des comptes utilisateurs...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-12 text-center">
          <UserCog className="mx-auto h-12 w-12 text-ink-muted" />
          <h3 className="mt-4 font-semibold text-lg text-ink-display">Aucun compte trouvé</h3>
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-page/50 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-6 py-3">Identifiant</th>
                  <th className="px-6 py-3">Rôle d'Accès</th>
                  <th className="px-6 py-3">Employé Lié</th>
                  <th className="px-6 py-3">Agence Rattachée</th>
                  <th className="px-6 py-3">Statut</th>
                  {isSuperAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink-display">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-page/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-accent-display whitespace-nowrap">
                      {u.nom_utilisateur}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        tone={
                          u.type === "SuperAdmin"
                            ? "accent"
                            : u.type === "Admin"
                            ? "signal"
                            : "neutral"
                        }
                      >
                        <Shield className="h-3 w-3 mr-1 inline" />
                        {u.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-medium whitespace-nowrap">
                      {u.employe ? `${u.employe.nom} ${u.employe.prenom}` : "Compte Système"}
                    </td>
                    <td className="px-6 py-4 text-ink-muted whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {u.agence?.nom ?? "Toutes les agences"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge tone={u.actif ? "accent" : "muted"}>
                        {u.actif ? "Actif" : "Désactivé"}
                      </Badge>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(u)}
                            title="Modifier compte / Mot de passe"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(u)}
                            title={u.actif ? "Désactiver" : "Activer"}
                          >
                            {u.actif ? <UserX className="h-3.5 w-3.5 text-danger" /> : <UserCheck className="h-3.5 w-3.5 text-accent-display" />}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteUser(u)}
                            title="Supprimer le compte"
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h3 className="font-semibold text-lg text-ink-display">
                {editingUser ? "Modifier le Compte Utilisateur" : "Nouveau Compte Applicatif"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-muted hover:text-ink-display">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="usr_name">Nom d'Utilisateur / Identifiant *</Label>
                <Input
                  id="usr_name"
                  placeholder="ex. caissier_parakou"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="usr_pass">
                  {editingUser ? "Nouveau Mot de Passe (laisser vide pour ne pas modifier)" : "Mot de Passe *"}
                </Label>
                <div className="relative">
                  <Input
                    id="usr_pass"
                    type="password"
                    placeholder="••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                  <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="usr_role">Rôle & Niveau d'Accès</Label>
                  <select
                    id="usr_role"
                    value={formTypeRole}
                    onChange={(e) => setFormTypeRole(e.target.value as AppRole)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    <option value="user">user (Billetterie / Caissier)</option>
                    <option value="Admin">Admin (Chef d'Agence)</option>
                    <option value="SuperAdmin">SuperAdmin (Gestion Réseau)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="usr_agence">Agence Rattachée</Label>
                  <select
                    id="usr_agence"
                    value={formAgenceId}
                    onChange={(e) => setFormAgenceId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                  >
                    <option value="">Toutes / Réseau Global</option>
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nom} ({a.ville})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="usr_employe">Employé Associé</Label>
                <select
                  id="usr_employe"
                  value={formEmployeId}
                  onChange={(e) => setFormEmployeId(e.target.value)}
                  className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-display"
                >
                  <option value="">Aucun / Compte Système</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom} {e.prenom} ({e.matricule})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg bg-page p-3 border border-hairline flex items-center justify-between">
                <span className="text-sm font-medium text-ink-display">Compte Actif (Autoriser la connexion)</span>
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
                <Button type="submit" disabled={submitting} className="bg-accent text-accent-ink hover:opacity-90">
                  {submitting ? "Enregistrement..." : "Enregistrer le compte"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
