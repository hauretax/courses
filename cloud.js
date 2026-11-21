// ---- En ligne : catalogue de recettes partagées, code personnel, synchro pour un assistant, réglages ----
// Chargé après planner.js, avant app.js. Rien ici ne s'exécute au chargement : app.js appelle initCloud() puis startCloud().
// Sans compte : chaque appli tire au sort un code personnel, gardé sur l'appareil. Il signe les recettes qu'on partage
// et, seulement si on active « Connecter un assistant », sert de clé à la copie de ses données sur le serveur.
const SITE = "https://courses-recettes.lazycorrect.workers.dev";
const API = location.protocol.startsWith("http") && !/^(localhost|127\.)/.test(location.hostname) ? location.origin : SITE;
const UID_KEY = "courses-uid", CAT_KEY = "courses-catalog";
const PUB = {}; // recettes de la communauté (id → recette), en plus de celles livrées avec l'appli
let UID = null;

const ABOUT = `<p><b>Courses & recettes</b> est une appli gratuite, sans compte et sans pub, pour bien manger sans se compliquer la vie.</p>
  <p class="sub">Tu choisis ce que tu cuisines cette semaine : l'appli calcule la liste de courses (moins ce que tu as déjà), te guide pas à pas en cuisine avec les minuteurs, range tes achats dans un placard virtuel et compte tes calories et tes protéines.</p>
  <p class="sub">🔒 Tes données restent sur ton téléphone. Seules les recettes que tu choisis de partager deviennent publiques, pour que tout le monde en profite.</p>
  <p class="sub">🤖 Si tu veux, tu peux relier un assistant (Claude, ChatGPT…) : il connaît alors tes recettes, ton placard et ce que tu as mangé, et te prépare une semaine sur mesure.</p>`;

