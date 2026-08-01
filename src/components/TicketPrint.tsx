import * as React from "react";
import { Printer, Ticket as TicketIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TicketPrintData = {
  numero_facture: string;
  nom_client: string;
  telephone_client?: string;
  depart: string;
  destination: string;
  gare_depart?: string;
  gare_arrivee?: string;
  date_voyage: string;
  heure_depart: string;
  montant: number;
  date_facture?: string;
  heure_facture?: string;
  agence_nom?: string;
  agence_telephone?: string;
  vendeur_nom?: string;
};

type TicketPrintProps = {
  ticket: TicketPrintData | null;
  onClose: () => void;
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function TicketPrintModal({ ticket, onClose }: TicketPrintProps) {
  if (!ticket) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedVoyageDate = new Date(`${ticket.date_voyage}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl border border-hairline bg-surface shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2 text-ink-display">
            <TicketIcon className="h-5 w-5 text-accent-display" />
            <h3 className="font-semibold text-lg">Aperçu du Ticket (57 mm)</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-page hover:text-ink-display transition-colors"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content - Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-page/50 flex justify-center">
          {/* Thermal Ticket 57mm Visual Box */}
          <div
            id="thermal-ticket-print"
            className="w-[280px] rounded-lg bg-white p-4 text-black shadow-md font-mono text-xs leading-tight print:w-[57mm] print:p-1 print:shadow-none"
          >
            {/* Header / Branding */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400">
              <img src="/logo.png" alt="Logo GTT" className="mx-auto h-12 w-auto object-contain mb-1" />
              <p className="font-bold text-sm tracking-wide text-gray-900 uppercase">G'NANZE TRANSPORT</p>
              <p className="text-[10px] text-gray-600">ET TOURISME</p>
              <p className="mt-1 text-[11px] font-semibold text-gray-800">{ticket.agence_nom ?? "AGENCE BENIN"}</p>
              {ticket.agence_telephone && (
                <p className="text-[10px] text-gray-600">Tél: {ticket.agence_telephone}</p>
              )}
            </div>

            {/* Ticket Identifier */}
            <div className="my-2 py-1 text-center bg-gray-100 rounded border border-gray-300">
              <p className="text-[10px] uppercase text-gray-600">Billet N°</p>
              <p className="font-bold text-sm text-gray-900 tracking-wider">{ticket.numero_facture}</p>
            </div>

            {/* Trip Details */}
            <div className="space-y-1.5 py-2 border-b border-dashed border-gray-400 text-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-600">Trajet:</span>
                <span className="font-bold text-gray-900">{ticket.depart} → {ticket.destination}</span>
              </div>
              {ticket.gare_depart && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Gare Départ:</span>
                  <span className="font-medium text-gray-900">{ticket.gare_depart}</span>
                </div>
              )}
              {ticket.gare_arrivee && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Gare Arrivée:</span>
                  <span className="font-medium text-gray-900">{ticket.gare_arrivee}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Date voyage:</span>
                <span className="font-bold text-gray-900">{formattedVoyageDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Heure départ:</span>
                <span className="font-bold text-gray-900">{ticket.heure_depart.slice(0, 5)}</span>
              </div>
            </div>

            {/* Passenger Info */}
            <div className="space-y-1 py-2 border-b border-dashed border-gray-400 text-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-600">Passager:</span>
                <span className="font-bold text-gray-900">{ticket.nom_client}</span>
              </div>
              {ticket.telephone_client && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Téléphone:</span>
                  <span className="font-medium text-gray-900">{ticket.telephone_client}</span>
                </div>
              )}
            </div>

            {/* Price & Payment */}
            <div className="py-3 text-center border-b border-dashed border-gray-400">
              <p className="text-[10px] uppercase text-gray-600">Tarif Réglé</p>
              <p className="font-bold text-base text-gray-900 mt-0.5">{currencyFormatter.format(ticket.montant)}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-800 uppercase">
                PAYÉ - CAISSE AGENCE
              </span>
            </div>

            {/* Footer / Barcode decoration */}
            <div className="pt-2 text-center text-[9px] text-gray-500 space-y-1">
              <div className="font-mono text-center tracking-widest text-[14px] text-gray-800 my-1">
                |||| ||| ||||| |||| ||||
              </div>
              <p>Émis le {ticket.date_facture ?? new Date().toLocaleDateString("fr-FR")} {ticket.heure_facture ? `à ${ticket.heure_facture.slice(0, 5)}` : ""}</p>
              {ticket.vendeur_nom && <p>Agent: {ticket.vendeur_nom}</p>}
              <p className="italic pt-1">Bon voyage avec G'NANZE Transport !</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-hairline px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={handlePrint} className="gap-2 bg-accent text-accent-ink hover:opacity-90">
            <Printer className="h-4 w-4" />
            Imprimer (57 mm)
          </Button>
        </div>
      </div>

      {/* Global CSS for Print Window */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-ticket-print, #thermal-ticket-print * {
            visibility: visible;
          }
          #thermal-ticket-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 57mm !important;
            margin: 0;
            padding: 2mm !important;
            box-shadow: none !original;
            background: white !important;
            color: black !important;
          }
          @page {
            size: 57mm auto;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
}
