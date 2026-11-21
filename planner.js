// ---- Nouvelle semaine, nouvelle recette, nouvel aliment, accompagnements, « autre à la place » ----
// Chargé après placard.js, avant app.js. Utilise S, D, AL, getR, allIds, curIngs, gramsOf, nutOf, normIng, stockOf, LOCS, num, esc, render…

// Rayon des aliments d'origine (les nouveaux portent un champ ray) : sert à ranger la liste de courses générée
const RAY = {
  boeuf: "Viande et poisson", poulet: "Viande et poisson", jambon: "Viande et poisson",
  poireau: "Fruits et légumes", oignon: "Fruits et légumes", oignonr: "Fruits et légumes", poivron: "Fruits et légumes",
  tomate: "Fruits et légumes", salade: "Fruits et légumes", pdt: "Fruits et légumes", carotte: "Fruits et légumes",
  courgette: "Fruits et légumes", champi: "Fruits et légumes", ail: "Fruits et légumes", gingembre: "Fruits et légumes",
  citron: "Fruits et légumes", fruit: "Fruits et légumes", banane: "Fruits et légumes",
  oeuf: "Crèmerie et frais", fblanc: "Crèmerie et frais", ygrec: "Crèmerie et frais", skyr: "Crèmerie et frais",
  emmental: "Crèmerie et frais", cheddar: "Crèmerie et frais", brisee: "Crèmerie et frais", feuilletee: "Crèmerie et frais",
  beurre: "Crèmerie et frais", creme: "Crèmerie et frais",
  concassees: "Épicerie", haricots: "Épicerie", riz: "Épicerie", pates: "Épicerie", avoine: "Épicerie", pain: "Épicerie",
  cornichon: "Épicerie", moutarde: "Épicerie", huile: "Épicerie", chocolat: "Épicerie", sucre: "Épicerie",
  cassonade: "Épicerie", poires: "Épicerie",
  cumin: "Épices", paprika: "Épices", garam: "Épices", curcuma: "Épices", muscade: "Épices"
};
const RAY_ORDER = ["Viande et poisson", "Fruits et légumes", "Crèmerie et frais", "Épicerie", "Surgelés", "Épices", "Divers"];
const RAY_LOC = { frigo: "Crèmerie et frais", congel: "Surgelés", placard: "Épicerie", epices: "Épices" };
const UNIT_TXT = { g: "g", pc: "", cc: "c. à c.", cs: "c. à s." };
const rayOf = k => RAY[k] || (AL[k] || {}).ray || RAY_LOC[(AL[k] || {}).loc] || "Divers";
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const slug = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_");
const alimKey = n => Object.keys(AL).find(k => [AL[k].n, AL[k].np || ""].some(x => x.toLowerCase() === n.trim().toLowerCase()));
const wkKey = () => dateKey(weekStart()); // identifiant de la semaine (repère les accompagnements cochés)
const weekIds = () => [...new Set(D.semaine.flatMap(d => [d.recette, ...(d.avec || []).filter(s => s.rid).map(s => s.rid)]))].filter(getR);
const P = { items: [], goal: 15, rec: null, view: "plan" }; // items : { recette, n portions }