function newUid() {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...crypto.getRandomValues(new Uint8Array(26))].map(b => abc[b % 36]).join("");
}
const mergeAlim = r => { for (const [k, a] of Object.entries((r && r.alim) || {})) AL[k] ||= a; };
function setCatalog(recipes) {
  for (const k in PUB) delete PUB[k];
  for (const [id, r] of Object.entries(recipes || {})) if (!D.recettes[id] && r && r.nom && Array.isArray(r.ingredients) && Array.isArray(r.etapes)) { PUB[id] = r; mergeAlim(r); }
}
// Réglages personnels (objectifs, petit-déj de la semaine) : ils remplacent les valeurs par défaut de data.js
function applyCfg() {
  // Première version de l'appli, faite pour une seule personne : ses réglages étaient écrits dans le code
  if (!S.cfg && S.planId) S.cfg = { kcalJour: 2150, protJour: 160, hebdo: [["skyr", 1400], ["avoine", 280], ["fruit", 1050]],
    pdj: { nom: "Petit-déj skyr-avoine-fruit", kcal: 360, prot: 30, meal: "petitdej" } };
  for (const k of ["kcalJour", "protJour", "hebdo", "pdj"]) if (S.cfg && S.cfg[k] != null) D[k] = S.cfg[k];
}
function initCloud() { // appelé par app.js une fois l'état chargé, avant applyPlan
  try { UID = localStorage.getItem(UID_KEY); if (!UID) localStorage.setItem(UID_KEY, UID = newUid()); } catch { UID = UID || newUid(); }
  try { setCatalog(JSON.parse(localStorage.getItem(CAT_KEY))); } catch {}
  for (const r of Object.values(S.lib || {})) mergeAlim(r);
  S.pubs ||= {}; S.acks ||= [];
  applyCfg();
}
function startCloud() { // appelé par app.js après le premier affichage
  $("#gear").onclick = sheetSettings;
  refreshCatalog();
  if (S.sync) cloudSync();
  // Retour dans l'appli (après avoir parlé à l'assistant dans une autre appli ou fenêtre) : on va chercher ce qu'il a déposé
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") cloudPull(); });
  addEventListener("focus", () => cloudPull()); // ordi : deux fenêtres côte à côte, la page reste visible
  $("#sync").onclick = pullNow; syncBtn();
  const fresh = !S.welcome && !S.plan && !(S.cooks || []).length && !(S.food || []).length;
  if (!S.welcome) { S.welcome = 1; rawSave(); }
  if (fresh) sheetWelcome(); else if (S.proposal) showProposal();
}
const rawSave = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }; // sans relancer une synchro
async function cloudFetch(path, method = "GET", body, uid = UID) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 45000); // une requête qui ne répond jamais ne doit pas bloquer les synchros suivantes
  try {
    const r = await fetch(API + path, { method, signal: ctl.signal, headers: { authorization: "Bearer " + uid, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Erreur " + r.status);
    return j;
  } finally { clearTimeout(t); }
}

// ---- Catalogue public ----
async function refreshCatalog() {
  try {
    const j = await (await fetch(API + "/api/recipes")).json();
    setCatalog(j.recipes);
    try { localStorage.setItem(CAT_KEY, JSON.stringify(j.recipes)); } catch {}
    if (S.tab === "recettes" && $("#libl")) drawLib();
  } catch {} // hors ligne : on garde le dernier catalogue reçu
}
// Une recette est « à moi » si je l'ai écrite : ni livrée avec l'appli, ni reçue de quelqu'un d'autre
const isMine = id => !!S.lib[id] && !D.recettes[id] && (!PUB[id] || !!S.pubs[id]);
const pubBtnHTML = id => !isMine(id) ? (PUB[id] ? `<p class="sub" style="margin-top:14px">🌍 Recette partagée par la communauté.</p>` : "")
  : S.pubs[id] ? `<p class="sub" style="margin-top:14px">🌍 Tu partages cette recette avec tout le monde. <button class="link" id="cpub">Retirer du catalogue</button></p>`
    : `<button class="wide" id="cpub" style="margin-top:14px">🌍 Partager cette recette avec tout le monde</button>`;
async function publishRecipe(id) {
  const r = S.lib[id]; if (!r) return;
  const alim = { ...(r.alim || {}) };
  for (const g of r.ingredients) if (Array.isArray(g) && S.alim[g[2]]) alim[g[2]] = S.alim[g[2]]; // aliments créés par moi : ils voyagent avec la recette
  try {
    const j = await cloudFetch("/api/recipes", "POST", { id, recipe: { ...r, types: typesOf(id), alim } });
    S.pubs[id] = 1; PUB[id] = j.recipe; save(); toast("🌍 Recette partagée, merci !");
  } catch (e) { toast(navigator.onLine ? "Partage refusé : " + e.message : "Pas de réseau : réessaie plus tard"); }
}
async function unpublishRecipe(id) {
  try { await cloudFetch("/api/recipes/" + id, "DELETE"); } catch (e) { if (!/introuvable/.test(e.message)) return toast("Impossible : " + e.message); }
  delete S.pubs[id]; delete PUB[id]; save(); toast("Retirée du catalogue (elle reste dans tes recettes)");
}
async function togglePublish(id) {
  if (S.pubs[id]) await unpublishRecipe(id);
  else { if (!confirm("Partager cette recette ? Tout le monde pourra la voir et la cuisiner. Tu pourras la retirer.")) return; await publishRecipe(id); }
  if ($("#cook").classList.contains("open")) openCook(id, true);
}

// ---- Synchro (seulement si « Connecter un assistant » est activé) ----
let syncT = null, syncing = false, lastSync = 0;
function cloudDirty() { if (!S.sync) return; clearTimeout(syncT); syncT = setTimeout(cloudSync, 8000); } // appelé par save()
// Ce que l'assistant peut lire : un résumé en clair, calculé ici (le serveur ne refait aucun calcul)
function buildView() {
  const ws = weekStart(), safe = (f, d) => { try { return f(); } catch { return d; } };
  const days = new Set([...(S.food || []), ...(S.log || [])].map(e => dateKey(new Date(e.at))));
  const journal = [...days].sort().reverse().slice(0, 60).map(k => safe(() => {
    const es = dayEntries(k);
    return { date: k, kcal: Math.round(es.reduce((a, e) => a + e.kcal, 0)), prot: Math.round(es.reduce((a, e) => a + e.prot, 0)),
      repas: es.map(e => ({ nom: e.nom, kcal: Math.round(e.kcal), prot: Math.round(e.prot), repas: e.meal, heure: fmtTime(e.at) })) };
  }, null)).filter(Boolean);
  const plan = {}; for (const d of D.semaine) plan[d.recette] = (plan[d.recette] || 0) + 1;
  return {
    at: new Date().toISOString(), today: dateKey(new Date()),
    goals: { kcal_par_jour: D.kcalJour, prot_par_jour: D.protJour, repas_par_semaine: goalOf() },
    journal,
    week: { debut: dateKey(ws),
      prevu: Object.entries(plan).filter(([id]) => getR(id)).map(([id, n]) => ({ id, nom: getR(id).nom, portions: n })),
      cuisine: S.cooks.filter(c => new Date(c.end) >= ws).map(c => ({ id: c.id, nom: c.nom, le: c.end.slice(0, 10), portions: c.portions || c.n, mange_pct: safe(() => dishPct(c), 0),
        kcal_portion: c.kcalP, prot_portion: c.protP, duree_min: c.min, ...(c.prix ? { cout: c.prix } : {}) })) },
    shopping: safe(() => groups().map(r => ({ rayon: r.rayon, articles: r.items.filter(i => !S.checked[i.id]).map(i => i.nom + (i.qte ? " : " + i.qte : "")) })).filter(r => r.articles.length), []),
    pantry: S.pantry.map(p => ({ nom: pName(p), quantite: pQty(p), lieu: p.loc, ...(p.exp ? { limite: p.exp } : {}), ...(p.k ? { cle: p.k } : {}) })),
    extras: S.extras.map(x => ({ nom: x.nom, ...(x.qte ? { quantite: x.qte } : {}), achete: !!(S.checked[x.id] || S.stored[x.id]) })),
    canMake: safe(() => canMake(15).map(x => ({ id: x.id, nom: getR(x.id).nom, on_a: x.got.map(k => (AL[k] || {}).n || k), il_manque: x.miss.map(k => (AL[k] || {}).n || k) })), []),
    dishes: S.plats.map(p => ({ nom: p.nom, portions: p.n, lieu: p.loc, a_manger_avant: platExp(p), kcal_portion: p.kcalP, ...(p.rid ? { id_recette: p.rid } : {}) })),
    ratings: Object.entries(S.notes).filter(([id]) => getR(id)).map(([id, n]) => ({ id, nom: getR(id).nom, stars: n.stars, tags: n.tags, txt: n.txt, fois_cuisine: cooksOf(id).length })),
    favs: Object.keys(S.favs).filter(getR).map(id => ({ id, nom: getR(id).nom })),
    myRecipes: Object.fromEntries(Object.entries(S.lib).filter(([id]) => !D.recettes[id])),
    foods: S.alim
  };
}
async function cloudSync() {
  if (!S.sync || !navigator.onLine) return;
  if (syncing) return cloudDirty(); // une lecture est en cours : on réessaie un peu plus tard plutôt que d'oublier l'envoi
  syncing = true; clearTimeout(syncT);
  try {
    const sent = [...S.acks], backup = JSON.stringify(S).length < 1_200_000 ? S : null;
    const j = await cloudFetch("/api/sync", "PUT", { view: buildView(), backup, ack: sent });
    lastSync = Date.now(); S.syncAt = new Date().toISOString(); S.acks = S.acks.filter(x => !sent.includes(x));
    const todo = (j.inbox || []).filter(m => !S.acks.includes(m.id));
    if (todo.length) handleInbox(todo); else rawSave();
  } catch {} finally { syncing = false; }
  if (lastSync && S.tickets.some(t => t.ai === "todo")) sendTickets();
}
// Photos des tickets à faire lire par l'assistant : envoyées une par une ; sans réseau, on réessaie à la synchro suivante
let sendingTk = false;
async function sendTickets() {
  if (sendingTk || !S.sync) return; sendingTk = true;
  try {
    for (const t of S.tickets.filter(t => t.ai === "todo")) {
      const photos = await tkPhotos(t.id).catch(() => []);
      if (!photos.length) { delete t.ai; continue; }
      await cloudFetch("/api/receipts/" + t.id, "DELETE");
      for (let n = 0; n < photos.length; n++) await cloudFetch(`/api/receipts/${t.id}/${n}`, "PUT", { at: t.at, photo: photos[n] });
      t.ai = "sent"; rawSave();
    }
  } catch {} finally { sendingTk = false; }
}
// Lecture légère de ce que l'assistant a déposé, sans renvoyer toutes les données : c'est ce qui rend l'arrivée rapide.
// Renvoie le nombre d'éléments reçus, ou null si le serveur n'a pas répondu.
let lastPull = 0;
async function cloudPull(force) {
  if (!S.sync || syncing || !navigator.onLine || (!force && Date.now() - lastPull < 3000)) return null; // retour + focus arrivent souvent ensemble
  syncing = true; lastPull = Date.now(); let got = 0;
  try {
    const j = await cloudFetch("/api/inbox");
    const todo = (j.inbox || []).filter(m => !S.acks.includes(m.id));
    if (todo.length) { handleInbox(todo); got = todo.length; }
  } catch { got = null; } finally { syncing = false; }
  if (got !== null && (got || force || Date.now() - lastSync > 60000)) cloudSync(); // accusé de réception et copie à jour pour l'assistant
  return got;
}
// Bouton 🔄 : une fois toutes les 15 s au plus
const PULL_WAIT = 15000;
let pullT = null;
function syncBtn() { const b = $("#sync"); if (b) b.hidden = !S.sync; }
async function pullNow() {
  const b = $("#sync"), left = PULL_WAIT - (Date.now() - lastPull);
  if (b.classList.contains("spin")) return;
  if (left > 0) return toast(`Déjà vérifié : réessaie dans ${Math.ceil(left / 1000)} s`);
  b.classList.add("spin");
  while (syncing) await new Promise(r => setTimeout(r, 200)); // une synchro en cours finit d'abord (45 s au plus)
  const got = await cloudPull(true);
  b.classList.remove("spin"); b.classList.add("wait");
  clearTimeout(pullT); pullT = setTimeout(() => b.classList.remove("wait"), PULL_WAIT);
  if (got === null) toast("Pas de connexion au serveur : réessaie plus tard");
  else if (!got) toast("Rien de nouveau de ton assistant");
}
// Ce que l'assistant a déposé pour l'appli
function handleInbox(items) {
  let week = false; const msgs = [];
  for (const { id, kind, data: d } of items) {
    try {
      if (kind === "recipe") {
        for (const [k, a] of Object.entries(d.recipe.alim || {})) { S.alim[k] ||= a; AL[k] ||= a; }
        S.lib[d.id] = d.recipe; if (d.shared) { S.pubs[d.id] = 1; PUB[d.id] = d.recipe; }
        markFresh(d.id);
        msgs.push("nouvelle recette « " + d.recipe.nom + " »");
      } else if (kind === "goals") { S.cfg = { ...(S.cfg || {}), ...d }; applyCfg(); msgs.push("objectifs mis à jour"); }
      else if (kind === "food") {
        let at = d.at; while (S.food.some(f => f.at === at)) at = new Date(new Date(at).getTime() + 1).toISOString(); // l'heure sert d'identifiant
        const h = new Date(at).getHours();
        S.food.push({ nom: d.nom, kcal: d.kcal, prot: d.prot, meal: d.meal || (h < 10.5 ? "petitdej" : h < 15 ? "dejeuner" : h < 18 ? "collation" : "diner"), at });
        msgs.push("+ " + d.kcal + " kcal au journal");
      } else if (kind === "items") { // articles hors recettes ajoutés à la liste
        let n = 0;
        for (const it of d.items || []) {
          const nom = String(it.nom || "").trim();
          if (!nom || groups().some(r => r.items.some(i => !S.checked[i.id] && normTxt(i.nom) === normTxt(nom)))) continue; // déjà dans la liste
          S.extras.push({ id: "x" + Date.now().toString(36) + n, nom, qte: it.qte || "", rayon: RAY_ORDER.includes(it.rayon) ? it.rayon : "Divers" });
          n++;
        }
        if (n) msgs.push(`${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} à la liste`);
      } else if (kind === "swap") { // variante d'une recette (ingrédient remplacé) : elle prend la place de l'originale dans la semaine
        for (const [k, a] of Object.entries(d.recipe.alim || {})) { S.alim[k] ||= a; AL[k] ||= a; }
        S.lib[d.id] = d.recipe; markFresh(d.id);
        msgs.push(`${d.label} : « ${d.recipe.nom} »${swapInWeek(d.from, d.id) ? ", liste de courses mise à jour" : ""}`);
      } else if (kind === "pantry") {
        const n = addToPantry(d.items);
        if (n) msgs.push(`${n} produit${n > 1 ? "s" : ""} au placard`);
      } else if (kind === "receipt") {
        msgs.push(applyReceipt(d));
      } else if (kind === "week") {
        for (const [rid, r] of Object.entries(d.recipes || {})) if (!getR(rid)) { PUB[rid] = r; mergeAlim(r); }
        S.proposal = { items: d.items, goal: d.goal, note: d.note }; week = true;
      }
    } catch {}
    S.acks.push(id);
  }
  save(); render();
  if (msgs.length) toast("🤖 " + msgs.join(", "));
  if (week) showProposal();
}
function showProposal() {
  const p = S.proposal; if (!p) return;
  const items = p.items.filter(i => getR(i.recette)), semaine = items.flatMap(i => Array.from({ length: i.n }, () => ({ recette: i.recette })));
  openSheet(`<h3>🤖 Ton assistant propose une semaine</h3>
    ${p.note ? `<p class="sub">${esc(p.note)}</p>` : ""}
    <div class="list" style="margin:10px 0">${items.map(i => `<div class="row hist"><span class="txt">${getR(i.recette).emoji || "🍽️"} ${esc(getR(i.recette).nom)}<small>${getR(i.recette).kcal || "?"} kcal · ${getR(i.recette).prot || "?"} g prot. / portion</small></span><span class="qty">${i.n} portion${i.n > 1 ? "s" : ""}</span></div>`).join("")}</div>
    ${coverHTML(semaine, p.goal || goalOf())}
    <p class="sub">Si tu la lances, la liste de courses est recalculée (moins ce que tu as au placard) et les cases repartent de zéro.</p>
    <button class="primary wide" id="pgo2">Lancer cette semaine</button>
    <div class="two"><button id="plater">Plus tard</button><button id="pno">Refuser</button></div>`, () => {
    $("#plater").onclick = closeSheet;
    $("#pno").onclick = () => { delete S.proposal; save(); closeSheet(); };
    $("#pgo2").onclick = () => {
      if (!semaine.length) return toast("Aucune recette connue dans cette proposition");
      for (const i of items) if (!D.recettes[i.recette] && !S.lib[i.recette]) keep(i.recette); // gardée même si elle quitte le catalogue
      if (p.goal) S.goal = p.goal;
      for (const i of items) markFresh(i.recette);
      delete S.proposal; closeSheet(); startWeek(semaine, buildCourses(semaine));
    };
  });
}

// ---- Réglages (⚙️) ----
const goalsFormHTML = () => `<div class="two"><label class="sub">kcal par jour<input id="gk" type="number" inputmode="numeric" value="${D.kcalJour}"></label>
  <label class="sub">Protéines par jour (g)<input id="gp" type="number" inputmode="numeric" value="${D.protJour}"></label></div>`;
function saveGoals() {
  const k = +$("#gk").value, p = +$("#gp").value;
  if (k >= 800 && p >= 20 && (k !== D.kcalJour || p !== D.protJour)) { S.cfg = { ...(S.cfg || {}), kcalJour: Math.round(k), protJour: Math.round(p) }; applyCfg(); }
}
function sheetGoals() { // ouvert en touchant l'objectif dans le journal
  openSheet(`<h3>🎯 Mes objectifs</h3><p class="sub">Ce que tu vises chaque jour. Le journal et le calendrier se règlent dessus.</p>${goalsFormHTML()}
    <button class="primary wide" id="gsave" style="margin-top:14px">Enregistrer</button>`, () => {
    $("#gsave").onclick = () => {
      if (!(+$("#gk").value >= 800) || !(+$("#gp").value >= 20)) return toast("Au moins 800 kcal et 20 g de protéines");
      saveGoals(); save(); closeSheet(); render(); toast("Objectifs enregistrés");
    };
  });
}
function sheetWelcome() {
  openSheet(`<h3>👋 Bienvenue</h3>${ABOUT}
    <h4>Tes objectifs <small>(modifiables plus tard dans ⚙️)</small></h4>${goalsFormHTML()}
    <button class="primary wide" id="wok" style="margin-top:14px">C'est parti</button>
    <button class="link" id="wold" style="display:block;margin:10px auto 0">J'ai déjà mes données (code ou fichier)</button>`, () => {
    $("#wok").onclick = () => { saveGoals(); save(); closeSheet(); render(); toast("Va dans Recettes pour choisir tes plats 👩‍🍳"); };
    $("#wold").onclick = sheetData;
  });
}
function sheetSettings() {
  openSheet(`<h3>⚙️ Réglages</h3>
    <h4>Mes objectifs</h4>${goalsFormHTML()}
    <button class="wide" id="gsave" style="margin-top:10px">Enregistrer les objectifs</button>
    ${S.proposal ? `<button class="primary wide" id="sprop" style="margin-top:10px">🤖 Voir la semaine proposée par ton assistant</button>` : ""}
    <button class="wide" id="sassist" style="margin-top:10px">🤖 Connecter un assistant (Claude, ChatGPT…) ${S.sync ? "· activé ✓" : ""}</button>
    <button class="wide" id="sdata" style="margin-top:10px">💾 Mes données : exporter, importer, changer de téléphone</button>
    <h4>À propos</h4>${ABOUT}
    <p class="sub">Code source : <a href="https://github.com/hauretax/courses" target="_blank" rel="noopener">github.com/hauretax/courses</a></p>`, () => {
    $("#gsave").onclick = () => { saveGoals(); save(); closeSheet(); render(); toast("Objectifs enregistrés"); };
    $("#sassist").onclick = sheetAssistant;
    $("#sdata").onclick = sheetData;
    if ($("#sprop")) $("#sprop").onclick = showProposal;
  });
}
const mcpUrl = () => `${API}/mcp/${UID}`;
function sheetAssistant() {
  if (!S.sync) return openSheet(`<h3>🤖 Connecter un assistant</h3>
    <p class="sub">Un assistant (Claude, ChatGPT…) peut te préparer ta semaine : il connaît les recettes disponibles, ce que tu as au placard, ce que tu as mangé et les plats que tu as aimés. Il peut te proposer une semaine, créer des recettes, remplacer un ingrédient qui manque au magasin, ajouter des articles à ta liste, lire tes tickets de caisse et noter un repas dans ton journal.</p>
    <p class="sub">Pour ça, l'appli doit envoyer une <b>copie de tes données</b> (journal, placard, semaine, notes, recettes, et les photos de tes tickets de caisse pour qu'il les lise ; pas les photos de tes plats) sur le serveur, rangée sous ton code personnel. Sans cette option, rien de personnel ne quitte ton téléphone. Tu peux tout effacer du serveur quand tu veux.</p>
    <button class="primary wide" id="aon">Activer</button>`, () => {
    $("#aon").onclick = async () => {
      S.sync = true; rawSave(); syncBtn(); toast("Envoi de tes données…"); await cloudSync();
      if (!lastSync) { S.sync = false; rawSave(); syncBtn(); return toast("Pas de réseau : réessaie plus tard"); }
      sheetAssistant();
    };
  });
  openSheet(`<h3>🤖 Assistant connecté</h3>
    <p class="sub">Ajoute ce lien comme « connecteur personnalisé » (serveur MCP) dans ton assistant :</p>
    <div class="search"><input id="murl" readonly value="${esc(mcpUrl())}"><button id="mcopy" aria-label="Copier">📋</button></div>
    <p class="sub"><b>Claude</b> : Paramètres › Connecteurs › Ajouter un connecteur personnalisé, colle le lien.<br><b>ChatGPT</b> : Paramètres › Connecteurs › mode développeur › ajouter un serveur MCP.<br>Puis demande-lui par exemple « prépare-moi ma semaine ».</p>
    <div class="alert">🔑 Ce lien contient ton code personnel : c'est ton mot de passe, ne le partage pas. Note-le : il permet aussi de retrouver tes données sur un autre téléphone.</div>
    <p class="sub">Dernier envoi : ${S.syncAt ? fmtWhen(S.syncAt) : "jamais"}. L'envoi se fait tout seul quand tu utilises l'appli.</p>
    <button class="wide" id="anow">🔄 Envoyer maintenant</button>
    <button class="wide" id="anew" style="margin-top:10px">Changer de code (l'ancien lien ne marchera plus)</button>
    <button class="wide" id="aoff" style="margin-top:10px;color:#d33">Désactiver et effacer mes données du serveur</button>`, () => {
    $("#mcopy").onclick = async () => { try { await navigator.clipboard.writeText(mcpUrl()); toast("Lien copié"); } catch { $("#murl").select(); toast("Sélectionné : copie-le"); } };
    $("#anow").onclick = async () => { const t = lastSync; await cloudSync(); toast(lastSync !== t ? "Données envoyées ✓" : "Envoi impossible (réseau ?)"); if (lastSync !== t && $("#anow")) sheetAssistant(); };
    const wipe = async () => { try { await cloudFetch("/api/sync", "DELETE"); return true; } catch { toast("Pas de réseau : réessaie plus tard"); return false; } };
    $("#aoff").onclick = async () => { if (confirm("Effacer tes données du serveur ? L'assistant n'y aura plus accès. Rien ne change sur ton téléphone.") && await wipe()) { S.sync = false; rawSave(); syncBtn(); closeSheet(); toast("Effacé du serveur"); } };
    $("#anew").onclick = async () => {
      if (!confirm("Créer un nouveau code ? Il faudra remettre le nouveau lien dans ton assistant.") || !await wipe()) return;
      try { localStorage.setItem(UID_KEY, UID = newUid()); } catch {}
      lastSync = 0; await cloudSync(); sheetAssistant();
    };
  });
}
// Remplace toutes les données de l'appli (import d'un fichier, ou restauration par code), puis recharge
async function replaceState(etat, photos, uid) {
  for (const [k, a] of Object.entries(photos || {})) await tkSavePhotos(k, a).catch(() => {});
  localStorage.setItem(KEY, JSON.stringify({ ...etat, welcome: 1 }));
  if (uid) localStorage.setItem(UID_KEY, uid);
  location.reload();
}
function sheetData() {
  openSheet(`<h3>💾 Mes données</h3>
    <p class="sub">Tout est gardé sur cet appareil. Un fichier JSON contient tout : journal, plats cuisinés, notes, placard, tickets et prix, recettes.</p>
    <button class="wide" id="dexp">⬇️ Exporter (sans les photos)</button>
    <button class="wide" id="dexpp" style="margin-top:10px">⬇️ Exporter avec les photos (fichier lourd)</button>
    <button class="wide" id="dimp" style="margin-top:10px">⬆️ Importer un fichier exporté</button>
    <input type="file" id="dfile" accept="application/json,.json" hidden>
    <h4>Retrouver mes données avec mon code</h4>
    <p class="sub">Si tu avais activé « Connecter un assistant » sur un autre téléphone, colle ici ton code (ou ton lien).</p>
    <form class="search" id="dform"><input id="dcode" placeholder="Code personnel" autocomplete="off" autocapitalize="off"><button aria-label="Restaurer">↩︎</button></form>`, () => {
    $("#dexp").onclick = () => { closeSheet(); exportData(false); };
    $("#dexpp").onclick = () => { closeSheet(); exportData(true); };
    $("#dimp").onclick = () => $("#dfile").click();
    $("#dfile").onchange = async e => {
      try {
        const j = JSON.parse(await e.target.files[0].text());
        if (j.app !== "courses" || !j.etat) throw 0;
        if (!confirm("Remplacer toutes les données de cet appareil par celles du fichier ?")) return;
        await replaceState(j.etat, j.photos);
      } catch { toast("Ce fichier n'est pas un export de l'appli"); }
    };
    $("#dform").onsubmit = async e => {
      e.preventDefault();
      const code = ($("#dcode").value.trim().toLowerCase().match(/[a-z0-9]{20,40}$/) || [])[0];
      if (!code) return toast("Code invalide");
      try {
        const j = await cloudFetch("/api/sync", "GET", null, code);
        if (!j.backup) throw new Error("pas de sauvegarde pour ce code");
        if (!confirm("Remplacer toutes les données de cet appareil par celles de ton code ?")) return;
        await replaceState({ ...j.backup, sync: true }, null, code);
      } catch (err) { toast(navigator.onLine ? "Impossible : " + err.message : "Pas de réseau"); }
    };
  });
}
