// ---- Journal (inspiré de l'interface d'OpenNutriTracker, code réécrit) ----
// Chargé avant app.js : les fonctions ci-dessous utilisent S, D, $, esc, save… au moment de l'appel.

const MEALS = [
  ["petitdej", "Petit-déj", "☀️"],
  ["dejeuner", "Déjeuner", "🥗"],
  ["collation", "Collation", "🍎"],
  ["diner", "Dîner", "🍽️"]
];
const MEAL_HOUR = { petitdej: 8, dejeuner: 12, collation: 16, diner: 20 };
const mealNow = () => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? "petitdej" : h < 15 ? "dejeuner" : h < 18 ? "collation" : "diner"; };
const J = { day: null, view: "day", month: null }; // jour affiché dans le journal ; vue « jour » ou « calendrier »

// Tout ce qui a été mangé un jour donné : aliments saisis + plats validés dans l'onglet Semaine
function dayEntries(key) {
  S.food ||= []; S.log ||= [];
  const plats = S.log.filter(e => dateKey(new Date(e.at)) === key).map(e => {
    const id = e.rid || D.semaine[e.i].recette, r = getR(id), pp = portionOf(id), f = (e.to - e.from) / 100;
    return { nom: `${r.emoji} ${r.nom}`, detail: e.rid ? `${e.to} % d'une portion${e.ck ? "" : " · sans cuisson"}` : `${D.semaine[e.i].jour} · ${e.from} → ${e.to} %`, kcal: pp.kcal * f, prot: pp.prot * f, meal: "diner", at: e.at, plat: true };
  });
  const foods = S.food.filter(f => dateKey(new Date(f.at)) === key).map(f => ({ ...f, meal: f.meal || "collation" }));
  return [...plats, ...foods].sort((a, b) => a.at.localeCompare(b.at));
}
// Tous les plats validés (toutes dates), pour les figer avant une nouvelle semaine
function dayEntriesAll() {
  const keys = new Set((S.log || []).map(e => dateKey(new Date(e.at))));
  return [...keys].flatMap(k => dayEntries(k).filter(e => e.plat));
}
function dayTotals(key) {
  return dayEntries(key).reduce((a, e) => ({ k: a.k + e.kcal, p: a.p + e.prot }), { k: 0, p: 0 });
}

function renderJournal() {
  if (J.view === "cal") return renderCalendar();
  const todayKey = dateKey(new Date());
  J.day ||= todayKey;
  const entries = dayEntries(J.day), t = dayTotals(J.day);
  const k = Math.round(t.k), p = Math.round(t.p), left = D.kcalJour - k;
  const ratio = Math.min(1, Math.max(0, k / D.kcalJour)), C = 2 * Math.PI * 70;
  setHeader("", null);
  $("#title").innerHTML = `<span class="daynav"><button data-day="-1" aria-label="Jour précédent">‹</button>
    <span>${J.day === todayKey ? "Aujourd'hui" : esc(fmtDay(J.day))}</span>
    <button data-day="1" ${J.day === todayKey ? "disabled" : ""} aria-label="Jour suivant">›</button></span>`;
  $("#subtitle").textContent = "";

  let h = `<div class="ringcard">
    <div class="side"><b>${k}</b><small>mangé</small></div>
    <svg viewBox="0 0 160 160" class="ring"><circle cx="80" cy="80" r="70" class="bg"/>
      <circle cx="80" cy="80" r="70" class="fg ${left < 0 ? "over" : ""}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ratio)}"/>
      <text x="80" y="78" class="big">${Math.abs(left)}</text><text x="80" y="102" class="lbl">${left < 0 ? "kcal en trop" : "kcal restantes"}</text></svg>
    <div class="side" data-goal><b>${D.kcalJour}</b><small>objectif ✎</small></div>
  </div>
  <div class="macro" data-goal><span>Protéines</span><div class="bar"><i style="width:${Math.min(100, p / D.protJour * 100)}%"></i></div><b>${p} / ${D.protJour} g ✎</b></div>`;

  for (const [id, nom, emo] of MEALS) {
    const list = entries.filter(e => e.meal === id);
    const mk = Math.round(list.reduce((a, e) => a + e.kcal, 0));
    h += `<div class="mealsec"><div class="mealhead"><span>${emo} <b>${nom}</b> <small>${mk ? mk + " kcal" : ""}</small></span>
      <button class="plus" data-add="${id}" aria-label="Ajouter au ${nom}">+</button></div>
      ${list.map(e => `<div class="entry" data-entry="${esc(e.at)}"><span class="txt">${esc(e.nom)}<small>${e.detail ? esc(e.detail) + " · " : ""}${e.qty ? e.qty + " g · " : ""}${fmtTime(e.at)}</small></span>
        <span class="qty">${Math.round(e.kcal)} kcal<small>${Math.round(e.prot)} g prot.</small></span>
        ${e.plat ? `<span class="del"></span>` : `<button class="del" data-delfood="${esc(e.at)}" aria-label="Supprimer">✕</button>`}</div>`).join("")}
    </div>`;
  }
  $("#view").innerHTML = h;

  const shift = n => { const [y, m, d] = J.day.split("-").map(Number); J.day = dateKey(new Date(y, m - 1, d + n)); render(); };
  $("#title").onclick = e => { const b = e.target.closest("[data-day]"); if (b && !b.disabled) shift(+b.dataset.day); };
  $("#view").onclick = e => {
    const a = e.target.closest("[data-add]");
    if (a) return openAdd(a.dataset.add);
    if (e.target.closest("[data-goal]")) return sheetGoals(); // toucher l'objectif (kcal ou protéines) permet de le changer
    if (e.target.closest(".ringcard")) { J.view = "cal"; return render(); } // toucher l'objectif du jour ouvre le calendrier
    const en =e.target.closest("[data-entry]");
    if (en && !e.target.closest("[data-delfood]")) return sheetEditEntry(en.dataset.entry);
    const df = e.target.closest("[data-delfood]");
    if (df) {
      if (!df.dataset.sure) { df.dataset.sure = 1; df.textContent = "?"; df.style.color = "#d33"; return; } // 1er appui : demande, 2e appui : supprime
      S.food = S.food.filter(f => f.at !== df.dataset.delfood); save(); render();
    }
  };
}

