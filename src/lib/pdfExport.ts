/**
 * Utility functions for exporting branded PDF reports & printable manifests for GTT.
 */

export interface ExportJourneyManifestData {
  trajet: {
    depart: string;
    destination: string;
    date_voyage: string;
    heure_depart: string;
    prix_ticket: number;
    immatriculation?: string;
    chauffeur?: string;
  };
  tickets: Array<{
    numero_facture: string;
    nom_client: string;
    telephone: string;
    numero_siege: number;
    etat: string;
  }>;
  agenceNom?: string;
}

export interface ExportParcelManifestData {
  trajet: {
    depart: string;
    destination: string;
    date_voyage: string;
    immatriculation?: string;
  };
  parcels: Array<{
    code_suivi: string;
    expediteur_nom: string;
    expediteur_tel: string;
    destinataire_nom: string;
    destinataire_tel: string;
    description: string;
    priorite: string;
    etat: string;
  }>;
  agenceNom?: string;
}

export interface ExportCashLedgerData {
  agenceNom: string;
  solde: {
    total_credit: number;
    total_debit: number;
    solde: number;
  };
  mouvements: Array<{
    date_mvt: string;
    heure_mvt: string;
    libelle: string;
    type: "Crédit" | "Débit";
    credit: number;
    debit: number;
    source: string;
    details?: string | null;
  }>;
}

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

/**
 * Generate Printable Passenger Manifest HTML & Trigger Print Dialog (PDF Export)
 */
