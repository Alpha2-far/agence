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
      const { data, error } = await supabase.rpc("login_user", {
        p_username: username,
        p_password_plain: password,
      });
      const nextUser = (data as LegacyUser[] | null)?.[0];
      if (error || !nextUser) return { error: "Identifiants invalides ou compte inactif." };
      setUser(nextUser);
      window.localStorage.setItem("gnanze-user", JSON.stringify(nextUser));
      return {};
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