// Horodatage d'un ajout : maintenant, ou midi/soir du jour affiché si on remplit un jour passé
function stampFor(meal) {
  const todayKey = dateKey(new Date());
  if (!J.day || J.day === todayKey) return new Date().toISOString();
  const [y, m, d] = J.day.split("-").map(Number);
  return new Date(y, m - 1, d, MEAL_HOUR[meal], Math.floor(Math.random() * 59), Math.floor(Math.random() * 59)).toISOString();
}
function logFood(f) {
  S.food.push({ nom: f.nom, kcal: Math.round(f.kcal), prot: Math.round(f.prot || 0), meal: f.meal, qty: f.qty || null,
    k100: f.k100 ?? null, p100: f.p100 ?? null, code: f.code || null, at: stampFor(f.meal) });
  buzz(); save(); toast(`+ ${Math.round(f.kcal)} kcal`);
}

// ---- Réseau : passe par Android (pas de blocage CORS), sinon fetch dans un navigateur ----
const pending = {};
window.__net = (id, status, body) => { const p = pending[id]; delete pending[id]; p && p(status, body); };
function netGet(url) {
  if (NATIVE && NATIVE.httpGet) return new Promise((ok, ko) => {
    const id = "n" + Date.now() + Math.random();
    pending[id] = (status, body) => status >= 200 && status < 300 ? ok(JSON.parse(body)) : ko(new Error("HTTP " + status));
    NATIVE.httpGet(url, id);
  });
  return fetch(url).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}

