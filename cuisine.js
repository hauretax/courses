// ---- Cuisine : recettes de la semaine, bibliothèque, mode cuisine, sessions chronométrées, notes ----
// Chargé après journal.js et avant app.js. Utilise S, D, $, esc, save, toast, buzz, openSheet… à l'appel.

const AL = window.DATA.aliments || {};
const UNIT_G = { cc: 3, cs: 15 };
const de = n => (/^[aeiouyéèêàâîôœ]/i.test(n) ? "d'" : "de ") + n;
const num = x => String(Math.round(x * 100) / 100).replace(".", ",");
const euro = x => x.toFixed(2).replace(".", ",") + " €";
const stars = n => "★".repeat(n) + "☆".repeat(5 - n);
const durTxt = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
const fmtDate = iso => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

// ---- Ingrédients ----
// Forme normalisée : { q, u, k, t } ; un ingrédient texte (anciennes recettes, « sel, poivre ») reste libre.
function normIng(x) {
  if (typeof x === "string") return { t: x, free: true };
  if (Array.isArray(x)) { const [q, u, k, t] = x; return { q, u, k, t }; }
  return { ...x };
}
const gramsOf = g => g.free ? 0 : g.u === "g" ? g.q : g.u === "pc" ? g.q * ((AL[g.k] || {}).pc || 0) : g.q * (UNIT_G[g.u] || 0);
const nameOf = (g, plural) => { const a = AL[g.k]; return g.t || (a ? (plural && a.np) || a.n : g.k); };
function ingLabel(g) {
  if (g.free) return g.t;
  const a = AL[g.k] || {};
  if (g.u === "g") return `${num(g.q)} g ${de(nameOf(g))}`;
  if (g.u === "pc") return `${num(g.q)} ${nameOf(g, g.q > 1)}` + (a.pc >= 20 ? ` (≈ ${Math.round(gramsOf(g))} g)` : "");
  return `${num(g.q)} ${g.u === "cc" ? "c. à c." : "c. à s."} ${de(nameOf(g))}`;
}
const nutOf = g => { const a = AL[g.k], w = gramsOf(g); return a ? { k: w * a.k / 100, p: w * a.p / 100 } : { k: 0, p: 0 }; };

