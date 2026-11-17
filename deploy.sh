#!/usr/bin/env bash
# Met l'appli en ligne (Cloudflare Workers) : bash deploy.sh
# Seuls les fichiers listés ici sont publiés (jamais android/, la clé de signature, les tests ni le serveur).
set -euo pipefail
cd "$(dirname "$0")"
bash _test.sh | tail -1
rm -rf dist && mkdir dist
cp index.html app.js data.js recettes.js journal.js cuisine.js placard.js planner.js tickets.js cloud.js zxing.min.js sw.js manifest.webmanifest icon.svg dist/
npx wrangler deploy
