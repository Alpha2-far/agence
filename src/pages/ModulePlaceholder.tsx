import type { LucideIcon } from "lucide-react";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ModulePlaceholder({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div><h1>{title}</h1><p className="mt-2 text-ink-muted">{description}</p></div>
        <Badge tone="signal">À construire</Badge>
      </div>
      <section className="mt-8 rounded-xl border border-hairline bg-surface p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-faded text-accent-display"><Icon className="h-6 w-6" /></div>
        <h2 className="mt-6">Module planifié</h2>
        <p className="mt-2 max-w-2xl text-ink-muted">Cette entrée est déjà protégée par rôle et intégrée à la navigation. Ses écrans métier seront réalisés dans le milestone correspondant du PRD.</p>
        <div className="mt-6 flex items-center gap-2 text-sm text-ink-muted"><Clock3 className="h-4 w-4" />Le prochain développement peut commencer ici sans refaire le shell.</div>
      </section>
    </div>
  );
}
