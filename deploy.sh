#!/usr/bin/env bash
# Met l'appli en ligne (Cloudflare Workers) : bash deploy.sh  (macOS, Linux ou Git Bash sous Windows)
# Avant la première fois : npx wrangler login, sur le compte Cloudflare qui héberge courses-recettes.
# Seuls les fichiers listés ici sont publiés (jamais android/, la clé de signature, les tests ni le serveur).
set -euo pipefail
cd "$(dirname "$0")"

# 1. Tests : au moindre échec, rien n'est mis en ligne et on montre ce qui casse
if ! OUT=$(bash _test.sh); then
  echo "$OUT" | grep -E "^FAIL|data-err" || echo "$OUT" | tail -5
  echo "✗ Tests en échec : rien n'est mis en ligne."
  exit 1
fi
echo "✓ Tests : $(echo "$OUT" | grep -c '^OK') OK"

# 2. Connexion à Cloudflare
npx -y wrangler whoami >/dev/null 2>&1 || { echo "✗ Pas connecté à Cloudflare : lance « npx wrangler login » puis recommence."; exit 1; }

# 3. Fichiers de l'appli, puis mise en ligne (le serveur server/worker.js part avec, via wrangler.jsonc)
rm -rf dist && mkdir dist
cp index.html app.js data.js recettes.js journal.js cuisine.js placard.js planner.js tickets.js cloud.js zxing.min.js sw.js manifest.webmanifest icon.svg dist/
npx -y wrangler deploy
