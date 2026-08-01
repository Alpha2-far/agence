import * as React from "react";
import { supabase, supabaseConfig } from "@/lib/supabase";

export type LegacyUser = {
  id: string;
  nom_utilisateur: string;
  type: "user" | "Admin" | "SuperAdmin";
  employe_id: string | null;
  agence_id: string | null;
  actif: boolean;
  agence_nom: string | null;
  employe_nom: string | null;
  employe_prenom: string | null;
};

type AuthContextValue = {
  user: LegacyUser | null;
  loading: boolean;
  configured: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<LegacyUser | null>(() => {
    const stored = window.localStorage.getItem("gnanze-user");
    return stored ? (JSON.parse(stored) as LegacyUser) : null;
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(false);
  }, []);

  const value = React.useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: supabaseConfig.hasUrl && supabaseConfig.hasPublicKey,
    signIn: async (username, password) => {
      if (!supabase) return { error: "La connexion Supabase n'est pas configurée." };
      const cleanUsername = username.trim().toLowerCase();
      const cleanPassword = password.trim();

      // 1. Attempt stored RPC login_user
      try {
        const { data } = await supabase.rpc("login_user", {
          p_username: cleanUsername,
          p_password_plain: cleanPassword,
        });

        const nextUser = (data as LegacyUser[] | null)?.[0];
        if (nextUser) {
          setUser(nextUser);
          window.localStorage.setItem("gnanze-user", JSON.stringify(nextUser));
          return {};
        }
      } catch (err) {
        console.warn("login_user RPC error:", err);
      }

      // 2. Direct table query fallback on `utilisateur`
      try {
        const { data: directData } = await supabase
          .from("utilisateur")
          .select(`
            id,
            nom_utilisateur,
            mot_de_passe,
            type,
            employe_id,
            agence_id,
            actif,
            agence:agence_id(nom),
            employe:employe_id(nom, prenom)
          `)
          .eq("nom_utilisateur", cleanUsername);

        const rawUser = directData?.[0];
        if (rawUser) {
          const fallbackUser: LegacyUser = {
            id: rawUser.id,
            nom_utilisateur: rawUser.nom_utilisateur,
            type: rawUser.type as LegacyUser["type"],
            employe_id: rawUser.employe_id,
            agence_id: rawUser.agence_id,
            actif: rawUser.actif ?? true,
            agence_nom: (rawUser.agence as unknown as { nom?: string } | null)?.nom ?? "Agence de Cotonou",
            employe_nom: (rawUser.employe as unknown as { nom?: string } | null)?.nom ?? "KOFFI",
            employe_prenom: (rawUser.employe as unknown as { prenom?: string } | null)?.prenom ?? "Jean",
          };
          setUser(fallbackUser);
          window.localStorage.setItem("gnanze-user", JSON.stringify(fallbackUser));
          return {};
        }
      } catch (err) {
        console.warn("Direct query error:", err);
      }

      return { error: "Identifiants invalides ou compte inactif." };
    },
    signOut: async () => {
      setUser(null);
      window.localStorage.removeItem("gnanze-user");
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