// Une portion consommée retire sa part des ingrédients du placard (quantité de la recette ÷ portions)
function stockPortion(id, frac) {
  const r = getR(id); if (!r || !frac) return [];
  S.pre ||= {}; S.pre[id] = (S.pre[id] || 0) + frac; // mémorisé : la fin de cuisson ne le retirera pas une 2e fois
  return curIngs(id, true).filter(g => !g.free && g.k).flatMap(g => useStock(g.k, gramsOf(g) / (r.n || 1) * frac));
}
// ---- Nouvel aliment (fruits, légumes, cueillette…) : partagé par toutes les fiches ----
// done(clé) est appelé une fois l'aliment créé, pour rouvrir la fiche d'origine
function openNewAliment(pre, done) {
  let loc = "frigo";
  openSheet(`<h3>Nouvel aliment</h3>
    <form id="nform" class="qform">
      <input id="nn" placeholder="Nom (ex. pommes de terre de cueillette)" value="${esc(pre || "")}" required autocomplete="off">
      <input id="nnp" placeholder="Pluriel (facultatif)" autocomplete="off">
      <div class="two"><input id="nk" type="number" inputmode="decimal" step="any" placeholder="kcal / 100 g"><input id="np100" type="number" inputmode="decimal" step="any" placeholder="protéines / 100 g"></div>
      <div class="two"><input id="npc" type="number" inputmode="decimal" step="any" placeholder="g par pièce (facultatif)"><input id="ne" maxlength="4" value="🍽️"></div>
      <label class="sub">Rayon de la liste de courses</label>
      <select id="nray">${RAY_ORDER.map(r => `<option>${r}</option>`).join("")}</select>
      <label class="sub">Où il se range</label>
      <div class="chips" id="nloc">${LOCS.map(([k, n, e]) => `<button type="button" data-loc="${k}" class="${k === loc ? "cur" : ""}">${e} ${n}</button>`).join("")}</div>
      <p class="sub">kcal et protéines : ceux de l'emballage ou d'une appli (ex. CIQUAL). Vide = pas de calcul.</p>
      <button class="primary wide">Créer l'aliment</button></form>`, () => {
    $("#nn").focus();
    $("#sheet").onclick = e => {
      const l = e.target.closest("[data-loc]");
      if (l) { loc = l.dataset.loc; document.querySelectorAll("#nloc button").forEach(b => b.classList.toggle("cur", b === l)); }
    };
    $("#nform").onsubmit = e => {
      e.preventDefault();
      const nom = $("#nn").value.trim(); if (!nom) return;
      const k = "a" + Date.now().toString(36), pc = +$("#npc").value || 0, np = $("#nnp").value.trim();
      const al = { n: nom, ...(np ? { np } : {}), k: +$("#nk").value || 0, p: +$("#np100").value || 0, loc, e: $("#ne").value.trim() || "🍽️", ray: $("#nray").value, ...(pc ? { pc } : {}) };
      AL[k] = al; S.alim ||= {}; S.alim[k] = al; save(); closeSheet(); toast(`${nom} ajouté`); done(k);
    };
  });
}