// ---- Open Food Facts ----
const OFF_FIELDS = "code,product_name,product_name_fr,brands,nutriments,serving_quantity,image_front_thumb_url";
const offMap = p => {
  const n = p.nutriments || {};
  let k = n["energy-kcal_100g"];
  if (k == null && n["energy_100g"] != null) k = n["energy_100g"] / 4.184; // kJ → kcal
  return {
    nom: (p.product_name_fr || p.product_name || "").trim(), marque: [].concat(p.brands || []).join(", "),
    k100: k == null ? null : +k, p100: +(n["proteins_100g"] || 0), portion: +p.serving_quantity || null,
    code: p.code, img: p.image_front_thumb_url || null
  };
};
async function offSearch(q) {
  try {
    const d = await netGet(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&langs=fr,en&page_size=30&fields=${OFF_FIELDS}`);
    return (d.hits || []).map(offMap);
  } catch {
    const d = await netGet(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${OFF_FIELDS}`);
    return (d.products || []).map(offMap);
  }
}
async function offBarcode(code) {
  const d = await netGet(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${OFF_FIELDS}`);
  if (!d.product) throw new Error("introuvable");
  return offMap({ ...d.product, code });
}

// ---- Écran « Ajouter » ----
const A = { meal: "collation", q: "", results: null, loading: false, err: "" };
function openAdd(meal) {
  Object.assign(A, { meal, q: "", results: null, loading: false, err: "" });
  $("#add").classList.add("open");
  drawAdd();
}
function closeAdd() { stopScan(); $("#add").classList.remove("open"); render(); }

function recents() {
  const out = D.pdj ? [D.pdj] : [], seen = new Set(out.map(f => f.nom)); // D.pdj : petit-déj habituel (réglage personnel)
  for (const f of [...(S.food || [])].reverse()) if (!seen.has(f.nom) && out.length < 20) { seen.add(f.nom); out.push(f); }
  return out;
}

function drawAdd() {
  const mealName = MEALS.find(m => m[0] === A.meal)[1];
  const list = A.results ?? recents();
  $("#add").innerHTML = `
    <header><button id="addclose" aria-label="Fermer">←</button><h1>${esc(mealName)}</h1><button id="quick" class="link">Ajout rapide</button></header>
    <main>
      <form id="sform" class="search"><input id="sq" type="search" placeholder="Rechercher un aliment ou un produit" value="${esc(A.q)}" autocomplete="off">
        <button type="button" id="scan" aria-label="Scanner un code-barres">▥</button><button class="primary" aria-label="Rechercher">🔍</button></form>
      <div class="chips mealpick">${MEALS.map(([id, nom]) => `<button data-meal="${id}" class="${id === A.meal ? "cur" : ""}">${nom}</button>`).join("")}</div>
      <h2>${A.results ? `Résultats Open Food Facts` : "Récents"}</h2>
      ${A.loading ? `<p class="empty">Recherche…</p>` : A.err ? `<p class="empty">${esc(A.err)}</p>` : ""}
      ${!A.loading && !A.err ? list.map((f, j) => `<div class="fooditem" data-pick="${j}">
          ${f.img ? `<img src="${esc(f.img)}" alt="" loading="lazy">` : `<span class="ph">${f.k100 == null && !f.img ? "🍴" : "🛒"}</span>`}
          <span class="txt"><b>${esc(f.nom || "Sans nom")}</b><small>${esc(f.marque || "")}${f.k100 != null ? `${f.marque ? " · " : ""}${Math.round(f.k100)} kcal/100 g · ${Math.round(f.p100)} g prot.` : `${f.kcal} kcal · ${f.prot} g prot.`}</small></span>
          <button class="plus" data-pick="${j}" aria-label="Ajouter">+</button></div>`).join("") || `<p class="empty">Aucun résultat</p>` : ""}
      ${A.results ? `<p class="sub">Données Open Food Facts (ODbL). Rien trouvé ? Utilise « Ajout rapide ».</p>` : ""}
    </main>`;

  $("#addclose").onclick = closeAdd;
  $("#quick").onclick = () => sheetQuick();
  $("#scan").onclick = startScan;
  $("#sform").onsubmit = async e => {
    e.preventDefault();
    A.q = $("#sq").value.trim();
    if (!A.q) { A.results = null; return drawAdd(); }
    A.loading = true; A.err = ""; drawAdd();
    try { A.results = (await offSearch(A.q)).filter(f => f.nom && f.k100 != null); }
    catch { A.results = []; A.err = "Pas de connexion ou service indisponible. Réessaie, ou fais un ajout rapide."; }
    A.loading = false; drawAdd();
  };
  $("#add").onclick = e => {
    const m = e.target.closest("[data-meal]");
    if (m) { A.meal = m.dataset.meal; return drawAdd(); }
    const p = e.target.closest("[data-pick]");
    if (p) sheetFood(list[p.dataset.pick]);
  };
}

// Fiche : quantité en grammes → kcal et protéines calculées (ou valeur fixe pour un aliment récent sans base 100 g)
function sheetFood(f) {
  const per100 = f.k100 != null;
  const qty0 = f.qty || f.portion || 100;
  openSheet(`
    <h3>${esc(f.nom)}</h3><p class="sub">${esc(f.marque || "")}</p>
    ${per100 ? `<label class="qtyrow">Quantité <input id="qg" type="number" inputmode="decimal" value="${qty0}" min="0"> g</label>
      <div class="quick">${[50, 100, 150, 200, 250].map(g => `<button data-g="${g}">${g} g</button>`).join("")}${f.portion ? `<button data-g="${f.portion}">1 portion</button>` : ""}</div>` : ""}
    <div class="calc"><b id="ck"></b> kcal · <b id="cp"></b> g de protéines</div>
    <button class="primary wide" id="sadd">Ajouter</button>`, () => {
    const calc = () => {
      const g = per100 ? +$("#qg").value || 0 : null;
      const k = per100 ? f.k100 * g / 100 : f.kcal, p = per100 ? f.p100 * g / 100 : f.prot;
      $("#ck").textContent = Math.round(k); $("#cp").textContent = Math.round(p);
      return { k, p, g };
    };
    calc();
    if (per100) { $("#qg").oninput = calc; }
    $("#sheet").onclick = e => {
      const b = e.target.closest("[data-g]");
      if (b) { $("#qg").value = b.dataset.g; calc(); }
      if (e.target.id === "sadd") {
        const { k, p, g } = calc();
        logFood({ nom: f.nom, kcal: k, prot: p, meal: A.meal, qty: g, k100: f.k100, p100: f.p100, code: f.code });
        closeSheet(); closeAdd();
      }
    };
  });
}
function sheetQuick() {
  openSheet(`<h3>Ajout rapide</h3>
    <form id="qform" class="qform">
      <input id="qn" placeholder="Quoi ? (ex. pizza, bière…)" required>
      <div class="two"><input id="qk" type="number" inputmode="numeric" placeholder="kcal" required><input id="qp" type="number" inputmode="numeric" placeholder="protéines (g)"></div>
      <button class="primary wide">Ajouter</button></form>`, () => {
    $("#qn").focus();
    $("#qform").onsubmit = e => {
      e.preventDefault();
      logFood({ nom: $("#qn").value.trim(), kcal: +$("#qk").value || 0, prot: +$("#qp").value || 0, meal: A.meal });
      closeSheet(); closeAdd();
    };
  });
}
function openSheet(html, init) {
  $("#sheet").innerHTML = `<div class="sheetbox">${html}</div>`;
  $("#sheet").classList.add("open");
  $("#sheet").onmousedown = e => { if (e.target.id === "sheet") closeSheet(); };
  init();
}
function closeSheet() { $("#sheet").classList.remove("open"); $("#sheet").innerHTML = ""; }

// ---- Scan code-barres : détecteur natif du navigateur, sinon ZXing (embarqué) ----
let scan = null;
async function startScan() {
  openSheet(`<h3>Scanner un code-barres</h3><video id="cam" playsinline muted></video>
    <form id="cform" class="search"><input id="cc" inputmode="numeric" placeholder="ou tape le code"><button class="primary">OK</button></form>
    <p class="sub" id="cmsg">Vise le code-barres du produit.</p>`, () => {
    $("#cform").onsubmit = e => { e.preventDefault(); gotCode($("#cc").value.trim()); };
  });
  try {
    if ("BarcodeDetector" in window) {
      const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = $("#cam"); v.srcObject = stream; await v.play();
      scan = { stop: () => stream.getTracks().forEach(t => t.stop()) };
      const loop = async () => {
        if (!scan) return;
        try { const r = await det.detect(v); if (r[0]) return gotCode(r[0].rawValue); } catch {}
        setTimeout(loop, 250);
      };
      loop();
    } else {
      const reader = new ZXing.BrowserMultiFormatReader();
      scan = { stop: () => reader.reset() };
      reader.decodeFromConstraints({ video: { facingMode: "environment" } }, "cam", res => { if (res) gotCode(res.getText()); });
    }
  } catch (err) {
    $("#cmsg").textContent = "Caméra indisponible (" + (err.message || err) + "). Tape le code à la main.";
  }
}
function stopScan() { if (scan) { scan.stop(); scan = null; } }
async function gotCode(code) {
  if (!code) return;
  stopScan(); buzz(40);
  $("#cmsg") && ($("#cmsg").textContent = `Code ${code} : recherche…`);
  try {
    const f = await offBarcode(code);
    closeSheet();
    if (f.k100 == null) { toast("Produit sans calories connues"); return sheetQuick(); }
    sheetFood(f);
  } catch {
    $("#cmsg") && ($("#cmsg").textContent = `Produit ${code} introuvable dans Open Food Facts. Utilise l'ajout rapide.`);
  }
}

