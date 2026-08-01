import * as React from "react";
import {
  ArrowRight,
  BusFront,
  CircleDollarSign,
  Package,
  ReceiptText,
  Search,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { createScopedSupabaseClient } from "@/lib/supabase";

type SearchResultItem = {
  id: string;
  type: "Ticket" | "Colis" | "Trajet" | "Bus" | "Employe" | "Caisse";
  title: string;
  subtitle: string;
  route: string;
};

export function GlobalSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open trigger handled outside
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const runSearch = React.useCallback(async (q: string) => {
    if (!q.trim() || !user) {
      setResults([]);
      return;
    }

    const client = createScopedSupabaseClient({ agenceId: user.agence_id, role: user.type });
    if (!client) return;

    setSearching(true);
    const searchTerm = `%${q.trim()}%`;
    const hits: SearchResultItem[] = [];

    try {
      // 1. Search Tickets (facture)
      const { data: tickets } = await client
        .from("facture")
        .select("id, numero_facture, nom_client, telephone, etat")
        .or(`numero_facture.ilike.${searchTerm},nom_client.ilike.${searchTerm},telephone.ilike.${searchTerm}`)
        .limit(5);

      if (tickets) {
        tickets.forEach((t) => {
          hits.push({
            id: t.id,
            type: "Ticket",
            title: `${t.numero_facture} · ${t.nom_client}`,
            subtitle: `Statut: ${t.etat} | Tél: ${t.telephone || "N/A"}`,
            route: "/tickets",
          });
        });
      }

      // 2. Search Parcels (colis)
      const { data: parcels } = await client
        .from("colis")
        .select("id, numero, envoyeur, receveur, statut")
        .or(`numero.ilike.${searchTerm},envoyeur.ilike.${searchTerm},receveur.ilike.${searchTerm}`)
        .limit(5);

      if (parcels) {
        parcels.forEach((p) => {
          hits.push({
            id: p.id,
            type: "Colis",
            title: `${p.numero} · Exp: ${p.envoyeur} ➔ Rec: ${p.receveur}`,
            subtitle: `Statut: ${p.statut}`,
            route: "/colis",
          });
        });
      }

      // 3. Search Journeys (trajet)
      const { data: journeys } = await client
        .from("trajet")
        .select("id, depart, destination, date_voyage, heure_depart")
        .or(`depart.ilike.${searchTerm},destination.ilike.${searchTerm}`)
        .limit(5);

      if (journeys) {
        journeys.forEach((j) => {
          hits.push({
            id: j.id,
            type: "Trajet",
            title: `Trajet ${j.depart} ➔ ${j.destination}`,
            subtitle: `Date: ${j.date_voyage} à ${j.heure_depart.slice(0, 5)}`,
            route: "/trajets",
          });
        });
      }

      // 4. Search Buses (vehicule)
      const { data: buses } = await client
        .from("vehicule")
        .select("id, immatriculation, marque, type, etat")
        .or(`immatriculation.ilike.${searchTerm},marque.ilike.${searchTerm}`)
        .limit(5);

      if (buses) {
        buses.forEach((b) => {
          hits.push({
            id: b.id,
            type: "Bus",
            title: `Bus ${b.immatriculation} (${b.marque || "GTT"})`,
            subtitle: `État: ${b.etat} | Type: ${b.type || "Minibus"}`,
            route: "/parc",
          });
        });
      }

      // 5. Search Staff (employe)
      const { data: staff } = await client
        .from("employe")
        .select("id, matricule, nom, prenom, telephone")
        .or(`matricule.ilike.${searchTerm},nom.ilike.${searchTerm},prenom.ilike.${searchTerm}`)
        .limit(5);

      if (staff) {
        staff.forEach((e) => {
          hits.push({
            id: e.id,
            type: "Employe",
            title: `${e.matricule} · ${e.nom} ${e.prenom}`,
            subtitle: `Tél: ${e.telephone || "N/A"}`,
            route: "/employes",
          });
        });
      }

      setResults(hits);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }, [user]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  if (!isOpen) return null;

  const getIcon = (type: SearchResultItem["type"]) => {
    switch (type) {
      case "Ticket":
        return <ReceiptText className="h-4 w-4 text-accent-display" />;
      case "Colis":
        return <Package className="h-4 w-4 text-accent-display" />;
      case "Trajet":
        return <BusFront className="h-4 w-4 text-accent-display" />;
      case "Bus":
        return <Wrench className="h-4 w-4 text-accent-display" />;
      case "Employe":
        return <UsersRound className="h-4 w-4 text-accent-display" />;
      default:
        return <CircleDollarSign className="h-4 w-4 text-accent-display" />;
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    onClose();
    navigate(item.route);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-hairline bg-surface p-4 shadow-2xl space-y-4">
        {/* Search Header */}
        <div className="relative flex items-center border-b border-hairline pb-3">
          <Search className="absolute left-3 h-5 w-5 text-ink-muted" />
          <Input
            autoFocus
            placeholder="Recherche globale (billet TKT-, colis COL-, nom, bus BR-...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 text-base border-none shadow-none focus-visible:ring-0"
          />
          <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink-display">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto pr-1">
          {searching ? (
            <p className="py-8 text-center text-sm text-ink-muted">Recherche en cours...</p>
          ) : query.trim() && results.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Aucun résultat trouvé pour "{query}".</p>
          ) : !query.trim() ? (
            <div className="py-6 text-center text-xs text-ink-muted">
              Tapez un numéro de billet <code className="font-mono text-accent-display">TKT-</code>, numéro de colis <code className="font-mono text-accent-display">COL-</code>, nom de passager ou immatriculation pour chercher instantanément.
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {results.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    onClick={() => handleSelectResult(r)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-page transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-faded border border-accent-display/20">
                        {getIcon(r.type)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-ink-display group-hover:text-accent-display">
                          {r.title}
                        </p>
                        <p className="text-xs text-ink-muted">{r.subtitle}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-muted group-hover:text-accent-display transition-transform group-hover:translate-x-1" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