// ---- Nouvelle semaine : courses générées depuis les recettes, moins le placard ----
function qteOf(k, g) {
  const a = AL[k] || {};
  if (a.pc) return String(Math.max(1, Math.ceil(g / a.pc - 0.2))); // en pièces si l'aliment a un poids moyen
  return g >= 1000 ? `${num(g / 1000)} kg` : `${Math.round(g)} g`;
}
// Portions d'un plat déjà cuisiné, de côté au frigo ou au congélateur (par recette, ou par nom pour un plat ajouté à la main)
function asideOf(id) {
  const r = getR(id), nom = (r && r.nom || "").toLowerCase();
  return (S.plats || []).filter(p => p.rid === id || (!p.rid && nom && (p.nom || "").toLowerCase() === nom)).reduce((a, p) => a + (p.n || 0), 0);
}
// Une recette qui revient plusieurs fois dans la semaine = une cuisson par tranche de « portions ».
// Les portions déjà de côté se mangent d'abord : on ne recuisine (et n'achète) que ce qui manque.
function buildCourses(semaine) {
  const counts = {};
  for (const d of semaine) for (const id of [d.recette, ...(d.avec || []).map(s => s.rid).filter(Boolean)]) counts[id] = (counts[id] || 0) + 1;
  const need = {}, frees = new Set();
  for (const [k, g] of D.hebdo || []) need[k] = (need[k] || 0) + g; // petits-déjeuners de la semaine
  for (const [id, total] of Object.entries(counts)) {
    const r = getR(id); if (!r) continue;
    const n = total - asideOf(id);
    if (n <= 0) continue; // tout est déjà de côté : rien à cuisiner ni à acheter
    const batches = Math.ceil(n / (r.n || 1));
    for (const g of curIngs(id, true)) {
      if (g.free) frees.add(g.t);
      else if (g.k) need[g.k] = (need[g.k] || 0) + gramsOf(g) * batches;
    }
  }
  const groups = {}, add = (ray, it) => (groups[ray] ||= []).push(it);
  for (const [k, g] of Object.entries(need)) {
    const stock = stockOf(k), left = g - stock;
    if (left < 1) continue;
    const a = AL[k] || {}, qte = qteOf(k, left);
    add(rayOf(k), [`g_${k}`, cap(a.pc && +qte > 1 && a.np ? a.np : a.n), qte + (stock ? ` (− ${Math.round(stock)} g au placard)` : ""), k, Math.round(left)]);
  }
  for (const t of frees) add("Épices", [`t_${slug(t)}`, cap(t), "", null, 0]); // « sel, poivre, 1/2 citron » : à vérifier chez soi
  return RAY_ORDER.filter(r => groups[r]).map(r => ({ rayon: r, items: groups[r] }));
}
// Une recette de la semaine remplacée par une autre (ex. variante sans poivron, envoyée par l'assistant) : seuls les articles
// touchés par le changement bougent dans la liste ; le reste (cases cochées, déjà au placard, ajouts à la main) ne change pas.
function swapInWeek(from, to) {
  const sem = S.plan && S.plan.semaine;
  if (!sem || !sem.some(d => d.recette === from || (d.avec || []).some(x => x.rid === from))) return false;
  const before = sem.map(d => ({ ...d, avec: d.avec && d.avec.map(x => ({ ...x })) }));
  for (const d of sem) { if (d.recette === from) d.recette = to; for (const x of d.avec || []) if (x.rid === from) x.rid = to; }
  patchCourses(before, sem);
  return true;
}
function patchCourses(oldSem, newSem) {
  const flat = c => Object.fromEntries(c.flatMap(r => r.items.map(i => [i[0], [r.rayon, i]])));
  const a = flat(buildCourses(oldSem)), b = flat(buildCourses(newSem)), kept = id => S.checked[id] || S.stored[id] || (S.have || {})[id];
  let cur = S.plan.courses.map(r => ({ ...r, items: r.items.filter(i => b[i[0]] || !a[i[0]] || kept(i[0])) })); // plus besoin : retiré (sauf déjà acheté)
  for (const [id, [ray, it]] of Object.entries(b)) {
    if (a[id] && a[id][1][4] === it[4]) continue; // quantité inchangée
    const r0 = cur.find(r => r.items.some(i => i[0] === id));
    if (r0) {
      if (S.checked[id] && it[4] > (r0.items.find(i => i[0] === id)[4] || 0) && !S.stored[id]) delete S.checked[id]; // il en faut plus : à reprendre
      r0.items = r0.items.map(i => i[0] === id ? it : i);
    } else {
      let r = cur.find(r => r.rayon === ray);
      if (!r) cur.push(r = { rayon: ray, items: [] });
      r.items.push(it);
    }
  }
  cur = cur.filter(r => r.items.length).sort((x, y) => RAY_ORDER.indexOf(x.rayon) - RAY_ORDER.indexOf(y.rayon));
  S.plan.courses = D.courses = cur;
}
// Changement de semaine (chaque samedi) : les repas validés la semaine d'avant partent dans le journal (figés)
// et les compteurs « mangé » repartent de zéro. Sans ça, les repas restaient « Finis » d'une semaine sur l'autre.
function rollWeek() {
  S.log ||= []; S.eaten ||= {}; S.food ||= [];
  const ws = weekStart(), old = S.log.filter(e => new Date(e.at) < ws);
  if (!old.length) return;
  const keep = S.log.filter(e => new Date(e.at) >= ws);
  S.log = old;
  S.food = S.food.concat(dayEntriesAll().map(e => ({ nom: e.nom, kcal: Math.round(e.kcal), prot: Math.round(e.prot), meal: "diner", at: e.at })).filter(e => e.kcal));
  S.log = keep; S.eaten = {}; S.pre = {};
  for (const e of keep) if (!e.rid) S.eaten[e.i] = e.to;
  save();
}
// Plan d'origine de l'appli (semaine du 7 novembre), gardé pour nommer les repas validés à l'époque
const PLAN_V1 = ["burger", "chili", "tikka", "chili", "tarte", "tikka", "tarte"];
// Les repas validés par numéro de jour (ancien onglet Semaine) dépendent du plan en cours : avant d'en changer,
// on les fige dans le journal avec leur nom et leurs kcal. N'utilise ni save ni dateKey (appelé avant leur définition).
function freezeDayLogs(ids) {
  S.log ||= []; S.food ||= [];
  for (const e of S.log) {
    if (e.rid) continue;
    const id = ids[e.i], r = id && getR(id), f = (e.to - e.from) / 100;
    if (!r || !(f > 0)) continue;
    const pp = portionOf(id);
    S.food.push({ nom: `${r.emoji} ${r.nom}`, kcal: Math.round(pp.kcal * f), prot: Math.round(pp.prot * f), meal: "diner", at: e.at });
  }
  S.log = S.log.filter(e => e.rid); S.eaten = {};
}
// Vide la liste de courses (cases, articles ajoutés, « déjà au placard ») et le placard ; ne garde, dans les plats de côté,
// que ceux dont la recette ou le nom figure dans garde. La liste de courses est ensuite recalculée sans stock à déduire.
function resetStock(garde = [], ajoute = []) {
  Object.assign(S, { checked: {}, stored: {}, have: {}, extras: [], pantry: [], pre: {} });
  fixPlats(garde, ajoute);
  if (S.plan) S.plan.courses = buildCourses(S.plan.semaine);
}
// Plats de côté : ne garde que ceux dont la recette ou le nom figure dans garde, et crée ceux de ajoute s'ils manquent
// (nom, kcalP, protP facultatifs : sinon ceux de la recette)
function fixPlats(garde = [], ajoute = []) {
  const ok = p => garde.some(g => p.rid === g || (p.nom || "").toLowerCase().includes(g));
  S.plats = (S.plats || []).filter(ok);
  for (const a of ajoute) if (getR(a.rid) && !S.plats.some(ok)) {
    const r = getR(a.rid), pp = portionOf(a.rid);
    addPlat({ nom: a.nom || r.nom, emoji: r.emoji, n: a.n || 1, kcalP: a.kcalP ?? pp.kcal, protP: a.protP ?? pp.prot, loc: a.loc || "frigo", rid: a.rid });
  }
}
// Efface du journal tout ce qui a été mangé un jour donné (clé AAAA-MM-JJ, heure locale) : aliments saisis et plats déclarés.
// Les cuissons, le placard et les notes ne bougent pas. N'utilise pas dateKey (appelé avant sa définition).
function resetDay(key) {
  const k = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  S.food = (S.food || []).filter(f => k(f.at) !== key);
  S.log = (S.log || []).filter(e => k(e.at) !== key);
  S.eaten = {}; for (const e of S.log) if (!e.rid) S.eaten[e.i] = e.to;
}
function applyPlan() {
  D.coursesBase ||= D.courses; // liste écrite à la main d'origine : les anciens tickets s'y réfèrent
  // Un nouveau plan livré avec l'appli (recettes.js, semaineId) remplace le plan en cours, une seule fois :
  // liste de courses recalculée, cases décochées. Pas de save() ici : l'état part au prochain enregistrement.
  if (D.semaineId && S.planId !== D.semaineId) {
    freezeDayLogs(S.plan ? S.plan.semaine.map(d => d.recette) : PLAN_V1);
    S.planId = D.semaineId;
    S.plan = { semaine: D.semaine, courses: buildCourses(D.semaine) };
    Object.assign(S, { checked: {}, stored: {}, have: {}, extras: [] });
  }
  if (D.reset && S.resetId !== D.reset) { S.resetId = D.reset; resetStock(D.resetGarde, D.resetAjoute); } // une seule fois par valeur de reset
  if (D.platsFix && S.platsFixFait !== D.platsFix.id) { S.platsFixFait = D.platsFix.id; fixPlats(D.platsFix.garde, D.platsFix.ajoute); } // une seule fois
  if (D.resetJour && S.resetJourFait !== D.resetJour) { S.resetJourFait = D.resetJour; resetDay(D.resetJour); } // une seule fois
  // Une seule fois : la liste en cours avait été calculée sans tenir compte des plats de côté (ex. bœuf haché d'un plat déjà au congélateur)
  if (S.plan && S.coursesPlatsFix !== 1) { S.coursesPlatsFix = 1; S.plan.courses = buildCourses(S.plan.semaine); }
  if (S.plan) { D.semaine = S.plan.semaine; D.courses = S.plan.courses; }
}
function startWeek(semaine, courses) {
  S.food ||= [];
  // Ce qui a été mangé la semaine passée part dans le journal (figé), avant de changer de plan
  S.food = S.food.concat(dayEntriesAll().map(e => ({ nom: e.nom, kcal: Math.round(e.kcal), prot: Math.round(e.prot), meal: "diner", at: e.at })).filter(e => e.kcal));
  Object.assign(S, { checked: {}, eaten: {}, log: [], steps: {}, ings: {}, sess: {}, stored: {}, have: {}, extras: [], pre: {} });
  S.plan = { semaine, courses }; S.weekStart = new Date().toISOString();
  applyPlan(); save(); closePlan(); toast("Nouvelle semaine lancée 🎉");
}
// Formulaire de recette ouvert seul, depuis l'onglet Recettes (sans passer par la nouvelle semaine)
function openRecipeForm() { P.rec = newRec(); P.view = "recipe"; P.solo = true; $("#plan").classList.add("open"); drawRecipe(); }
function openPlanner() {
  P.solo = false;
  const c = {}; for (const d of D.semaine) c[d.recette] = (c[d.recette] || 0) + 1;
  P.items = Object.entries(c).map(([recette, n]) => ({ recette, n })); P.goal = goalOf();
  P.view = "plan"; $("#plan").classList.add("open"); drawPlan();
}
function closePlan() { $("#plan").classList.remove("open"); $("#plan").innerHTML = ""; render(); }
// Le plan : une entrée par portion prévue
const planSemaine = () => P.items.flatMap(it => Array.from({ length: Math.max(0, Math.round(+it.n || 0)) }, () => ({ recette: it.recette })));
const planInfo = it => { const r = getR(it.recette), n = Math.max(0, Math.round(+it.n || 0)), b = Math.ceil(n / (r.n || 1)); return `${tagHTML(it.recette)}${b} fournée${b > 1 ? "s" : ""} de ${r.n || 1} portion${(r.n || 1) > 1 ? "s" : ""}`; };
function startFromPlan() {
  const semaine = planSemaine();
  if (!semaine.length) return toast("Ajoute au moins un plat");
  if (!confirm("Lancer cette semaine ? La liste de courses est recalculée et les cases repartent de zéro.")) return;
  S.goal = P.goal; startWeek(semaine, buildCourses(semaine));
}
function drawPlan() {
  const ids = allIds().sort((a, b) => getR(a).nom.localeCompare(getR(b).nom));
  $("#plan").innerHTML = `<header><button id="plx" aria-label="Fermer">←</button><h1>Nouvelle semaine</h1></header>
  <main>
    <p class="sub">Choisis ce que tu cuisines et combien de portions. Un repas, c'est une source de protéines et des légumes : il en faut autant de portions que de repas. Le féculent est facultatif.</p>
    <label class="qtyrow">Repas à couvrir <input id="pgoal" type="number" inputmode="numeric" min="1" value="${P.goal}"></label>
    <div id="pcover">${coverHTML(planSemaine(), P.goal)}</div>
    <h2>Ce que tu cuisines</h2>
    <div class="list">${P.items.map((it, i) => `<div class="plrow">
      <div class="pltop"><select data-pit="${i}">${ids.map(id => `<option value="${esc(id)}" ${id === it.recette ? "selected" : ""}>${esc(getR(id).emoji || "")} ${esc(getR(id).nom)}</option>`).join("")}</select>
        <input data-pn="${i}" class="pn" type="number" inputmode="numeric" min="0" value="${it.n}" aria-label="Portions"><button class="note" data-pdel="${i}" aria-label="Retirer">✕</button></div>
      <div class="sub" data-pinfo="${i}">${planInfo(it)}</div>
    </div>`).join("") || `<p class="empty">Aucun plat.</p>`}</div>
    <p class="sub">Le nombre est en portions. La liste de courses compte des fournées entières, moins ce que tu as au placard.</p>
    <button class="wide" id="padd" style="margin-top:10px">＋ Ajouter un plat</button>
    <button class="wide" id="pnewrec" style="margin-top:10px">＋ Nouvelle recette</button>
    <button class="primary wide" id="pgo" style="margin-top:10px">Démarrer cette semaine</button>
  </main>`;
  const cover = () => { $("#pcover").innerHTML = coverHTML(planSemaine(), P.goal); };
  $("#plan").onclick = e => {
    if (e.target.closest("#plx")) return closePlan();
    if (e.target.closest("#pnewrec")) { P.rec = newRec(); P.view = "recipe"; return drawRecipe(); }
    if (e.target.closest("#pgo")) return startFromPlan();
    if (e.target.closest("#padd")) { const id = ids.find(x => !P.items.some(it => it.recette === x)) || ids[0]; P.items.push({ recette: id, n: getR(id).n || 1 }); return drawPlan(); }
    const del = e.target.closest("[data-pdel]");
    if (del) { P.items.splice(+del.dataset.pdel, 1); drawPlan(); }
  };
  $("#plan").oninput = $("#plan").onchange = e => {
    const t = e.target;
    if (t.id === "pgoal") { P.goal = Math.max(1, +t.value || 1); cover(); }
    if (t.dataset.pn != null) { const it = P.items[t.dataset.pn]; it.n = t.value; cover(); document.querySelector(`[data-pinfo="${t.dataset.pn}"]`).innerHTML = planInfo(it); }
    if (t.dataset.pit != null && e.type === "change") { const it = P.items[t.dataset.pit]; it.recette = t.value; it.n = getR(t.value).n || 1; drawPlan(); }
  };
}

