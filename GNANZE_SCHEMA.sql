-- Enable pgcrypto extension for password hashing/checking
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create tables
CREATE TABLE IF NOT EXISTS agence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  ville TEXT NOT NULL,
  telephone TEXT,
  mail TEXT,
  responsable TEXT,
  horaire_ouverture TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fonction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intitule TEXT NOT NULL UNIQUE,
  salaire NUMERIC(12,2),
  attribut TEXT,
  details TEXT
);

CREATE TABLE IF NOT EXISTS employe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT,
  agence_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  fonction_id UUID REFERENCES fonction(id) ON DELETE SET NULL,
  qualification TEXT,
  date_embauche DATE,
  date_fin_contrat DATE,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immatriculation TEXT NOT NULL UNIQUE,
  type TEXT,
  marque TEXT,
  capacite INT NOT NULL,
  etat TEXT DEFAULT 'Disponible' CHECK (etat IN ('Disponible', 'En Service', 'En Maintenance', 'Hors Service')),
  agence_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trajet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  depart TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km NUMERIC(8,2),
  duree_minutes INT,
  tarif_standard NUMERIC(10,2) NOT NULL,
  conducteur_id UUID REFERENCES employe(id) ON DELETE SET NULL,
  vehicule_id UUID REFERENCES vehicule(id) ON DELETE SET NULL,
  agence_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  date_voyage DATE NOT NULL,
  heure_depart TIME NOT NULL,
  statut TEXT DEFAULT 'Planifié' CHECK (statut IN ('Planifié', 'En Cours', 'Terminé', 'Annulé')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT,
  adresse TEXT,
  profession TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  trajet_id UUID REFERENCES trajet(id) ON DELETE CASCADE,
  client_id UUID REFERENCES client(id) ON DELETE SET NULL,
  date_voyage DATE NOT NULL,
  statut TEXT DEFAULT 'En Attente' CHECK (statut IN ('En Attente', 'Confirmée', 'Convertie', 'Annulée')),
  agence_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  gare_depart TEXT,
  gare_arrivee TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  heure_creation TIME DEFAULT now()::TIME
);

