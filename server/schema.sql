-- Recettes partagées par les utilisateurs (les recettes de base sont livrées avec l'appli, pas ici).
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY, author TEXT NOT NULL, ip TEXT, nom TEXT NOT NULL, data TEXT NOT NULL,
  created INTEGER NOT NULL, updated INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS recipes_author ON recipes(author, created);
CREATE INDEX IF NOT EXISTS recipes_ip ON recipes(ip, created);
-- Une ligne par personne qui a activé « Connecter un assistant ». uh = SHA-256 du code personnel (le code lui-même n'est jamais stocké).
-- view : résumé lisible par l'assistant ; backup : état complet de l'appli (sans photos), pour restaurer sur un autre appareil.
CREATE TABLE IF NOT EXISTS users (uh TEXT PRIMARY KEY, view TEXT, backup TEXT, updated INTEGER NOT NULL);
-- Ce que l'assistant envoie à l'appli (recette, semaine proposée, objectifs, aliment mangé) : lu à la prochaine synchro.
CREATE TABLE IF NOT EXISTS inbox (id INTEGER PRIMARY KEY AUTOINCREMENT, uh TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS inbox_uh ON inbox(uh);
-- Photos des tickets de caisse en attente de lecture par l'assistant (une ligne par photo). Effacées une fois le ticket lu (save_receipt).
CREATE TABLE IF NOT EXISTS receipts (uh TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, at TEXT, photo TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (uh, id, n));