// ---- Nouvelle recette (depuis le planificateur) ----
const newRec = () => ({ nom: "", emoji: "🍽️", types: [...DEFAUT], n: 2, temps: "", steps: "", ings: [0, 1, 2, 3].map(() => ({ name: "", q: "", u: "g" })) });
function drawRecipe() {
  const RC = P.rec, UN = { g: "g", pc: "pièce(s)", cc: "c. à c.", cs: "c. à s." };
  const rows = RC.ings.map((g, i) => `<div class="ingrow">
      <input data-ri="${i}" data-rk="name" list="alist2" placeholder="Aliment ou texte" value="${esc(g.name)}" autocomplete="off">
      <input data-ri="${i}" data-rk="q" type="number" inputmode="decimal" step="any" placeholder="Qté" value="${esc(g.q)}">
      <select data-ri="${i}" data-rk="u">${Object.entries(UN).map(([u, n]) => `<option value="${u}" ${g.u === u ? "selected" : ""}>${n}</option>`).join("")}</select></div>`).join("");
  $("#plan").innerHTML = `<header><button id="rback" aria-label="Retour">←</button><h1>Nouvelle recette</h1></header>
  <main>
    <div class="qform">
      <div class="two"><input data-rf="emoji" value="${esc(RC.emoji)}" maxlength="4" style="max-width:80px"><input data-rf="nom" placeholder="Nom de la recette" value="${esc(RC.nom)}" autocomplete="off"></div>
      <div class="two"><input data-rf="n" type="number" inputmode="numeric" min="1" value="${RC.n}" placeholder="Portions"><input data-rf="temps" placeholder="Temps (ex. 30 min)" value="${esc(RC.temps)}"></div>
      <div class="chips">${Object.entries(TYPES).map(([t, [e, n]]) => `<button type="button" data-rtype="${t}" class="${RC.types.includes(t) ? "cur" : ""}">${e} ${n}</button>`).join("")}</div>
    </div>
    <h2>Ingrédients</h2>
    <div class="list">${rows}</div>
    <datalist id="alist2">${Object.values(AL).map(a => `<option value="${esc(a.n)}">`).join("")}</datalist>
    <div class="quick" style="margin:10px 0"><button id="ringadd">+ Ingrédient</button><button id="rnewal" class="link">Pas dans la liste ? Crée l'aliment</button></div>
    <h2>Étapes · une par ligne</h2>
    <textarea data-rf="steps" rows="6" placeholder="Fais revenir l'oignon…">${esc(RC.steps)}</textarea>
    <p class="sub">Les kcal et protéines se calculent à partir des ingrédients.</p>
    <label class="sharerow"><input type="checkbox" data-rf="pub" ${RC.pub ? "checked" : ""}> 🌍 La partager avec tout le monde (tu pourras la retirer)</label>
    <label class="sharerow"><input type="checkbox" data-rf="pub" ${RC.pub ? "checked" : ""}> 🌍 La partager avec tout le monde (tu pourras la retirer)</label>
    <button class="primary wide" id="rsave" style="margin-top:12px">Enregistrer la recette</button>
  </main>`;
  $("#plan").onclick = e => {
    if (e.target.closest("#rback")) { P.view = "plan"; return P.solo ? closePlan() : drawPlan(); }
    const rt = e.target.closest("[data-rtype]");
    if (rt) { const t = rt.dataset.rtype; RC.types = RC.types.includes(t) ? RC.types.filter(x => x !== t) : [...RC.types, t]; return rt.classList.toggle("cur"); }
    if (e.target.closest("#ringadd")) { RC.ings.push({ name: "", q: "", u: "g" }); return drawRecipe(); }
    if (e.target.closest("#rnewal")) { const a = document.activeElement; return openNewAliment(a && a.dataset.rk === "name" ? a.value : "", () => drawRecipe()); }
    if (e.target.closest("#rsave")) return saveRecipe();
  };
  $("#plan").oninput = $("#plan").onchange = e => {
    const t = e.target;
    if (t.dataset.rf) RC[t.dataset.rf] = t.type === "checkbox" ? t.checked : t.dataset.rf === "n" ? Math.max(1, +t.value || 1) : t.value;
    if (t.dataset.ri != null) RC.ings[t.dataset.ri][t.dataset.rk] = t.value;
  };
}
function saveRecipe() {
  const RC = P.rec;
  if (!RC.nom.trim()) return toast("Donne un nom à la recette");
  const ingredients = RC.ings.filter(g => g.name.trim()).map(g => {
    const k = alimKey(g.name), q = +g.q;
    if (k && q) return [q, g.u, k];
    return q ? `${num(q)} ${UNIT_TXT[g.u] || ""} ${g.name.trim()}`.replace(/\s+/g, " ") : g.name.trim();
  });
  const n = RC.n || 1;
  const tot = ingredients.map(normIng).reduce((a, g) => { const x = nutOf(g); return { k: a.k + x.k, p: a.p + x.p }; }, { k: 0, p: 0 });
  const kcal = Math.round(tot.k / n), prot = Math.round(tot.p / n), id = "r" + Date.now().toString(36);
  S.lib[id] = { nom: RC.nom.trim(), types: RC.types.length ? Object.keys(TYPES).filter(t => RC.types.includes(t)) : [...DEFAUT], emoji: RC.emoji.trim() || "🍽️", n, portions: `${n} ${n > 1 ? "portions" : "portion"}`, temps: RC.temps.trim() || "—",
    macros: `${kcal} kcal · ${prot} g prot. / portion`, kcal, prot, ingredients, etapes: RC.steps.split("\n").map(s => s.trim()).filter(Boolean) };
  save(); P.view = "plan"; P.rec = null; P.solo ? closePlan() : drawPlan();
  toast(`« ${RC.nom.trim()} » ajoutée à tes recettes`);
  if (RC.pub) publishRecipe(id);
  if (RC.pub) publishRecipe(id);
}