CREATE TABLE IF NOT EXISTS facture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_facture TEXT NOT NULL UNIQUE,
  nom_client TEXT NOT NULL,
  client_id UUID REFERENCES client(id) ON DELETE SET NULL,
  trajet_id UUID REFERENCES trajet(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservation(id) ON DELETE SET NULL,
  etat TEXT DEFAULT 'Non Payé' CHECK (etat IN ('Payé', 'Non Payé', 'Annulé')),
  montant NUMERIC(10,2) NOT NULL,
  agence_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  gare_depart TEXT,
  gare_arrivee TEXT,
  date_facture DATE DEFAULT CURRENT_DATE,
  heure_facture TIME DEFAULT now()::TIME,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reglement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id UUID REFERENCES facture(id) ON DELETE CASCADE,
  montant NUMERIC(10,2) NOT NULL,
  date_reglement DATE DEFAULT CURRENT_DATE,
  heure_reglement TIME DEFAULT now()::TIME,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mouvement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agence_id UUID REFERENCES agence(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('Crédit', 'Débit')),
  libelle TEXT NOT NULL,
  credit NUMERIC(12,2) DEFAULT 0,
  debit NUMERIC(12,2) DEFAULT 0,
  details TEXT,
  source TEXT CHECK (source IN ('REGLEMENT', 'MAINTENANCE', 'MANUEL')),
  source_id UUID,
  date_mvt DATE DEFAULT CURRENT_DATE,
  heure_mvt TIME DEFAULT now()::TIME,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS colis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  trajet_id UUID REFERENCES trajet(id) ON DELETE SET NULL,
  agence_depart_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  agence_arrivee_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  envoyeur TEXT NOT NULL,
  receveur TEXT NOT NULL,
  telephone_envoyeur TEXT,
  telephone_receveur TEXT,
  contenu TEXT,
  statut TEXT DEFAULT 'En Attente' CHECK (statut IN ('En Attente', 'Assigné', 'En Transit', 'Livré', 'Retourné')),
  priorite INT DEFAULT 1 CHECK (priorite IN (1, 2, 3)), -- 1=Normal, 2=Urgent, 3=Express
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicule_id UUID REFERENCES vehicule(id) ON DELETE CASCADE,
  type_maintenance TEXT NOT NULL,
  description TEXT,
  cout NUMERIC(10,2),
  agence_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  date_maintenance DATE DEFAULT CURRENT_DATE,
  heure_maintenance TIME DEFAULT now()::TIME,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS utilisateur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_utilisateur TEXT NOT NULL UNIQUE,
  mot_de_passe TEXT NOT NULL,
  type TEXT DEFAULT 'user' CHECK (type IN ('user', 'Admin', 'SuperAdmin')),
  employe_id UUID REFERENCES employe(id) ON DELETE SET NULL,
  agence_id UUID REFERENCES agence(id) ON DELETE SET NULL,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create sequences
CREATE SEQUENCE IF NOT EXISTS ticket_seq START WITH 42546;
CREATE SEQUENCE IF NOT EXISTS colis_seq START WITH 10001;

-- 3. Create triggers & trigger functions

-- Trigger function for ticket numbering
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_facture IS NULL OR NEW.numero_facture = '' THEN
    NEW.numero_facture := 'TKT-' || nextval('ticket_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ticket_number
BEFORE INSERT ON facture
FOR EACH ROW
EXECUTE FUNCTION set_ticket_number();

-- Trigger function for colis numbering
CREATE OR REPLACE FUNCTION set_colis_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'COL-' || nextval('colis_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_colis_number
BEFORE INSERT ON colis
FOR EACH ROW
EXECUTE FUNCTION set_colis_number();

-- Trigger function for reglement -> mouvement & invoice status
CREATE OR REPLACE FUNCTION reglement_to_mouvement()
RETURNS TRIGGER AS $$
DECLARE
  v_facture RECORD;
  v_total_reglement NUMERIC(10,2);
BEGIN
  -- Fetch invoice info
  SELECT * INTO v_facture FROM facture WHERE id = NEW.facture_id;

  -- Insert Credit ledger record
  INSERT INTO mouvement (
    agence_id,
    type,
    libelle,
    credit,
    debit,
    source,
    source_id,
    date_mvt,
    heure_mvt
  ) VALUES (
    v_facture.agence_id,
    'Crédit',
    'Règlement facture ' || v_facture.numero_facture,
    NEW.montant,
    0,
    'REGLEMENT',
    NEW.id,
    NEW.date_reglement,
    NEW.heure_reglement
  );

  -- Calculate total payments for this invoice
  SELECT COALESCE(SUM(montant), 0) INTO v_total_reglement 
  FROM reglement 
  WHERE facture_id = NEW.facture_id;

  -- Update invoice to Payé if total payments >= invoice amount
  IF v_total_reglement >= v_facture.montant THEN
    UPDATE facture SET etat = 'Payé' WHERE id = NEW.facture_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_reglement_to_mouvement
AFTER INSERT ON reglement
FOR EACH ROW
EXECUTE FUNCTION reglement_to_mouvement();

-- Trigger function for maintenance -> mouvement
CREATE OR REPLACE FUNCTION maintenance_to_mouvement()
RETURNS TRIGGER AS $$
DECLARE
  v_immatriculation TEXT;
BEGIN
  IF NEW.cout > 0 THEN
    SELECT immatriculation INTO v_immatriculation FROM vehicule WHERE id = NEW.vehicule_id;

    INSERT INTO mouvement (
      agence_id,
      type,
      libelle,
      credit,
      debit,
      source,
      source_id,
      date_mvt,
      heure_mvt
    ) VALUES (
      NEW.agence_id,
      'Débit',
      'Maintenance véhicule ' || COALESCE(v_immatriculation, NEW.vehicule_id::TEXT),
      0,
      NEW.cout,
      'MAINTENANCE',
      NEW.id,
      NEW.date_maintenance,
      NEW.heure_maintenance
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_maintenance_to_mouvement
AFTER INSERT ON maintenance
FOR EACH ROW
EXECUTE FUNCTION maintenance_to_mouvement();

-- 4. Create SQL Views

-- Journey Occupancy View
CREATE OR REPLACE VIEW vue_occupation_trajet AS
SELECT 
  t.id AS trajet_id,
  t.depart,
  t.destination,
  t.date_voyage,
  t.heure_depart,
  coalesce(v.capacite, 15) AS capacite_vehicule,
  COALESCE(count(DISTINCT f.id) FILTER (WHERE f.etat IN ('Payé', 'Non Payé')), 0) AS nb_passagers_confirmes,
  COALESCE(count(DISTINCT r.id) FILTER (WHERE r.statut IN ('En Attente', 'Confirmée')), 0) AS nb_reservations_actives,
  COALESCE(count(DISTINCT c.id), 0) AS nb_colis,
  (coalesce(v.capacite, 15) - 
   COALESCE(count(DISTINCT f.id) FILTER (WHERE f.etat IN ('Payé', 'Non Payé')), 0) - 
   COALESCE(count(DISTINCT r.id) FILTER (WHERE r.statut IN ('En Attente', 'Confirmée')), 0)
  ) AS places_disponibles
FROM trajet t
LEFT JOIN vehicule v ON t.vehicule_id = v.id
LEFT JOIN facture f ON f.trajet_id = t.id
LEFT JOIN reservation r ON r.trajet_id = t.id
LEFT JOIN colis c ON c.trajet_id = t.id
GROUP BY t.id, t.depart, t.destination, t.date_voyage, t.heure_depart, v.capacite;

-- Cash Flow Ledger View
CREATE OR REPLACE VIEW vue_solde_caisse AS
SELECT 
  agence_id,
  COALESCE(SUM(credit), 0) AS total_credit,
  COALESCE(SUM(debit), 0) AS total_debit,
  (COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0)) AS solde
FROM mouvement
GROUP BY agence_id;

-- Global Dashboard Metrics View
CREATE OR REPLACE VIEW vue_dashboard AS
SELECT 
  (SELECT COALESCE(COUNT(id), 0) FROM facture WHERE etat = 'Payé') AS total_passagers,
  (SELECT COALESCE(COUNT(id), 0) FROM trajet) AS total_trajets,
  (SELECT COALESCE(COUNT(id), 0) FROM employe WHERE actif = TRUE) AS total_employes_actifs,
  (SELECT COALESCE(COUNT(id), 0) FROM agence) AS total_agences,
  (SELECT COALESCE(COUNT(id), 0) FROM colis) AS total_colis,
  (SELECT COALESCE(COUNT(id), 0) FROM reservation WHERE statut IN ('En Attente', 'Confirmée')) AS total_reservations_actives;

-- 5. User Credentials Login Function using pgcrypto
CREATE OR REPLACE FUNCTION login_user(p_username TEXT, p_password_plain TEXT)
RETURNS TABLE (
  id UUID,
  nom_utilisateur TEXT,
  type TEXT,
  employe_id UUID,
  agence_id UUID,
  actif BOOLEAN,
  agence_nom TEXT,
  employe_nom TEXT,
  employe_prenom TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id, 
    u.nom_utilisateur, 
    u.type, 
    u.employe_id, 
    u.agence_id, 
    u.actif,
    a.nom AS agence_nom,
    e.nom AS employe_nom,
    e.prenom AS employe_prenom
  FROM utilisateur u
  LEFT JOIN agence a ON u.agence_id = a.id
  LEFT JOIN employe e ON u.employe_id = e.id
  WHERE u.nom_utilisateur = p_username 
    AND u.mot_de_passe = crypt(p_password_plain, u.mot_de_passe)
    AND u.actif = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Insert Seed Data using Static UUIDs for references

-- Insert Agencies
INSERT INTO agence (id, nom, ville, telephone, mail, responsable, horaire_ouverture) VALUES
('a0000000-0000-0000-0000-000000000001', 'Agence de Cotonou', 'Cotonou', '+229 21 30 00 01', 'cotonou@gnanze.com', 'M. Paul Sossa', '07:00 - 20:00'),
('a0000000-0000-0000-0000-000000000002', 'Agence de Parakou', 'Parakou', '+229 23 61 00 02', 'parakou@gnanze.com', 'Mme. Alice Toko', '07:00 - 20:00')
ON CONFLICT (id) DO NOTHING;

-- Insert Functions
INSERT INTO fonction (id, intitule, salaire, attribut, details) VALUES
('f0000000-0000-0000-0000-000000000001', 'SuperAdmin', 1000000.00, 'Administration Globale', 'Gestion complète du système multi-agence'),
('f0000000-0000-0000-0000-000000000002', 'Chef Agence', 500000.00, 'Administration Agence', 'Gestion locale de son agence, caisses et employés'),
('f0000000-0000-0000-0000-000000000003', 'Secrétaire', 250000.00, 'Ventes et Colis', 'Caissier ou agent d''accueil, billetterie et colis'),
('f0000000-0000-0000-0000-000000000004', 'Conducteur', 300000.00, 'Chauffeur', 'Conducteur de bus pour les trajets interurbains')
ON CONFLICT (id) DO NOTHING;

-- Insert Employees
INSERT INTO employe (id, matricule, nom, prenom, telephone, agence_id, fonction_id, qualification, date_embauche) VALUES
('e0000000-0000-0000-0000-000000000001', 'EMP-001', 'KOFFI', 'Jean', '+229 97 00 00 01', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Ingénieur Systèmes', '2025-01-15'),
('e0000000-0000-0000-0000-000000000002', 'EMP-002', 'SADJI', 'Hubert', '+229 95 00 00 02', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'Manager Logistique', '2025-02-01'),
('e0000000-0000-0000-0000-000000000003', 'EMP-003', 'BIO', 'Mariam', '+229 90 00 00 03', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', 'Comptable Assistante', '2025-03-01'),
('e0000000-0000-0000-0000-000000000004', 'EMP-004', 'AGBADO', 'Pascal', '+229 91 00 00 04', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', 'Permis D, FIMO', '2025-02-10')
ON CONFLICT (id) DO NOTHING;

-- Insert Users (mot_de_passe check: crypt('pass', gen_salt('bf')))
INSERT INTO utilisateur (id, nom_utilisateur, mot_de_passe, type, employe_id, agence_id) VALUES
('10000000-0000-0000-0000-000000000001', 'superadmin', crypt('superadmin123', gen_salt('bf')), 'SuperAdmin', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000002', 'admin', crypt('admin123', gen_salt('bf')), 'Admin', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0000-000000000003', 'caissier', crypt('caissier123', gen_salt('bf')), 'user', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 7. User Account Save/Update Function using pgcrypto Blowfish encryption
CREATE OR REPLACE FUNCTION save_utilisateur(
  p_id UUID,
  p_nom_utilisateur TEXT,
  p_mot_de_passe TEXT,
  p_type TEXT,
  p_employe_id UUID,
  p_agence_id UUID,
  p_actif BOOLEAN
) RETURNS VOID AS $$
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO utilisateur (nom_utilisateur, mot_de_passe, type, employe_id, agence_id, actif)
    VALUES (p_nom_utilisateur, crypt(p_mot_de_passe, gen_salt('bf')), p_type, p_employe_id, p_agence_id, p_actif);
  ELSE
    IF p_mot_de_passe IS NULL OR p_mot_de_passe = '' THEN
      UPDATE utilisateur
      SET nom_utilisateur = p_nom_utilisateur,
          type = p_type,
          employe_id = p_employe_id,
          agence_id = p_agence_id,
          actif = p_actif
      WHERE id = p_id;
    ELSE
      UPDATE utilisateur
      SET nom_utilisateur = p_nom_utilisateur,
          mot_de_passe = crypt(p_mot_de_passe, gen_salt('bf')),
          type = p_type,
          employe_id = p_employe_id,
          agence_id = p_agence_id,
          actif = p_actif
      WHERE id = p_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_utilisateur(UUID, TEXT, TEXT, TEXT, UUID, UUID, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION login_user(TEXT, TEXT) TO anon, authenticated, service_role;

-- 8. Row Level Security & Request Context Helper Functions

CREATE OR REPLACE FUNCTION get_current_agence_id() 
RETURNS TEXT AS $$
BEGIN
  RETURN coalesce(current_setting('request.headers', true)::json->>'x-agence-id', '');
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_current_user_role() 
RETURNS TEXT AS $$
BEGIN
  RETURN coalesce(current_setting('request.headers', true)::json->>'x-user-role', '');
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS on the 5 operational tables
ALTER TABLE trajet ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvement ENABLE ROW LEVEL SECURITY;
ALTER TABLE colis ENABLE ROW LEVEL SECURITY;

-- Define Policies for trajet
CREATE POLICY trajet_policy ON trajet
FOR ALL
USING (
  get_current_user_role() = 'SuperAdmin'
  OR agence_id = nullif(get_current_agence_id(), '')::UUID
);

-- Define Policies for facture
CREATE POLICY facture_policy ON facture
FOR ALL
USING (
  get_current_user_role() = 'SuperAdmin'
  OR agence_id = nullif(get_current_agence_id(), '')::UUID
);

-- Define Policies for reservation
CREATE POLICY reservation_policy ON reservation
FOR ALL
USING (
  get_current_user_role() = 'SuperAdmin'
  OR agence_id = nullif(get_current_agence_id(), '')::UUID
);

-- Define Policies for mouvement
CREATE POLICY mouvement_policy ON mouvement
FOR ALL
USING (
  get_current_user_role() = 'SuperAdmin'
  OR agence_id = nullif(get_current_agence_id(), '')::UUID
);

-- Define Policies for colis
CREATE POLICY colis_policy ON colis
FOR ALL
USING (
  get_current_user_role() = 'SuperAdmin'
  OR agence_depart_id = nullif(get_current_agence_id(), '')::UUID
  OR agence_arrivee_id = nullif(get_current_agence_id(), '')::UUID
);

-- Define Policies for utilisateur
ALTER TABLE utilisateur ENABLE ROW LEVEL SECURITY;

CREATE POLICY utilisateur_policy ON utilisateur
FOR ALL
USING (true)
WITH CHECK (true);

-- 9. Automatic Agence ID Triggers (Security Fail-safes)

-- Trigger to set agence_id from trajet_id if not supplied (for facture and reservation)
CREATE OR REPLACE FUNCTION set_agence_id_from_trajet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.agence_id IS NULL THEN
    SELECT agence_id INTO NEW.agence_id FROM trajet WHERE id = NEW.trajet_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_set_facture_agence_id
BEFORE INSERT ON facture
FOR EACH ROW
EXECUTE FUNCTION set_agence_id_from_trajet();

CREATE OR REPLACE TRIGGER trg_set_reservation_agence_id
BEFORE INSERT ON reservation
FOR EACH ROW
EXECUTE FUNCTION set_agence_id_from_trajet();

-- Trigger to set agence_id from vehicule_id if not supplied (for maintenance)
CREATE OR REPLACE FUNCTION set_maintenance_agence_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.agence_id IS NULL THEN
    SELECT agence_id INTO NEW.agence_id FROM vehicule WHERE id = NEW.vehicule_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_set_maintenance_agence_id
BEFORE INSERT ON maintenance
FOR EACH ROW
EXECUTE FUNCTION set_maintenance_agence_id();