// ---- Calendrier : chaque jour coloré selon l'objectif ----
// Vert : objectif atteint (kcal entre 90 et 110 % de l'objectif ET protéines ≥ 90 %). Orange : quelque chose mangé, objectif pas atteint. Gris : rien.
const dayState = key => {
  if (!dayEntries(key).length) return "none";
  const t = dayTotals(key);
  const okK = t.k >= D.kcalJour * 0.9 && t.k <= D.kcalJour * 1.1, okP = t.p >= D.protJour * 0.9;
  return okK && okP ? "ok" : "part";
};
function renderCalendar() {
  const today = dateKey(new Date());
  J.month ||= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const m = J.month, y = m.getFullYear(), mo = m.getMonth();
  const first = (new Date(y, mo, 1).getDay() + 6) % 7; // semaine qui commence le lundi
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(`<span class="cal-blank"></span>`);
  for (let d = 1; d <= new Date(y, mo + 1, 0).getDate(); d++) {
    const key = dateKey(new Date(y, mo, d)), st = dayState(key);
    cells.push(`<button class="cal-day cal-${st} ${key === today ? "cal-today" : ""}" data-cday="${key}">${d}</button>`);
  }
  setHeader("", null);
  $("#title").innerHTML = `<span class="daynav"><button data-mon="-1" aria-label="Mois précédent">‹</button>
    <span>${esc(m.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }))}</span><button data-mon="1" aria-label="Mois suivant">›</button></span>`;
  $("#subtitle").textContent = "";
  $("#title").onclick = e => { const b = e.target.closest("[data-mon]"); if (b) { J.month = new Date(y, mo + +b.dataset.mon, 1); render(); } };
  $("#view").innerHTML = `<div class="jtabs"><button data-jv="day">‹ Jour</button></div>
    <div class="cal-week">${["L", "M", "M", "J", "V", "S", "D"].map(x => `<span>${x}</span>`).join("")}</div>
    <div class="cal">${cells.join("")}</div>
    <div class="legend"><span class="cal-ok">■</span> objectif atteint · <span class="cal-part">■</span> partiel · <span class="cal-none">■</span> rien</div>
    <p class="sub">Objectif atteint : kcal entre 90 et 110 % de ${D.kcalJour} et au moins 90 % de ${D.protJour} g de protéines. Touche un jour pour le voir et le corriger.</p>`;
  $("#view").onclick = e => {
    if (e.target.closest("[data-jv]")) { J.view = "day"; return render(); }
    const c = e.target.closest("[data-cday]");
    if (c) { J.day = c.dataset.cday; J.view = "day"; render(); }
  };
}

