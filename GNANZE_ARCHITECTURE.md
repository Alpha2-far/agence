# GNANZE TRANSPORT — Architecture Technique

## Stack retenue
- **Frontend** : React + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Impression ticket** : react-thermal-printer ou génération HTML → PDF 57mm
- **Déploiement** : Vercel (front) + Supabase Cloud

---

## Schéma des relations

```
AGENCE
  ├── EMPLOYE (fonction_id → FONCTION)
  │     └── UTILISATEUR
  ├── VEHICULE
  │     └── MAINTENANCE → MOUVEMENT (Débit auto)
  └── TRAJET (conducteur_id, vehicule_id)
        ├── FACTURE (client_id) → REGLEMENT → MOUVEMENT (Crédit auto)
        ├── RESERVATION (client_id) ──conversion──▶ FACTURE
        └── COLIS
```

---

## Flux métier

### Flux 1 — Client en agence (vente directe)
```
Caissier sélectionne TRAJET
  → Saisit nom client
  → Système affiche tarif_standard
  → Client accepte → INSERT facture (etat='Non Payé')
  → Paiement reçu → INSERT reglement
  → Trigger auto : facture.etat → 'Payé' + INSERT mouvement Crédit
  → Impression ticket 57mm
```

### Flux 2 — Réservation téléphonique
```
Standard reçoit appel
  → INSERT reservation (statut='En Attente')
  → Le jour J : reservation.statut → 'Convertie'
  → INSERT facture (reservation_id = reservation.id)
  → Même flux que Flux 1 à partir du paiement
```

### Flux 3 — Préparation trajet
```
Chef agence crée TRAJET (date, heure, conducteur, véhicule)
  → Vue vue_occupation_trajet calcule automatiquement :
     - nb_passagers_confirmes (factures payées)
     - nb_reservations_actives (réservations non converties)
     - places_disponibles = capacite - passagers - reservations
  → Toutes les factures et réservations du même trajet/date/heure
    sont visibles dans l'interface de préparation
```

### Flux 4 — Dépôt colis
```
Client dépose colis
  → INSERT colis (statut='En Attente', priorite=1/2/3)
  → Chef agence assigne à un trajet : colis.trajet_id → trajet.id
  → colis.statut → 'Assigné'
  → À l'arrivée : colis.statut → 'Livré'
```

### Flux 5 — Maintenance véhicule
```
INSERT maintenance (vehicule_id, type, cout)
  → vehicule.etat → 'En Maintenance' (manuel)
  → Trigger auto : INSERT mouvement Débit si cout > 0
  → Fin maintenance : vehicule.etat → 'Disponible'
```

---

## Interfaces et leur périmètre

| Interface | Tables principales | Rôle minimum |
|-----------|-------------------|--------------|
| Tableau de bord | vue_dashboard | user |
| Ticket / Vente | facture, client, trajet | user |
| Réservation | reservation, trajet, client | user |
| Colis | colis, trajet, agence | user |
| Trajet | trajet, vehicule, employe | Admin |
| Règlement | reglement, facture | Admin |
| Mouvement / Caisse | mouvement, vue_solde_caisse | Admin |
| Parc auto | vehicule, maintenance | Admin |
| RH | employe, fonction | Admin |
| Client | client | user |
| Agence | agence | SuperAdmin |
| Utilisateur | utilisateur | SuperAdmin |
| Fonction | fonction | SuperAdmin |

---

## Phases d'implémentation recommandées

### Phase 1 — Socle (semaine 1)
- [ ] Supabase : créer projet, exécuter GNANZE_SCHEMA.sql
- [ ] Auth Supabase : 3 rôles (user / Admin / SuperAdmin)
- [ ] Layout principal : sidebar + header + routing React
- [ ] Tableau de bord (vue_dashboard)

### Phase 2 — Vente et billetterie (semaine 2)
- [ ] Interface TRAJET (CRUD)
- [ ] Interface TICKET / Vente directe
- [ ] Génération ticket 57mm (composant d'impression)
- [ ] Interface RESERVATION
- [ ] Conversion réservation → facture

### Phase 3 — Caisse et colis (semaine 3)
- [ ] Interface RÈGLEMENT
- [ ] Interface MOUVEMENT (journal de caisse)
- [ ] Interface COLIS (dépôt, assignation, suivi)
- [ ] Vue occupation trajet (préparation du voyage)

### Phase 4 — RH et parc (semaine 4)
- [ ] Interface VEHICULE
- [ ] Interface MAINTENANCE
- [ ] Interface EMPLOYE + FONCTION
- [ ] Interface AGENCE (SuperAdmin)
- [ ] Interface UTILISATEUR (SuperAdmin)

### Phase 5 — Finitions (semaine 5)
- [ ] Requêtes avancées sur tous attributs (filtre universel)
- [ ] Export PDF des rapports
- [ ] RLS Supabase final (isolation par agence)
- [ ] Tests et livraison

---

## Points de vigilance

1. **Ticket 57mm** : utiliser `@media print` avec `width: 57mm` et `font-size: 9pt`
   Composant dédié `<TicketPrint />` appelé après validation du règlement.

2. **Numérotation** : les séquences SQL (`ticket_seq`, `colis_seq`) garantissent
   l'unicité même en multi-agence simultané.

3. **Multi-agence** : chaque INSERT doit toujours inclure `agence_id`
   (récupéré depuis le JWT de l'utilisateur connecté).

4. **Triggers** : ne jamais insérer manuellement dans `mouvement` pour les
   règlements et maintenances — les triggers s'en chargent.

5. **Statuts cohérents** :
   - reservation : En Attente → Confirmée → Convertie ou Annulée
   - facture : Non Payé → Payé ou Annulé
   - colis : En Attente → Assigné → En Transit → Livré
   - trajet : Planifié → En Cours → Terminé ou Annulé
   - vehicule : Disponible → En Service → En Maintenance → Hors Service
```