// ---- Recettes connues : celles de la semaine + la bibliothèque (copies gardées pour plus tard) ----
function initCuisine() { // appelé par app.js une fois l'état chargé
  S.lib ||= {}; S.favs ||= {}; S.cooks ||= []; S.notes ||= {}; S.sess ||= {}; S.prix ||= {};
  S.alim ||= {}; Object.assign(AL, S.alim); // aliments ajoutés par toi (fruits, cueillette…)
  // Recettes sans kcal indiqués : calculés depuis les ingrédients, par portion
  for (const r of Object.values(D.recettes)) if (r.kcal == null) {
    const t = r.ingredients.map(normIng).reduce((a, g) => { const x = nutOf(g); return { k: a.k + x.k, p: a.p + x.p }; }, { k: 0, p: 0 }), n = r.n || 1;
    r.kcal = Math.round(t.k / n / 10) * 10; r.prot = Math.round(t.p / n);
    r.macros = `${r.kcal} kcal · ${r.prot} g prot. / portion`;
  }
  for (const [id, r] of Object.entries(S.favs)) if (r && typeof r === "object" && !S.lib[id]) S.lib[id] = r; // anciens favoris
}
// Livrées avec l'appli, puis les miennes (et celles gardées), puis celles de la communauté (PUB, cloud.js)
const getR = id => D.recettes[id] || S.lib[id] || PUB[id];
const allIds = () => [...new Set([...Object.keys(D.recettes), ...Object.keys(S.lib), ...Object.keys(PUB)])].filter(getR);
const isFav = id => !!S.favs[id];
// ---- Étiquettes : ce qu'apporte une recette, pour savoir quoi associer avec quoi ----
// Une recette peut en porter plusieurs (chili = viande + légumineuse + légumes). Sans indication : protéine + légumes + féculent.
// Un repas tient debout avec une source de protéines (viande/poisson/œufs OU légumineuse) et des légumes ; le féculent est facultatif.
// Les étiquettes viennent de la recette (types) et se changent dans sa fiche (gardé dans S.types).
const TYPES = { proteine: ["🍗", "Viande, poisson, œufs"], legumineuse: ["🫘", "Légumineuse"], legumes: ["🥦", "Légumes"], feculent: ["🍚", "Féculent"], dessert: ["🍰", "Dessert"] };
const DEFAUT = ["proteine", "legumes", "feculent"];
function typesOf(id) {
  const t = (S.types || {})[id] ?? (getR(id) || {}).types;
  const a = (Array.isArray(t) ? t : t ? [t] : DEFAUT).filter(x => TYPES[x]);
  return a.length ? a : DEFAUT;
}
const hasProt = id => typesOf(id).some(t => t === "proteine" || t === "legumineuse");
const tagHTML = id => typesOf(id).map(t => `<span class="tag t-${t}">${TYPES[t][0]} ${TYPES[t][1]}</span>`).join("");
// Ce qu'on peut servir avec une recette : ce qui lui manque, puis le facultatif. On ne propose jamais une recette
// qui apporte une étiquette déjà présente (pas de chili avec le poulet).
function pairsHTML(id) {
  const mine = typesOf(id); if (mine.includes("dessert")) return "";
  const free = x => x !== id && !typesOf(x).some(y => mine.includes(y)) && !typesOf(x).includes("dessert");
  const rows = [];
  if (!hasProt(id)) rows.push(["🍗 Protéine", allIds().filter(x => free(x) && hasProt(x) && !(mine.includes("legumes") && typesOf(x).includes("legumes")))]);
  if (!mine.includes("legumes")) rows.push(["🥦 Légumes", allIds().filter(x => free(x) && typesOf(x).includes("legumes"))]);
  if (!mine.includes("feculent")) rows.push(["🍚 Féculent (facultatif)", allIds().filter(x => free(x) && typesOf(x).includes("feculent"))]);
  // Un plat qui a déjà ses légumes mais pas de féculent : on peut aussi le compléter par d'autres légumes
  if (mine.includes("legumes") && !mine.includes("feculent")) rows.push(["🥦 Ou des légumes en plus", allIds().filter(x => x !== id && String(typesOf(x)) === "legumes")]);
  if (!rows.length) return "";
  return `<h2>À associer avec</h2>` + rows.map(([l, ids]) => `<div class="pairrow"><b class="pairlbl">${l}</b>${ids.map(x => `<button class="side" data-pair="${esc(x)}">${getR(x).emoji || ""} ${esc(getR(x).nom)}</button>`).join("") || `<small class="sub">aucune recette pour l'instant</small>`}</div>`).join("");
}
function sheetType(id) {
  const cur = new Set(typesOf(id));
  openSheet(`<h3>Étiquettes de la recette</h3><p class="sub">Coche tout ce que la recette apporte.</p>
    <div class="chips">${Object.entries(TYPES).map(([t, [e, n]]) => `<button data-settype="${t}" class="${cur.has(t) ? "cur" : ""}">${e} ${n}</button>`).join("")}</div>
    <button class="primary wide" id="typeok" style="margin-top:14px">OK</button>`, () => {
    $("#sheet").onclick = e => {
      const b = e.target.closest("[data-settype]");
      if (b) { cur.has(b.dataset.settype) ? cur.delete(b.dataset.settype) : cur.add(b.dataset.settype); b.classList.toggle("cur"); }
      if (e.target.id === "typeok") {
        if (!cur.size) return toast("Coche au moins une étiquette");
        S.types ||= {}; S.types[id] = Object.keys(TYPES).filter(t => cur.has(t)); save(); closeSheet(); openCook(id, true);
      }
    };
  });
}
// Portions prévues dans un plan (une entrée = une portion de sa recette). L'équilibre se juge sur la semaine :
// autant de portions de protéines et de légumes que de repas ; féculents et légumineuses sont comptés pour information.
function coverage(sem) {
  const n = f => sem.filter(d => getR(d.recette) && f(d.recette)).length, has = t => id => typesOf(id).includes(t);
  return { prot: n(hasProt), legumes: n(has("legumes")), feculent: n(has("feculent")), legumineuse: n(has("legumineuse")), viande: n(has("proteine")) };
}
const goalOf = () => S.goal || D.portions || 15;
function coverHTML(sem, goal) {
  const c = coverage(sem), need = (cls, lbl, v) => `<span class="tag ${cls} ${v < goal ? "low" : ""}">${lbl} ${v} / ${goal}${v < goal ? " ⚠" : " ✓"}</span>`;
  return `<div class="cover">${need("t-proteine", "🍗 Protéines", c.prot)}${need("t-legumes", "🥦 Légumes", c.legumes)}</div>
    <div class="cover"><span class="tag t-proteine">dont viande, poisson, œufs : ${c.viande}</span><span class="tag t-legumineuse">🫘 Légumineuses : ${c.legumineuse}</span><span class="tag t-feculent">🍚 Féculents : ${c.feculent} (facultatif)</span></div>`;
}
const keep = id => { S.lib[id] = JSON.parse(JSON.stringify(getR(id))); };
function toggleFav(id) {
  if (S.favs[id]) { delete S.favs[id]; toast("Retirée des favoris"); }
  else { S.favs[id] = true; keep(id); toast("❤️ Gardée pour plus tard"); }
  buzz(); save();
}

// Début de la semaine : dernière « Nouvelle semaine », sinon le dernier samedi à 0 h
function weekStart() {
  const s = S.weekStart ? new Date(S.weekStart) : null;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 1) % 7);
  return s && s > d ? s : d; // le plus récent : dernier samedi 0 h, ou dernière « Nouvelle semaine » (la semaine repart chaque samedi)
}
const cooksOf = id => S.cooks.filter(c => c.id === id);
const doneThisWeek = id => S.cooks.some(c => c.id === id && new Date(c.end) >= weekStart());
// kcal / protéines d'une portion : celles de la dernière fois cette semaine (quantités réelles), sinon la recette
function portionOf(id) {
  const r = getR(id) || {}, c = cooksOf(id).filter(c => new Date(c.end) >= weekStart()).pop();
  if (c && c.kcalP) return { kcal: c.kcalP, prot: c.protP };
  // Recette en cours avec des ingrédients retirés ou changés : on compte ce qui est vraiment dans l'assiette
  const s = S.sess[id];
  if (s && (Object.keys(s.mods).length || s.extra.length)) { const t = sessionTotals(id); return { kcal: t.kcalP, prot: t.protP }; }
  return { kcal: r.kcal || 0, prot: r.prot || 0 };
}
// Coût : d'une portion, aujourd'hui (prix au gramme actuels) et lors de chaque cuisine passée
function costPerPortion(id) {
  const t = priceOf(curIngs(id)), n = (S.sess[id] || {}).n || (getR(id) || {}).n || 1;
  return { now: t.total ? t.total / n : null, partial: t.partial };
}
function costChart(id) {
  const pts = cooksOf(id).filter(c => c.prix).map(c => ({ d: c.end, v: c.prix / (c.portions || c.n || 1) }));
  if (pts.length < 1) return `<p class="sub">Le coût apparaîtra ici après la première cuisson avec des prix de ticket.</p>`;
  const W = 300, H = 90, mx = Math.max(...pts.map(p => p.v)) * 1.15 || 1;
  const xy = pts.map((p, i) => [pts.length > 1 ? 10 + i * (W - 20) / (pts.length - 1) : W / 2, H - 14 - p.v / mx * (H - 28)]);
  return `<svg viewBox="0 0 ${W} ${H}" class="costsvg"><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="${xy.map(p => p.join(",")).join(" ")}"/>
    ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--accent)"/><text x="${p[0]}" y="${p[1] - 8}" text-anchor="middle">${euro(pts[i].v)}</text>
    <text x="${p[0]}" y="${H - 1}" text-anchor="middle" class="ax">${fmtDate(pts[i].d)}</text>`).join("")}</svg>`;
}
function stats(id) {
  const cs = cooksOf(id), last = cs[cs.length - 1];
  const durs = cs.map(c => c.min).filter(Boolean), prix = cs.map(c => c.prix).filter(Boolean);
  return {
    n: cs.length, last: last && last.end,
    min: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null,
    prix: prix.length ? prix[prix.length - 1] : (p => p.partial ? null : p.total || null)(priceOf(curIngs(id, true))),
    stars: (S.notes[id] || {}).stars || 0
  };
}

// ---- Session en cours : nombre de portions choisi, quantités modifiées, ingrédients retirés ou ajoutés ----
// Une recette est écrite pour r.n portions. Dans la fiche, on peut en demander plus ou moins (s.n) : toutes les quantités suivent.
const sess = id => (S.sess[id] ||= { mods: {}, extra: [] });
function curIngs(id, base) {
  const r = getR(id); if (!r) return [];
  const s = base ? { mods: {}, extra: [] } : sess(id), f = s.n ? s.n / (r.n || 1) : 1;
  return [...r.ingredients.map(normIng), ...s.extra.map(normIng)].map((g, i) => {
    const m = s.mods[i] || {}, added = i >= r.ingredients.length;
    const q0 = g.q == null || added ? g.q : Math.round(g.q * f * 100) / 100; // quantité de la recette, mise à l'échelle des portions
    return { ...g, i, q0, q: m.q ?? q0, off: !!m.off, added };
  });
}
function priceOf(list) {
  let total = 0, miss = 0;
  for (const g of list) {
    if (g.off || g.free || !g.k) continue;
    const p = S.prix[g.k];
    if (p != null) total += p * gramsOf(g); else if ((AL[g.k] || {}).k) miss++;
  }
  return { total, partial: miss > 0 };
}
// Valeurs d'une portion pour la session : on garde les kcal de la recette et on applique l'écart des quantités
function sessionTotals(id) {
  const r = getR(id), n0 = r.n || 1, n = sess(id).n || n0, f = n / n0;
  const sum = l => l.filter(g => !g.off).reduce((a, g) => { const x = nutOf(g); return { k: a.k + x.k, p: a.p + x.p }; }, { k: 0, p: 0 });
  const b = sum(curIngs(id, true)), c = sum(curIngs(id));
  const fk = b.k ? c.k / f / b.k : 1, fp = b.p ? c.p / f / b.p : 1; // écart par portion, hors effet du nombre de portions
  const kcalP = r.kcal ? r.kcal * fk : c.k / n, protP = r.prot ? r.prot * fp : c.p / n;
  const pr = priceOf(curIngs(id));
  return { kcalP: Math.round(kcalP), protP: Math.round(protP), prix: pr.total, partial: pr.partial, n };
}

// ---- Onglet Recettes ----
const R = { q: "", f: "toutes", sort: "recent", t: "" }; // t : étiquette filtrée dans la bibliothèque
// Recettes qui viennent d'arriver (envoyées par l'assistant, ou semaine proposée lancée) : elles glissent vers la droite
// la première fois qu'on les voit, l'une après l'autre. Valeur = rang d'arrivée.
const FRESH = new Map();
const markFresh = id => { if (!FRESH.has(id)) FRESH.set(id, FRESH.size); };
function freshAttr(id) {
  if (!FRESH.has(id)) return "";
  const d = FRESH.get(id) * 90;
  setTimeout(() => FRESH.delete(id), 600 + d); // une seule fois : les affichages suivants ne rejouent pas l'animation
  return ` arrive" style="animation-delay:${d}ms`;
}
function recipeCard(id, extra = "") {
  const r = getR(id), st = stats(id);
  // Portions : celles prévues au plan de la semaine si la recette y est, sinon celles pour lesquelles elle est écrite
  const plan = D.semaine.filter(d => d.recette === id).length, n = r.n || 1, pl = x => x + " portion" + (x > 1 ? "s" : "");
  const por = plan ? `<span class="por">${pl(plan)} prévue${plan > 1 ? "s" : ""}</span>${plan !== n ? ` (recette pour ${n})` : ""}` : `pour ${pl(n)}`;
  const bits = [por, r.temps, st.n ? `fait ${st.n}×` : "", st.min ? `⏱ ${durTxt(st.min)}` : "", st.prix ? `≈ ${euro(st.prix)}` : "", st.stars ? `<span class="stars">${stars(st.stars)}</span>` : ""].filter(Boolean);
  return `<div class="card${freshAttr(id)}" data-r="${esc(id)}"><span class="emo">${r.emoji || "🍽️"}</span>
    <span class="grow"><b>${esc(r.nom)}</b><span class="sub">${tagHTML(id)}${PUB[id] ? "🌍 " : ""}${extra || bits.join(" · ")}</span></span>
    <button class="fav ${isFav(id) ? "on" : ""}" data-fav="${esc(id)}" aria-label="Favori">${isFav(id) ? "❤️" : "♡"}</button></div>`;
}
// ---- « Avec ce que tu as » : recettes faisables avec le placard et les articles ajoutés à la main à la liste (ex. de la feta) ----
const normTxt = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Un nom libre (« Feta AOP », « poivrons rouges ») → l'aliment connu dont le nom y figure en entier
function keyOfName(nom) {
  const n = ` ${normTxt(nom)} `; let best = null, len = 0;
  for (const [k, a] of Object.entries(AL)) for (const x of [a.n, a.np]) {
    const y = normTxt(x); if (y.length >= 3 && y.length > len && n.includes(` ${y} `)) { best = k; len = y.length; }
  }
  return best;
}
function canMake(limit = 5) {
  const have = {}, extra = {};
  for (const p of S.pantry) { const k = p.k || keyOfName(p.nom); if (k && (p.u === "x" || p.q > 0)) have[k] = 1; }
  for (const x of S.extras) { const k = keyOfName(x.nom); if (k) extra[k] = x.nom; }
  const week = new Set(weekIds()), out = [];
  for (const id of allIds()) {
    if (week.has(id)) continue; // déjà prévue cette semaine
    // Les ingrédients qui comptent : pas les épices ni les petites quantités (huile, sel…)
    const main = curIngs(id, true).filter(g => !g.free && g.k && gramsOf(g) >= 30 && rayOf(g.k) !== "Épices");
    if (main.length < 2) continue;
    const got = main.filter(g => have[g.k] || extra[g.k]), miss = main.filter(g => !have[g.k] && !extra[g.k]);
    const withExtra = got.some(g => extra[g.k]), part = got.length / main.length;
    if (part >= .5 || withExtra) out.push({ id, got: got.map(g => g.k), miss: miss.map(g => g.k), score: part + (withExtra ? .6 : 0) });
  }
  return out.sort((a, b) => b.score - a.score || a.miss.length - b.miss.length).slice(0, limit);
}
function canMakeHTML() {
  const list = canMake(), lost = S.extras.filter(x => !keyOfName(x.nom) && !S.checked[x.id]).length; // ajouts que l'appli ne sait pas cuisiner
  const nm = k => (AL[k] || {}).n || k;
  if (!list.length && !(S.sync && S.extras.length)) return "";
  return `<h2>🧺 Avec ce que tu as</h2>` + list.map(x => recipeCard(x.id, `✓ ${x.got.map(nm).join(", ")}${x.miss.length ? ` · il manque ${x.miss.map(nm).join(", ")}` : " · tout y est"}`)).join("")
    + (S.sync ? `<p class="sub">${!list.length ? "Aucune recette avec ce que tu as. " : lost ? "Pas de recette pour tous tes ajouts. " : ""}Demande à ton assistant : « une recette avec ce que j'ai ».</p>` : "");
}
function renderRecettes() {
  const week = weekIds(), todo = week.filter(id => !doneThisWeek(id)), done = week.filter(doneThisWeek);
  setHeader(!week.length ? "Aucune semaine en cours" : todo.length ? `${todo.length} recette${todo.length > 1 ? "s" : ""} à faire cette semaine` : "Tout est cuisiné cette semaine 🎉", week.length ? done.length / week.length : null);
  let h = `<h2>Portions de la semaine</h2>${coverHTML(D.semaine, goalOf())}<h2>À faire cette semaine</h2>` + (todo.map(id => recipeCard(id)).join("") || (week.length ? `<p class="empty">🎉 Semaine bouclée !</p>` : `<p class="empty">Choisis les plats de ta semaine : la liste de courses se fait toute seule.</p><button class="primary wide" id="startweek">🗓️ Préparer ma semaine</button>`));
  if (done.length) h += `<h2>Déjà faites cette semaine</h2>` + done.map(id => {
    const c = cooksOf(id).pop();
    return `<div class="card done" data-r="${esc(id)}"><span class="emo">${getR(id).emoji}</span><span class="grow"><b>${esc(getR(id).nom)}</b>
      <span class="sub">✓ ${fmtDate(c.end)} ${fmtTime(c.end)} · ⏱ ${durTxt(c.min)}${c.stars ? ` · <span class="stars">${stars(c.stars)}</span>` : ""}</span></span></div>`;
  }).join("");
  h += canMakeHTML();
  h += `<button class="wide" id="newrec" style="margin-top:14px">＋ Ajouter une recette (la tienne, celle d'un proche…)</button>
    <button class="more" id="more"><span>Plus de recettes</span><i>⌄</i></button>
    <section id="lib" class="lib">
      <form class="search" id="rform" onsubmit="return false"><input id="rq" type="search" placeholder="Chercher une recette ou un ingrédient…" value="${esc(R.q)}" autocomplete="off"></form>
      <div class="chips" id="rf">${[["toutes", "Toutes"], ["favs", "❤️ Favoris"], ["pub", "🌍 Communauté"], ["miennes", "✍️ Les miennes"], ["faites", "🕓 Déjà faites"], ["notees", "⭐ Notées"]]
        .map(([k, l]) => `<button data-f="${k}" class="${R.f === k ? "cur" : ""}">${l}</button>`).join("")}</div>
      <div class="chips" id="rt">${Object.entries(TYPES).map(([t, [e, n]]) => `<button data-t="${t}" class="${R.t === t ? "cur" : ""}">${e} ${n}</button>`).join("")}</div>
      <label class="sortrow">Trier par <select id="rs">${[["recent", "Faites récemment"], ["souvent", "Faites le plus souvent"], ["rapide", "Les plus rapides"], ["prix", "Les moins chères"], ["note", "Les mieux notées"], ["nom", "Nom"]]
        .map(([k, l]) => `<option value="${k}" ${R.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <div id="libl"></div>
    </section>`;
  $("#view").innerHTML = h;
  drawLib();

  // La bibliothèque glisse en place quand on fait défiler jusqu'à elle
  const lib = $("#lib");
  if ("IntersectionObserver" in window) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { lib.classList.add("in"); o.disconnect(); } }, { threshold: .05 }).observe(lib);
  else lib.classList.add("in");
  $("#more").onclick = () => { lib.classList.add("in"); lib.scrollIntoView({ behavior: "smooth" }); };
  $("#rq").oninput = e => { R.q = e.target.value; drawLib(); };
  $("#rs").onchange = e => { R.sort = e.target.value; drawLib(); };
  $("#view").onclick = e => {
    if (e.target.closest("#newrec")) return openRecipeForm();
    if (e.target.closest("#startweek")) return openPlanner();
    const ty = e.target.closest("[data-t]");
    if (ty) { R.t = R.t === ty.dataset.t ? "" : ty.dataset.t; document.querySelectorAll("#rt button").forEach(b => b.classList.toggle("cur", b.dataset.t === R.t)); return drawLib(); }
    const f = e.target.closest("[data-f]");
    if (f) { R.f = f.dataset.f; document.querySelectorAll("#rf button").forEach(b => b.classList.toggle("cur", b === f)); return drawLib(); }
    const fv = e.target.closest("[data-fav]");
    if (fv) { toggleFav(fv.dataset.fav); const y = scrollY; render(); return scrollTo(0, y); }
    const c = e.target.closest("[data-r]"); if (c) openCook(c.dataset.r);
  };
}
function drawLib() {
  const q = R.q.trim().toLowerCase();
  const match = id => { const r = getR(id); return !q || (r.nom + " " + r.ingredients.map(x => ingLabel(normIng(x))).join(" ")).toLowerCase().includes(q); };
  let h;
  if (R.f === "faites") {
    // Chaque fois où une recette a été cuisinée, de la plus récente à la plus ancienne (ou selon le tri)
    let cs = S.cooks.map((c, j) => ({ ...c, j })).filter(c => getR(c.id) && match(c.id));
    const by = { recent: (a, b) => b.end.localeCompare(a.end), rapide: (a, b) => (a.min || 1e9) - (b.min || 1e9), prix: (a, b) => (a.prix || 1e9) - (b.prix || 1e9),
      note: (a, b) => (b.stars || 0) - (a.stars || 0), nom: (a, b) => a.nom.localeCompare(b.nom), souvent: (a, b) => cooksOf(b.id).length - cooksOf(a.id).length };
    cs.sort(by[R.sort] || by.recent);
    h = cs.map(c => recipeCard(c.id, `${fmtDate(c.end)} · ${fmtTime(c.start)} → ${fmtTime(c.end)} · ⏱ ${durTxt(c.min)}${c.prix ? ` · ≈ ${euro(c.prix)}` : ""}${c.stars ? ` · <span class="stars">${stars(c.stars)}</span>` : ""}`)).join("")
      || `<p class="empty">Pas encore de recette terminée.<br>Valide toutes les étapes d'une recette : elle arrive ici avec son temps.</p>`;
  } else {
    let ids = allIds().filter(match);
    if (R.t) ids = ids.filter(id => typesOf(id).includes(R.t));
    if (R.f === "favs") ids = ids.filter(isFav);
    if (R.f === "pub") ids = ids.filter(id => PUB[id]);
    if (R.f === "miennes") ids = ids.filter(isMine);
    if (R.f === "notees") ids = ids.filter(id => (S.notes[id] || {}).stars);
    const st = Object.fromEntries(ids.map(id => [id, stats(id)]));
    const by = { recent: (a, b) => (st[b].last || "").localeCompare(st[a].last || ""), souvent: (a, b) => st[b].n - st[a].n,
      rapide: (a, b) => (st[a].min || 1e9) - (st[b].min || 1e9), prix: (a, b) => (st[a].prix || 1e9) - (st[b].prix || 1e9),
      note: (a, b) => st[b].stars - st[a].stars, nom: (a, b) => getR(a).nom.localeCompare(getR(b).nom) };
    ids.sort(by[R.sort]);
    h = ids.map(id => recipeCard(id)).join("") || `<p class="empty">${R.f === "favs" ? "Aucun favori : touche ♡ sur une recette qui t'a plu." : R.f === "notees" ? "Aucune recette notée pour l'instant." : R.f === "pub" ? "Pas encore de recette partagée (ou pas de réseau). Partage la tienne !" : R.f === "miennes" ? "Tu n'as pas encore écrit de recette : « ＋ Ajouter une recette », plus haut." : "Rien trouvé."}</p>`;
  }
  $("#libl").innerHTML = h;
}

