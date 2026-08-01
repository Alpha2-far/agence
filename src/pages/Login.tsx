import * as React from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Login() {
  const { signIn, configured } = useAuth();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await signIn(username, password);
    if (result.error) setError(result.error);
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6 py-12">
      <section className="w-full max-w-md rounded-xl border border-hairline bg-surface p-8 shadow-sm">
        <img src="/logo.png" alt="G'NANZE Transport et Tourisme" className="mx-auto h-28 w-auto object-contain" />
        <div className="mt-6 text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Espace professionnel</p><h1 className="mt-2 text-2xl font-semibold text-ink-display">Connexion</h1><p className="mt-2 text-sm text-ink-muted">Accédez aux opérations de votre agence.</p></div>
        {!configured && <div className="mt-6 rounded-md border border-signal/60 bg-signal-faded p-3 text-sm text-signal-display">Ajoutez la clé publique Supabase dans `.env` pour activer la connexion.</div>}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label>Nom d'utilisateur<Input className="mt-1" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label>Mot de passe<Input className="mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="text-sm text-danger-display" role="alert">{error}</p>}
          <Button className="w-full" disabled={!configured || submitting} type="submit"><LockKeyhole className="h-4 w-4" />{submitting ? "Connexion..." : "Se connecter"}<ArrowRight className="ml-auto h-4 w-4" /></Button>
        </form>
      </section>
    </main>
  );
}
