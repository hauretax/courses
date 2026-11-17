# Courses & recettes

**Appli gratuite, sans compte et sans pub, pour bien manger sans se compliquer la vie.**
👉 https://courses-recettes.lazycorrect.workers.dev (s'installe sur le téléphone comme une appli : menu du navigateur › « Ajouter à l'écran d'accueil »)

Tu choisis ce que tu cuisines cette semaine, l'appli s'occupe du reste :

- 🛒 **Liste de courses calculée toute seule** à partir des recettes de la semaine, moins ce que tu as déjà au placard, rangée par rayon.
- 👩‍🍳 **Mode cuisine pas à pas** : ingrédients à cocher, étapes avec minuteurs, écran qui reste allumé, portions ajustables.
- 🗄️ **Placard virtuel** (frigo, congélateur, placard, épices) avec les dates limites et les portions de plats mises de côté.
- 📓 **Journal des calories et des protéines**, avec recherche d'aliments et scan de codes-barres (Open Food Facts).
- 🧾 **Tickets de caisse** : les prix saisis donnent le coût réel de chaque recette et de chaque portion.
- 🌍 **Recettes partagées** : tout le monde peut écrire une recette et l'offrir au catalogue commun.
- 🤖 **Un assistant qui prépare ta semaine** : relie Claude, ChatGPT ou tout assistant compatible MCP. Il connaît les recettes disponibles, ton placard, ce que tu as mangé et les plats que tu as aimés, et te propose un programme sur mesure.

## Vie privée

- **Pas de compte.** Tes données (journal, placard, semaine, notes, photos) restent sur ton appareil.
- Seules les **recettes que tu choisis de partager** sont envoyées au serveur, et tu peux les retirer.
- Chaque appli tire au sort un **code personnel**, gardé sur l'appareil. Il signe tes recettes partagées.
- L'option **« Connecter un assistant »** (⚙️) est désactivée par défaut. Si tu l'actives, l'appli envoie une copie de tes données (sans les photos) sur le serveur, rangée sous l'empreinte de ton code. C'est ce que lit l'assistant. Ton code sert alors aussi à retrouver tes données sur un autre téléphone. Tu peux tout effacer du serveur d'un bouton. Si tu perds ton code, il suffit d'en créer un nouveau.

## Connecter un assistant (MCP)

Dans l'appli : ⚙️ › *Connecter un assistant* › *Activer*, puis copie le lien affiché (`…/mcp/<ton code>`) et ajoute-le comme connecteur personnalisé (serveur MCP distant) dans ton assistant. Ce lien est ton mot de passe : ne le partage pas.

| Outil | Rôle |
|---|---|
| `get_profile` | Objectifs, favoris, notes laissées sur les plats |
| `get_journal` | Calories et protéines mangées, jour par jour |
| `get_pantry` | Placard, frigo, congélateur, plats de côté |
| `get_week` | Semaine en cours, plats cuisinés, courses restantes |
| `search_recipes`, `get_recipe` | Recettes de base, de la communauté et personnelles |
| `list_foods` | Aliments connus (kcal, protéines, poids d'une pièce) |
| `create_recipe` | Ajoute une recette (et la partage si demandé) |
| `propose_week` | Propose le programme de la semaine ; la personne l'accepte dans l'appli |
| `set_goals`, `log_food` | Change les objectifs, note un repas dans le journal |

Ce que l'assistant écrit arrive dans l'appli à sa prochaine ouverture. Une semaine proposée n'est jamais lancée sans l'accord de la personne.

## Technique

Du web sans framework ni étape de build, hébergé gratuitement sur Cloudflare (Workers + D1).

| Fichier | Contenu |
|---|---|
| `index.html`, `app.js` | Page, styles, onglets Courses et Semaine |
| `data.js`, `recettes.js` | Aliments et recettes livrés avec l'appli |
| `journal.js`, `cuisine.js`, `placard.js`, `planner.js`, `tickets.js` | Journal, recettes et mode cuisine, placard, nouvelle semaine et nouvelle recette, tickets |
| `cloud.js` | Catalogue partagé, code personnel, synchro, réglages |
| `sw.js` | Fonctionnement hors ligne |
| `server/worker.js`, `server/schema.sql` | API (`/api/recipes`, `/api/sync`), serveur MCP (`/mcp/<code>`), base D1 |
| `android/` | Enveloppe Android facultative (WebView), `bash android/build.sh` |

```bash
bash _test.sh    # banc d'essai : Edge sans écran, réseau coupé
bash deploy.sh   # tests, puis mise en ligne (wrangler deploy)
```

Pour héberger ta propre copie : `npx wrangler d1 create courses-recettes`, mets l'identifiant dans `wrangler.jsonc`, `npx wrangler d1 execute courses-recettes --remote --file server/schema.sql`, change `SITE` dans `cloud.js`, puis `bash deploy.sh`. Le secret `ADMIN` (`npx wrangler secret put ADMIN`) permet de retirer une recette du catalogue : `curl -X DELETE -H "Authorization: Bearer <ADMIN>" https://…/api/recipes/<id>`.