// ---- Mode cuisine ----
let wake = null, timers = {};
async function keepAwake() {
  if (NATIVE) return NATIVE.keepAwake(true);
  try { wake = await navigator.wakeLock.request("screen"); } catch { wake = null; }
}
document.addEventListener("visibilitychange", () => { if ($("#cook").classList.contains("open") && document.visibilityState === "visible") keepAwake(); });

function openCook(id, keepStart) {
  const r = getR(id);
  S.ings[id] ||= {}; S.steps[id] ||= {};
  const s = sess(id);
  const steps = r.etapes.map(x => typeof x === "string" ? { t: x } : x);
  const cur = steps.findIndex((_, i) => !S.steps[id][i]);
  // Heure de début = dernière ouverture avant la première étape cochée
  if (!keepStart && !Object.values(S.steps[id]).some(Boolean)) { s.start = new Date().toISOString(); save(); }
  const t = sessionTotals(id), list = curIngs(id), past = cooksOf(id).slice().reverse();
  const note = S.notes[id];

  $("#cook").innerHTML = `
    <header><button id="close" aria-label="Fermer">←</button><h1>${r.emoji} ${esc(r.nom)}</h1><button class="fav" id="favc" aria-label="Favori">${isFav(id) ? "❤️" : "♡"}</button></header>
    <main>
      <div class="sub"><button class="tagbtn" id="ctype">${tagHTML(id)}✎</button><span class="portst"><button data-por="-1" aria-label="Une portion de moins">−</button><b>${num(t.n)} portion${t.n > 1 ? "s" : ""}</b><button data-por="1" aria-label="Une portion de plus">+</button></span> · ${esc(r.temps)}${r.lien ? ` · <a href="${esc(r.lien)}" target="_blank" rel="noopener">recette d'origine</a>` : ""}</div>
      <div class="sumbox">
        <div><b>${t.kcalP}</b><small>kcal / portion</small></div>
        <div><b>${t.protP} g</b><small>protéines</small></div>
        <div><b>${t.prix ? euro(t.prix) : "—"}</b><small>${t.prix ? (t.partial ? "prix partiel" : "la recette") : "prix : scanne un ticket"}</small></div>
      </div>
      <div class="costbox"><b>${costPerPortion(id).now ? euro(costPerPortion(id).now) : "—"}</b> <small>coût d'une portion aujourd'hui${costPerPortion(id).partial ? " (prix partiel)" : ""}</small>${costChart(id)}</div>
      <div class="wake">⏱ Commencée à ${fmtTime(s.start)} · ${NATIVE || "wakeLock" in navigator ? "🔆 l'écran reste allumé" : ""}${note ? ` · <span class="stars">${stars(note.stars)}</span>` : ""}</div>
      ${pairsHTML(id)}
      <h2>Ingrédients · touche ✎ pour changer une quantité</h2>
      <div class="list">${list.map(g => `<div class="row ing ${S.ings[id][g.i] ? "on" : ""} ${g.off ? "off" : ""}" data-ing="${g.i}">
          <span class="box"></span><span class="txt">${esc(ingLabel(g))}${g.off ? " <small>retiré</small>" : g.q !== g.q0 && !g.added ? ` <small>au lieu de ${num(g.q0)}</small>` : g.added ? " <small>ajouté</small>" : ""}</span>
          ${g.free ? "" : `<button class="edit" data-edit="${g.i}" aria-label="Modifier">✎</button>`}</div>`).join("")}
        <div class="row addrow" id="adding"><span class="box plusbox">+</span><span class="txt">Ajouter un ingrédient</span></div></div>
      <h2>Étapes · touche quand c'est fait</h2>
      ${t.n !== (r.n || 1) ? `<p class="sub">Ingrédients recalculés pour ${num(t.n)} portion${t.n > 1 ? "s" : ""}. Les quantités écrites dans les étapes restent celles de la recette de base (${r.n || 1}).</p>` : ""}
      ${steps.map((x, i) => `<div class="step ${S.steps[id][i] ? "on" : ""} ${i === cur ? "cur" : ""}" data-st="${i}">
        <span class="n">${S.steps[id][i] ? "✓" : i + 1}</span>
        <span>${esc(x.t)}${x.min ? `<div class="timer"><button data-timer="${i}" data-min="${x.min}">⏱ ${timers[id + i] ? "…" : x.min + " min"}</button></div>` : ""}</span></div>`).join("")}
      <button class="primary wide" id="finish" style="margin-top:8px">✓ Recette faite</button>
      <p class="sub">Enregistre la cuisson maintenant, avec son temps. (Elle s'enregistre aussi quand toutes les étapes sont cochées.)</p>
      <button id="restart" style="margin-top:8px">Recommencer la recette</button>
      ${pubBtnHTML(id)}
      ${pubBtnHTML(id)}
      ${past.length ? `<h2>Les fois précédentes</h2><div class="list">${past.map(c => `<div class="row hist"><span class="txt">${fmtDate(c.end)} · ${fmtTime(c.start)} → ${fmtTime(c.end)}
        <small>⏱ ${durTxt(c.min)}${c.prix ? ` · ≈ ${euro(c.prix)}` : ""} · ${c.kcalP} kcal/portion${c.stars ? ` · ${stars(c.stars)}` : ""}${c.txt ? ` · « ${esc(c.txt)} »` : ""}</small>${c.nPhotos ? `<div class="cph" data-cph="${esc(c.end)}"></div>` : ""}</span></div>`).join("")}</div>` : ""}
    </main>`;
  $("#cook").classList.add("open"); fillCookPhotos($("#cook"));
  keepAwake();

  $("#cook").onclick = e => {
    if (e.target.closest("#close")) return closeCook();
    if (e.target.closest("#cpub")) return togglePublish(id);
    if (e.target.closest("#cpub")) return togglePublish(id);
    if (e.target.closest("#favc")) { toggleFav(id); return openCook(id, true); }
    const im = e.target.closest(".cph img");
    if (im) return im.classList.toggle("zoom");
    const por = e.target.closest("[data-por]");
    if (por) { s.n = Math.max(1, (s.n || r.n || 1) + +por.dataset.por); save(); return openCook(id, true); }
    if (e.target.closest("#ctype")) return sheetType(id);
    const pr = e.target.closest("[data-pair]");
    if (pr) return openCook(pr.dataset.pair);
    if (e.target.closest("#finish")) return finishCook(id);
    if (e.target.closest("#restart")) { S.ings[id] = {}; S.steps[id] = {}; delete S.sess[id]; save(); return openCook(id); }
    if (e.target.closest("#adding")) return sheetAddIng(id);
    const ed = e.target.closest("[data-edit]");
    if (ed) return sheetIng(id, +ed.dataset.edit);
    const tb = e.target.closest("[data-timer]");
    if (tb) return startTimer(id, +tb.dataset.timer, +tb.dataset.min, tb);
    const ing = e.target.closest("[data-ing]");
    if (ing) { S.ings[id][ing.dataset.ing] = !S.ings[id][ing.dataset.ing]; buzz(); save(); return openCook(id, true); }
    const st = e.target.closest("[data-st]");
    if (st) {
      S.steps[id][st.dataset.st] = !S.steps[id][st.dataset.st]; buzz(); save();
      if (steps.every((_, i) => S.steps[id][i])) return finishCook(id);
      openCook(id, true);
    }
  };
}

// Fiche d'un ingrédient : quantité (pièces avec poids moyen, ou grammes), % de ce qu'on a, retirer
function sheetIng(id, i) {
  const s = sess(id), g = curIngs(id)[i], a = AL[g.k] || {};
  const stock = typeof stockOf === "function" ? stockOf(g.k) : 0; // placard.js
  const unit = g.u === "pc" ? (a.pc ? `pièce${g.q > 1 ? "s" : ""}` : "pc") : g.u === "g" ? "g" : g.u === "cc" ? "c. à c." : "c. à s.";
  const stepQ = g.u === "g" ? (g.q0 >= 200 ? 25 : 10) : 0.5;
  const toQ = w => g.u === "g" ? Math.round(w) : Math.round(w / (g.u === "pc" ? a.pc || 1 : UNIT_G[g.u]) * 2) / 2;
  const base = stock || gramsOf({ ...g, q: g.q0 }); // le curseur part de ton stock, sinon de la quantité prévue
  openSheet(`<h3>${a.e || "🥄"} ${esc(nameOf(g))}</h3>
    <p class="sub">Prévu : ${esc(ingLabel({ ...g, q: g.q0 }))}${a.pc && g.u === "pc" ? ` · poids moyen : ${a.pc} g la pièce` : ""}</p>
    <div class="stepper"><button data-d="-1">−</button><input id="iq" type="number" inputmode="decimal" value="${g.q}" step="${stepQ}" min="0"><span>${unit}</span><button data-d="1">+</button></div>
    <p class="calc" id="ieq"></p>
    <h4>${stock ? `Ou : combien de ce que tu as ? <small>(${Math.round(stock)} g au placard)</small>` : "Ou : en % de la quantité prévue"}</h4>
    <div class="slide-row"><input type="range" id="ipct" min="0" max="${stock ? 100 : 200}" step="5" value="${Math.round(gramsOf(g) / (base || 1) * 100)}"><span class="pct" id="ipl"></span></div>
    <div class="two"><button id="ioff">${g.off ? "Remettre dans la recette" : g.added ? "Supprimer" : "Je n'en ai pas mis"}</button><button class="primary" id="iok">OK</button></div>`, () => {
    const show = () => {
      const q = +$("#iq").value || 0, w = gramsOf({ ...g, q }), n = nutOf({ ...g, q });
      $("#ieq").innerHTML = `≈ <b>${Math.round(w)} g</b> · ${Math.round(n.k)} kcal · ${Math.round(n.p)} g prot.${S.prix[g.k] ? ` · ${euro(S.prix[g.k] * w)}` : ""}`;
      const p = Math.round(w / (base || 1) * 100); $("#ipct").value = p; $("#ipct").style.setProperty("--v", p / $("#ipct").max * 100 + "%"); $("#ipl").textContent = p + " %";
    };
    show();
    $("#iq").oninput = show;
    $("#ipct").oninput = e => { $("#iq").value = toQ(base * e.target.value / 100); show(); $("#ipl").textContent = e.target.value + " %"; };
    $("#sheet").onclick = e => {
      const d = e.target.closest("[data-d]");
      if (d) { $("#iq").value = Math.max(0, (+$("#iq").value || 0) + d.dataset.d * stepQ); show(); }
      if (e.target.id === "ioff") {
        if (g.added && !g.off) { s.extra.splice(i - getR(id).ingredients.length, 1); delete s.mods[i]; }
        else s.mods[i] = { ...(s.mods[i] || {}), off: !g.off };
        save(); closeSheet(); openCook(id, true);
      }
      if (e.target.id === "iok") { s.mods[i] = { ...(s.mods[i] || {}), q: +$("#iq").value || 0, off: false }; buzz(); save(); closeSheet(); openCook(id, true); }
    };
  });
}
function sheetAddIng(id, pre = "") {
  openSheet(`<h3>Ajouter un ingrédient</h3>
    <form id="aform" class="qform"><input id="an" list="alist" value="${esc(pre)}" placeholder="Quoi ? (ex. carotte, huile d'olive)" required autocomplete="off">
      <datalist id="alist">${Object.values(AL).map(a => `<option value="${esc(a.n)}">`).join("")}</datalist>
      <div class="two"><input id="aq" type="number" inputmode="decimal" placeholder="Quantité" required step="any"><select id="au"><option value="g">g</option><option value="pc">pièce(s)</option></select></div>
      <p class="sub" id="ahint">Pour les légumes, compte en pièces : on utilise un poids moyen.</p>
      <button type="button" class="link" id="anew">+ Pas dans la liste ? Crée l'aliment</button>
      <button class="primary wide">Ajouter</button></form>`, () => {
    const keyOf = n => Object.keys(AL).find(k => AL[k].n.toLowerCase() === n.trim().toLowerCase() || (AL[k].np || "").toLowerCase() === n.trim().toLowerCase());
    $("#an").focus();
    $("#anew").onclick = () => openNewAliment($("#an").value, k => sheetAddIng(id, AL[k].n));
    $("#an").oninput = () => { const k = keyOf($("#an").value); if (k && AL[k].pc >= 20) { $("#au").value = "pc"; $("#ahint").textContent = `Poids moyen : ${AL[k].pc} g la pièce.`; } };
    $("#aform").onsubmit = e => {
      e.preventDefault();
      const k = keyOf($("#an").value), u = $("#au").value;
      sess(id).extra.push(k ? { q: +$("#aq").value, u, k } : { q: +$("#aq").value, u, t: $("#an").value.trim() });
      save(); closeSheet(); openCook(id, true);
    };
  });
}

// Toutes les étapes cochées : on enregistre la session (horaires, quantités, prix), on vide le placard, on note
function finishCook(id) {
  const r = getR(id), s = sess(id), t = sessionTotals(id), end = new Date();
  const start = new Date(s.start || end), min = Math.max(1, Math.round((end - start) / 60000));
  const list = curIngs(id).filter(g => !g.off);
  const c = { id, nom: r.nom, emoji: r.emoji, start: start.toISOString(), end: end.toISOString(), min, n: t.n,
    kcalP: t.kcalP, protP: t.protP, prix: t.prix ? Math.round(t.prix * 100) / 100 : null, ings: list.map(ingLabel) };
  S.cooks.push(c); keep(id);
  const pre = Math.min(1, ((S.pre || {})[id] || 0) / (r.n || 1)); // part déjà retirée du placard en validant des repas dans la Semaine
  if (S.pre) delete S.pre[id];
  const used = typeof useStock === "function" ? list.flatMap(g => g.k ? useStock(g.k, gramsOf(g) * (1 - pre)) : []) : [];
  S.steps[id] = {}; S.ings[id] = {}; delete S.sess[id];
  save(); buzz(80);
  $("#cook").classList.remove("open"); if (NATIVE) NATIVE.keepAwake(false);
  sheetNote(id, c, used);
}

// Noter un plat (depuis la fin de recette ou l'onglet Semaine) ; à la fin d'une recette : portions de côté
const TAGS = ["À refaire", "Trop salé", "Fade", "Trop long", "Copieux", "Pas assez"];
function sheetNote(id, cook, used) {
  const r = getR(id), old = (cook && cook.stars ? cook : S.notes[id]) || {};
  let st = old.stars || 0; const tags = new Set(old.tags || []);
  const left = cook ? Math.max(0, (cook.n || 1) - 1) : 0;
  openSheet(`${cook ? `<div class="bravo">🎉</div><h3>${esc(r.nom)} : fait en ${durTxt(cook.min)}</h3>
      <p class="sub">${fmtTime(cook.start)} → ${fmtTime(cook.end)} · ${cook.kcalP} kcal et ${cook.protP} g de protéines par portion${cook.prix ? ` · ≈ ${euro(cook.prix)}` : ""}</p>`
    : `<h3>Noter : ${r.emoji} ${esc(r.nom)}</h3>`}
    <div class="starpick">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}">${n <= st ? "★" : "☆"}</button>`).join("")}</div>
    <div class="chips tagpick">${TAGS.map(x => `<button data-tag="${esc(x)}" class="${tags.has(x) ? "cur" : ""}">${x}</button>`).join("")}</div>
    <textarea id="ntxt" rows="2" placeholder="Un mot pour la prochaine fois ? (ex. moins de piment)">${esc(old.txt || "")}</textarea>
    ${cook ? `<div class="tphotos" id="cphotos"></div><button type="button" class="wide" id="cadd">📸 Ajouter une photo du plat</button><div id="ccam"></div>` : ""}
    ${cook ? `<h4>Combien de portions au total ? <small>(le coût se divise par ce nombre)</small></h4>
      <div class="stepper small"><input id="npf" type="number" inputmode="numeric" value="${cook.portions || cook.n || 1}" min="1"><span>portions</span></div>` : ""}
    ${cook && cook.n > 1 ? `<h4>Portions mises de côté</h4>
      <div class="stepper small"><button data-p="-1">−</button><input id="np" type="number" value="${left}" min="0"><span>portion(s)</span><button data-p="1">+</button></div>
      <div class="chips" id="nloc"><button data-loc="frigo" class="cur">🧊 Frigo</button><button data-loc="congel">❄️ Congélateur</button></div>` : ""}
    ${used && used.length ? `<p class="sub">Retiré du placard : ${used.map(esc).join(", ")}</p>` : ""}
    <button class="primary wide" id="nok">Enregistrer</button>`, () => {
    let loc = "frigo"; const cphotos = [];
    $("#sheet").onclick = e => {
      if (e.target.closest("#cadd")) return camInto($("#ccam"), src => { cphotos.push(src); $("#cphotos").innerHTML = cphotos.map(x => `<img class="tph" src="${x}" alt="">`).join(""); });
      const b = e.target.closest("[data-star]");
      if (b) { st = +b.dataset.star; document.querySelectorAll("[data-star]").forEach(x => x.textContent = +x.dataset.star <= st ? "★" : "☆"); buzz(); }
      const tg = e.target.closest("[data-tag]");
      if (tg) { tags.has(tg.dataset.tag) ? tags.delete(tg.dataset.tag) : tags.add(tg.dataset.tag); tg.classList.toggle("cur"); }
      const p = e.target.closest("[data-p]");
      if (p) $("#np").value = Math.max(0, +$("#np").value + +p.dataset.p);
      const l = e.target.closest("[data-loc]");
      if (l) { loc = l.dataset.loc; document.querySelectorAll("#nloc button").forEach(x => x.classList.toggle("cur", x === l)); }
      if (e.target.id === "nok") {
        const n = { stars: st, tags: [...tags], txt: $("#ntxt").value.trim(), at: new Date().toISOString() };
        if (st || n.txt || n.tags.length) { S.notes[id] = n; keep(id); }
        if (cook) {
          const pf = +$("#npf").value || cook.n || 1;
          stopScan();
          if (cphotos.length) { cook.nPhotos = cphotos.length; tkSavePhotos(cookKey(cook), cphotos).catch(() => toast("Photo non enregistrée")); }
          Object.assign(cook, st ? { stars: st } : {}, n.txt ? { txt: n.txt } : {}, { portions: pf, prixP: cook.prix ? Math.round(cook.prix / pf * 100) / 100 : null });
        }
        const np = $("#np") ? +$("#np").value : 0;
        if (np > 0 && typeof addPlat === "function") addPlat({ nom: r.nom, emoji: r.emoji, n: np, kcalP: cook.kcalP, protP: cook.protP, loc, rid: id });
        save(); closeSheet(); render();
        toast(cook ? (np ? `Enregistré · ${np} portion${np > 1 ? "s" : ""} au ${loc === "frigo" ? "frigo" : "congélo"}` : "Recette enregistrée") : "Note enregistrée");
      }
    };
  });
}

function startTimer(id, i, min, btn) {
  const k = id + i;
  if (timers[k]) { clearInterval(timers[k].h); delete timers[k]; btn.textContent = `⏱ ${min} min`; return; }
  const end = Date.now() + min * 60000;
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const el = document.querySelector(`[data-timer="${i}"]`);
    if (el) el.textContent = left ? `⏱ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")} (stop)` : "⏰ C'est prêt !";
    if (!left) { clearInterval(timers[k].h); delete timers[k]; buzz(1200); beep(); toast("⏰ Minuteur terminé"); }
  };
  timers[k] = { h: setInterval(tick, 1000) }; tick();
}
function beep() {
  try {
    const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(.3, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + 1.2);
    o.start(); o.stop(a.currentTime + 1.2);
  } catch {}
}
function closeCook() {
  $("#cook").classList.remove("open");
  if (NATIVE) NATIVE.keepAwake(false);
  if (wake) { wake.release().catch(() => {}); wake = null; }
  render();
}