// Corriger une entrée du journal : un plat (pourcentage mangé) ou un aliment saisi (nom, kcal, protéines)
function sheetEditEntry(at) {
  const log = (S.log || []).find(e => e.at === at), food = (S.food || []).find(f => f.at === at);
  const fixEaten = i => { const last = [...S.log].reverse().find(e => e.i === i); S.eaten[i] = last ? last.to : 0; };
  if (log) {
    const id = log.rid || D.semaine[log.i].recette, r = getR(id);
    openSheet(`<h3>${r.emoji} ${esc(r.nom)}</h3>
      <p class="sub">${fmtTime(log.at)} · 100 = une portion</p>
      <div class="qform"><label class="sub">Part mangée</label>
        <div class="stepper small"><input id="ep" type="number" inputmode="numeric" min="0" max="${log.rid ? 1000 : 100}" step="5" value="${log.to}"><span>% d'une portion</span></div></div>
      <div class="two" style="margin-top:14px"><button id="edel">🗑️ Retirer</button><button class="primary" id="eok">Enregistrer</button></div>`, () => {
      $("#sheet").onclick = e => {
        if (e.target.id === "eok") {
          log.to = Math.max(log.from || 0, Math.min(log.rid ? 1000 : 100, +$("#ep").value || 0));
          if (!log.rid) fixEaten(log.i);
          save(); closeSheet(); render(); toast("Modifié");
        }
        if (e.target.id === "edel" && !e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Confirmer le retrait"; e.target.style.color = "#d33"; return; }
        if (e.target.id === "edel") {
          S.log = S.log.filter(x => x !== log);
          if (!log.rid) fixEaten(log.i);
          save(); closeSheet(); render();
        }
      };
    });
  } else if (food) {
    openSheet(`<h3>${esc(food.nom)}</h3>
      <form id="fform" class="qform">
        <input id="fn" value="${esc(food.nom)}" required autocomplete="off">
        <div class="two"><input id="fk" type="number" inputmode="numeric" value="${food.kcal}" placeholder="kcal"><input id="fp" type="number" inputmode="numeric" value="${food.prot}" placeholder="protéines (g)"></div>
        <div class="two" style="margin-top:6px"><button type="button" id="fdel">🗑️ Supprimer</button><button class="primary">Enregistrer</button></div>
      </form>`, () => {
      $("#fform").onsubmit = e => {
        e.preventDefault();
        Object.assign(food, { nom: $("#fn").value.trim() || food.nom, kcal: Math.round(+$("#fk").value || 0), prot: Math.round(+$("#fp").value || 0) });
        save(); closeSheet(); render(); toast("Modifié");
      };
      $("#fdel").onclick = () => {
        const b = $("#fdel");
        if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Confirmer la suppression"; b.style.color = "#d33"; return; }
        S.food = S.food.filter(f => f !== food); save(); closeSheet(); render();
      };
    });
  }
}