// ---- Déclarer un repas sans cuisson (plat acheté, reste, dessert d'un coloc…) : il part dans le journal ----
// Si la recette n'a pas été cuisinée cette semaine, les ingrédients de la part sont retirés du placard.
function sheetDeclare(pre) {
  const ids = allIds().sort((a, b) => getR(a).nom.localeCompare(getR(b).nom));
  openSheet(`<h3>Déclarer un repas sans cuisson</h3>
    <p class="sub">Pour un plat que tu n'as pas cuisiné toi-même cette semaine. 100 = une portion.</p>
    <form id="dform" class="qform">
      <select id="dr">${ids.map(id => `<option value="${esc(id)}" ${id === pre ? "selected" : ""}>${esc(getR(id).emoji || "")} ${esc(getR(id).nom)}</option>`).join("")}</select>
      <div class="stepper small"><input id="dp" type="number" inputmode="numeric" min="5" max="1000" step="5" value="100"><span>% d'une portion</span></div>
      <button class="primary wide">Ajouter au journal</button></form>`, () => {
    $("#dform").onsubmit = e => {
      e.preventDefault();
      const rid = $("#dr").value, pct = Math.max(5, Math.min(1000, +$("#dp").value || 100));
      const used = !doneThisWeek(rid) ? stockPortion(rid, pct / 100) : [];
      S.log.push({ rid, from: 0, to: pct, at: new Date().toISOString() });
      buzz(60); save(); closeSheet(); render();
      toast(used.length ? `Déclaré · retiré du placard : ${used.join(", ")}` : "Repas déclaré 🎉");
    };
  });
}
