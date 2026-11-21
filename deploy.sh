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
FILES="index.html app.js data.js recettes.js journal.js cuisine.js placard.js planner.js tickets.js cloud.js zxing.min.js sw.js manifest.webmanifest icon.svg"
cp $FILES dist/
# Nom de cache propre à cette version : les téléphones voient un nouveau sw.js et passent à la nouvelle version
V=$(cat $FILES | (shasum 2>/dev/null || sha1sum) | cut -c1-10)
sed "s/\"courses-dev\"/\"courses-$V\"/" sw.js > dist/sw.js
grep -q "courses-$V" dist/sw.js || { echo "✗ Version du cache non posée dans dist/sw.js"; exit 1; }
# Date de la version, visible dans ⚙️ (pour savoir si un téléphone a bien la dernière)
sed "s/^const VERSION = \"dev\";/const VERSION = \"$(TZ=Europe/Paris date '+%d\/%m %Hh%M')\";/" app.js > dist/app.js
grep -q '^const VERSION = "[0-9]' dist/app.js || { echo "✗ Date de version non posée dans dist/app.js"; exit 1; }
npx -y wrangler deploy
