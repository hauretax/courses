#!/usr/bin/env bash
# Banc d'essai sans téléphone : bash _test.sh (Git Bash sous Windows, ou macOS/Linux avec Chrome).
# Lance _test_run.js dans un navigateur sans écran, sur un état simulé.
set -euo pipefail
cd "$(dirname "$0")"
node -e '
const fs=require("fs"); const now=new Date(), old=new Date(now-8*864e5).toISOString(), iso=now.toISOString(), iso2=new Date(now-1000).toISOString();
const reset="t", jour="t"; // remises à zéro du plan de test (_test_plan.js) déjà appliquées : sinon placard et journal du test seraient vidés au démarrage
const st=JSON.stringify({resetId:reset,resetJourFait:jour,tab:"semaine",eaten:{0:100},log:[{i:0,from:0,to:100,at:old}],
 cooks:[{id:"chili",nom:"Chili",start:old,end:old,min:30,n:2,kcalP:550,protP:45,prix:6},
        {id:"dessert",nom:"Tarte",start:iso2,end:iso2,min:5,n:6,kcalP:600,protP:8},{id:"chili",nom:"Chili",start:iso,end:iso,min:30,n:2,kcalP:550,protP:45}],
 tickets:[{at:old,photo:null,prices:{boeuf:5.2},total:40}],pantry:[{id:"p1",k:"pdt",q:5,u:"pc",loc:"placard"},{id:"p2",k:"boeuf",q:500,u:"g",loc:"frigo"}]});
fs.writeFileSync("_test_state.js","window.fetch=()=>Promise.reject(new Error(\"hors ligne\"));window.onerror=(m,s,l)=>{document.documentElement.setAttribute(\"data-err\",m+\" @\"+String(s).split(\"/\").pop()+\":\"+l)};localStorage.setItem(\"courses-state-v1\","+JSON.stringify(st)+");");
// Le plan n\x27est plus livré avec l\x27appli : le banc d\x27essai en impose un (celui de novembre 2026)
fs.writeFileSync("_test_plan.js","Object.assign(window.DATA,{semaineId:\"test\",reset:\"t\",resetGarde:[\"tikka\"],resetAjoute:[{rid:\"tikka\",n:1,loc:\"congel\"}],resetJour:\"t\",platsFix:{id:\"t\",garde:[\"chili\"],ajoute:[{rid:\"chili\",nom:\"Chili con carne\",n:1,loc:\"congel\",kcalP:550,protP:45}]},portions:15,hebdo:[[\"skyr\",1400],[\"avoine\",280],[\"fruit\",1050]],semaine:[[\"poulet_four\",5],[\"butternut_pchiches\",5],[\"chili\",5],[\"dahl\",5],[\"riz_nature\",3],[\"legumes_express\",5]].flatMap(([recette,n])=>Array.from({length:n},()=>({recette})))});");
fs.writeFileSync("_test_all.html",fs.readFileSync("index.html","utf8").replace("<script src=\"data.js\">","<script src=\"_test_state.js\"></script><script src=\"data.js\">").replace("<script src=\"zxing.min.js\"", "<script src=\"_test_plan.js\"></script><script src=\"zxing.min.js\"").replace("</body>","<script src=\"_test_run.js\"></script></body>"));'
TMP="${TEMP:-${TMPDIR:-/tmp}}"
# Navigateur sans écran : Edge sous Windows, Chrome sous macOS, Chrome ou Chromium sous Linux
if command -v cygpath >/dev/null; then
  BROWSER="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"; URL="file:///$(cygpath -m "$(pwd)")/_test_all.html"
else
  BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  [ -x "$BROWSER" ] || BROWSER="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
  URL="file://$(pwd)/_test_all.html"
fi
rm -rf "$TMP/edgetest_all"
"$BROWSER" --headless --disable-gpu --user-data-dir="$TMP/edgetest_all" --virtual-time-budget=15000 \
  --dump-dom "$URL" 2>/dev/null > "$TMP/dom_all.html"
rm -f _test_all.html _test_state.js _test_plan.js
grep -o 'data-err="[^"]*"' "$TMP/dom_all.html" || true
RES=$(sed -n '/<pre id="res">/,/<\/pre>/p' "$TMP/dom_all.html" | sed 's/<[^>]*>//g')
echo "$RES"
[ -n "$RES" ] && ! echo "$RES" | grep -q "^FAIL" && ! grep -q 'data-err=' "$TMP/dom_all.html"