export function exportJourneyManifestPDF(data: ExportJourneyManifestData) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Manifeste Passagers - ${data.trajet.depart} vers ${data.trajet.destination}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 20px; line-height: 1.5; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px; }
        .logo-title { display: flex; align-items: center; gap: 15px; }
        .logo-title img { height: 50px; }
        .company-name { font-size: 20px; font-weight: bold; color: #0f766e; }
        .doc-title { font-size: 14px; text-transform: uppercase; color: #64748b; font-weight: bold; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1fr solid #e2e8f0; }
        .info-item { font-size: 13px; }
        .info-item strong { color: #0f766e; display: block; text-transform: uppercase; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { background: #0f766e; color: white; text-align: left; padding: 8px 12px; font-weight: 600; text-transform: uppercase; font-size: 11px; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; pt-10px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
        @media print {
          @page { margin: 15mm; }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-title">
          <img src="/logo.png" alt="GTT Logo" />
          <div>
            <div class="company-name">G'NANZE TRANSPORT ET TOURISME</div>
            <div class="doc-title">MANIFESTE D'EMBARQUEMENT PASSAGERS</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          <strong>Date d'Émission:</strong> ${new Date().toLocaleDateString("fr-FR")}<br/>
          <strong>Agence:</strong> ${data.agenceNom || "Réseau Global"}
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item"><strong>Ligne & Trajet</strong>${data.trajet.depart} ➔ ${data.trajet.destination}</div>
        <div class="info-item"><strong>Date & Heure Départ</strong>${data.trajet.date_voyage} à ${data.trajet.heure_depart}</div>
        <div class="info-item"><strong>Bus / Immatriculation</strong>${data.trajet.immatriculation || "Bus Attribué"}</div>
        <div class="info-item"><strong>Conducteur</strong>${data.trajet.chauffeur || "Chauffeur Titulaire"}</div>
        <div class="info-item"><strong>Prix du Billet</strong>${currencyFormatter.format(data.trajet.prix_ticket)}</div>
        <div class="info-item"><strong>Passagers Réservés</strong>${data.tickets.length} Occupants</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 60px;">N° Siège</th>
            <th>N° Billet</th>
            <th>Nom & Prénom Passager</th>
            <th>Téléphone</th>
            <th>Statut Billet</th>
            <th>Émargement</th>
          </tr>
        </thead>
        <tbody>
          ${data.tickets
            .sort((a, b) => a.numero_siege - b.numero_siege)
            .map(
              (t) => `
            <tr>
              <td style="font-weight: bold; text-align: center;">${t.numero_siege}</td>
              <td style="font-family: monospace; font-weight: bold; color: #0f766e;">${t.numero_facture}</td>
              <td>${t.nom_client}</td>
              <td>${t.telephone || "—"}</td>
              <td>${t.etat}</td>
              <td style="border-bottom: 1px underline #cbd5e1; width: 100px;"></td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <div class="footer">
        <div>G'NANZE Transport & Tourisme — Document Officiel d'Embarquement</div>
        <div>Page 1 / 1</div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Generate Printable Parcel Manifest HTML & Trigger Print Dialog (PDF Export)
 */
export function exportParcelsManifestPDF(data: ExportParcelManifestData) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Bordereau Livraison Colis - ${data.trajet.depart} vers ${data.trajet.destination}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 20px; line-height: 1.5; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px; }
        .logo-title { display: flex; align-items: center; gap: 15px; }
        .logo-title img { height: 50px; }
        .company-name { font-size: 20px; font-weight: bold; color: #0f766e; }
        .doc-title { font-size: 14px; text-transform: uppercase; color: #64748b; font-weight: bold; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1fr solid #e2e8f0; }
        .info-item { font-size: 13px; }
        .info-item strong { color: #0f766e; display: block; text-transform: uppercase; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { background: #0f766e; color: white; text-align: left; padding: 8px 12px; font-weight: 600; text-transform: uppercase; font-size: 11px; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; pt-10px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
        @media print {
          @page { margin: 15mm; }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-title">
          <img src="/logo.png" alt="GTT Logo" />
          <div>
            <div class="company-name">G'NANZE TRANSPORT ET TOURISME</div>
            <div class="doc-title">BORDEREAU DE LIVRAISON DE COLIS</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          <strong>Date d'Émission:</strong> ${new Date().toLocaleDateString("fr-FR")}<br/>
          <strong>Agence Départ:</strong> ${data.agenceNom || "Réseau Global"}
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item"><strong>Trajet d'Acheminement</strong>${data.trajet.depart} ➔ ${data.trajet.destination}</div>
        <div class="info-item"><strong>Date Voyage</strong>${data.trajet.date_voyage}</div>
        <div class="info-item"><strong>Bus / Immatriculation</strong>${data.trajet.immatriculation || "Bus Attribué"}</div>
        <div class="info-item"><strong>Total Colis Embarqués</strong>${data.parcels.length} Colis</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>N° Suivi Colis</th>
            <th>Expéditeur & Contact</th>
            <th>Destinataire & Contact</th>
            <th>Description Colis</th>
            <th>Priorité</th>
            <th>Émargement Réception</th>
          </tr>
        </thead>
        <tbody>
          ${data.parcels
            .map(
              (p) => `
            <tr>
              <td style="font-family: monospace; font-weight: bold; color: #0f766e;">${p.code_suivi}</td>
              <td>${p.expediteur_nom}<br/><small style="color: #64748b;">${p.expediteur_tel}</small></td>
              <td>${p.destinataire_nom}<br/><small style="color: #64748b;">${p.destinataire_tel}</small></td>
              <td>${p.description}</td>
              <td><strong>${p.priorite}</strong></td>
              <td style="border-bottom: 1px underline #cbd5e1; width: 100px;"></td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <div class="footer">
        <div>G'NANZE Transport & Tourisme — Suivi & Fret Colis</div>
        <div>Page 1 / 1</div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Generate Printable Cash Ledger Statement HTML & Trigger Print Dialog (PDF Export)
 */
export function exportCashLedgerPDF(data: ExportCashLedgerData) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport Financier & Journal de Caisse - ${data.agenceNom}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 20px; line-height: 1.5; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px; }
        .logo-title { display: flex; align-items: center; gap: 15px; }
        .logo-title img { height: 50px; }
        .company-name { font-size: 20px; font-weight: bold; color: #0f766e; }
        .doc-title { font-size: 14px; text-transform: uppercase; color: #64748b; font-weight: bold; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1fr solid #e2e8f0; }
        .info-item { font-size: 13px; }
        .info-item strong { color: #0f766e; display: block; text-transform: uppercase; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { background: #0f766e; color: white; text-align: left; padding: 8px 12px; font-weight: 600; text-transform: uppercase; font-size: 11px; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .credit { color: #0f766e; font-weight: bold; }
        .debit { color: #e11d48; font-weight: bold; }
        .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; pt-10px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
        @media print {
          @page { margin: 15mm; }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-title">
          <img src="/logo.png" alt="GTT Logo" />
          <div>
            <div class="company-name">G'NANZE TRANSPORT ET TOURISME</div>
            <div class="doc-title">JOURNAL DE CAISSE & SOLDE FINANCIER</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          <strong>Date d'Émission:</strong> ${new Date().toLocaleDateString("fr-FR")}<br/>
          <strong>Périmètre Agence:</strong> ${data.agenceNom}
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item"><strong>Crédits Totaux (Encaissements)</strong><span class="credit">${currencyFormatter.format(data.solde.total_credit)}</span></div>
        <div class="info-item"><strong>Débits Totaux (Décaissements)</strong><span class="debit">${currencyFormatter.format(data.solde.total_debit)}</span></div>
        <div class="info-item"><strong>Solde Net de Caisse</strong><span style="font-size: 16px; font-weight: bold;">${currencyFormatter.format(data.solde.solde)}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date & Heure</th>
            <th>Origine</th>
            <th>Libellé Opération</th>
            <th>Détails</th>
            <th style="text-align: right;">Crédit (+)</th>
            <th style="text-align: right;">Débit (-)</th>
          </tr>
        </thead>
        <tbody>
          ${data.mouvements
            .map(
              (m) => `
            <tr>
              <td>${m.date_mvt} ${m.heure_mvt ? m.heure_mvt.slice(0, 5) : ""}</td>
              <td><strong>${m.source}</strong></td>
              <td>${m.libelle}</td>
              <td style="color: #64748b; font-size: 11px;">${m.details || "—"}</td>
              <td style="text-align: right;" class="credit">${m.credit > 0 ? "+" + currencyFormatter.format(m.credit) : "—"}</td>
              <td style="text-align: right;" class="debit">${m.debit > 0 ? "-" + currencyFormatter.format(m.debit) : "—"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <div class="footer">
        <div>G'NANZE Transport & Tourisme — Service Comptabilité & Caisse</div>
        <div>Page 1 / 1</div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
