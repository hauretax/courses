const VERSION = "dev"; // date de mise en ligne, posée par deploy.sh (affichée dans ⚙️)
const D = window.DATA;
const KEY = "courses-state-v1";
const $ = s => document.querySelector(s);

// ---- État persistant (localStorage) ----
let S = { checked: {}, extras: [], days: {}, steps: {}, ings: {}, hideDone: false, tab: "journal", food: [], plan: null };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
initCuisine(); initPlacard(); initCloud(); applyPlan(); // initCloud avant applyPlan : réglages personnels et aliments des recettes partagées
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} cloudDirty(); };
initTickets(); // après save : initTickets l'appelle

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = msg => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1800); };
const NATIVE = window.Android; // présent dans l'appli Android, absent dans un navigateur
const buzz = (ms = 15) => NATIVE ? NATIVE.vibrate(ms) : navigator.vibrate && navigator.vibrate(ms);

// Tous les articles (fixes + ajoutés) groupés par rayon, sans ceux déjà notés « au placard »
function groups() {
  const have = S.have || {};
  const g = D.courses.map(r => ({ rayon: r.rayon, items: r.items.filter(i => !have[i[0]]).map(([id, nom, qte]) => ({ id, nom, qte })) }));
  for (const x of S.extras) {
    if (have[x.id]) continue;
    let r = g.find(r => r.rayon === x.rayon);
    if (!r) g.push(r = { rayon: x.rayon, items: [] });
    r.items.push({ ...x, extra: true });
  }
  return g;
}

// ---- Onglet Courses ----
const openRayons = {}; // rayons finis rouverts à la main (non sauvegardé)
// Mode placard : à activer exprès avant de partir. Tant qu'il est actif, toucher un article veut dire « j'en ai déjà »
// (il sort de la liste et entre au placard) au lieu de le cocher. Non sauvegardé : il s'éteint si on quitte l'appli.
let haveMode = false;
function renderCourses() {
  if (S.ctab === "placard") return renderPlacard();
  const g = groups();
  const all = g.flatMap(r => r.items);
  const done = all.filter(i => S.checked[i.id]).length;
  setHeader(`${done} / ${all.length} dans le panier`, all.length ? done / all.length : 1);

  let h = segHTML() + `<div class="tools">
    <button id="havemode">🏠 J'ai déjà…</button>
    <button id="ranger">🗄️ Ranger les achats</button>
    <button id="ticket">🧾 Ticket</button>
    <button id="share">Partager</button>
    <button id="menu" aria-label="Plus d'options">⋯</button></div>`;

  if (haveMode) h = segHTML() + `<div class="alert havebar"><span>🏠 <b>Mode placard</b> : touche ce que tu as déjà chez toi. L'article sort de la liste et entre au placard.</span><button class="primary" id="havemode">Terminer</button></div>`;
  for (const r of g) {
    // Non cochés d'abord, cochés en bas du rayon
    const items = [...r.items].sort((a, b) => !!S.checked[a.id] - !!S.checked[b.id])
      .filter(i => !(S.hideDone && S.checked[i.id]));
    if (!items.length) continue;
    const left = r.items.filter(i => !S.checked[i.id]).length;
    // Rayon fini : replié (juste le titre), on le touche pour le rouvrir
    if (!left && !openRayons[r.rayon]) { h += `<h2 class="fold" data-fold="${esc(r.rayon)}">${esc(r.rayon)} · ✓ ${r.items.length} <span>▸</span></h2>`; continue; }
    h += `<h2 ${!left ? `class="fold" data-fold="${esc(r.rayon)}"` : ""}>${esc(r.rayon)} · ${left ? left + " restant" + (left > 1 ? "s" : "") : "✓ <span>▾</span>"}</h2><div class="list">`;
    for (const i of items) h += `<div class="row ${S.checked[i.id] ? "on" : ""}" data-id="${esc(i.id)}">
      <span class="box"></span><span class="txt">${esc(i.nom)}</span><span class="qty">${esc(i.qte || "")}</span>
      ${i.extra ? `<button class="del" data-del="${esc(i.id)}" aria-label="Supprimer">✕</button>` : ""}</div>`;
    h += `</div>`;
  }
  const nHave = Object.keys(S.have || {}).length;
  if (nHave) h += `<p class="sub" style="text-align:center;margin-top:12px">${nHave} article${nHave > 1 ? "s" : ""} déjà au placard, retiré${nHave > 1 ? "s" : ""} de la liste · <button class="link" id="unhave">Annuler</button></p>`;
  if (!all.length && !D.semaine.length) h += `<p class="empty">Ta liste est vide.<br>Choisis tes plats dans Recettes › « Préparer ma semaine » : la liste se remplit toute seule. Tu peux aussi ajouter des articles ci-dessous.</p>`;
  else if (S.hideDone && done === all.length) h +=`<p class="empty">🎉 Tout est dans le panier !</p>`;

  h += `<form class="add" id="addf"><input id="addn" placeholder="Ajouter un article…" autocomplete="off">
    <select id="addr">${g.map(r => `<option>${esc(r.rayon)}</option>`).join("")}<option>Divers</option></select>
    <button class="primary">+</button></form>`;
  $("#view").innerHTML = h;

  $("#view").onclick = e => {
    const sg = e.target.closest("[data-seg]");
    if (sg) { S.ctab = sg.dataset.seg; save(); return render(); }
    const fold = e.target.closest("[data-fold]");
    if (fold) { openRayons[fold.dataset.fold] = !openRayons[fold.dataset.fold]; return render(); }
    if (e.target.closest("#unhave")) return unhaveAll();
    const del = e.target.closest("[data-del]");
    if (del) { S.extras = S.extras.filter(x => x.id !== del.dataset.del); delete S.checked[del.dataset.del]; save(); return render(); }
    const row = e.target.closest(".row");
    if (!row) return;
    if (haveMode) return haveItem(row.dataset.id);
    S.checked[row.dataset.id] = !S.checked[row.dataset.id]; buzz(); save(); render();
  };
  $("#havemode").onclick = () => { haveMode = !haveMode; render(); };
  if (haveMode) return; // en mode placard, les autres boutons ne sont pas affichés
  $("#ranger").onclick = rangerCourses;
  $("#ticket").onclick = sheetTickets;
  // Options moins fréquentes, rangées dans « ⋯ »
  $("#menu").onclick = () => openSheet(`<h3>Liste de courses</h3>
    <button class="wide" id="hide">${S.hideDone ? "Afficher" : "Masquer"} les articles cochés</button>
    <button class="wide" id="newweek" style="margin-top:10px">🗓️ Nouvelle semaine…</button>
    <h3 style="margin-top:18px">Mes données</h3>
    <p class="sub">Un fichier JSON avec tout : journal, plats cuisinés, notes, placard, tickets et prix, recettes.</p>
    <button class="wide" id="exp">⬇️ Exporter (sans les photos)</button>
    <button class="wide" id="expp" style="margin-top:10px">⬇️ Exporter avec les photos (fichier lourd)</button>`, () => {
    $("#exp").onclick = () => { closeSheet(); exportData(false); };
    $("#expp").onclick = () => { closeSheet(); exportData(true); };
    $("#hide").onclick = () => { S.hideDone = !S.hideDone; save(); closeSheet(); render(); };
    $("#newweek").onclick = () => { closeSheet(); openPlanner(); };
  });
  $("#share").onclick = async () => {
    const txt = g.map(r => {
      const m = r.items.filter(i => !S.checked[i.id]);
      return m.length ? `${r.rayon}\n` + m.map(i => `- ${i.nom}${i.qte ? " : " + i.qte : ""}`).join("\n") : "";
    }).filter(Boolean).join("\n\n") || "Rien à acheter 🎉";
    if (NATIVE) NATIVE.share(txt);
    else if (navigator.share) { try { await navigator.share({ title: "Liste de courses", text: txt }); } catch {} }
    else { await navigator.clipboard.writeText(txt); toast("Liste copiée"); }
  };
  $("#addf").onsubmit = e => {
    e.preventDefault();
    const nom = $("#addn").value.trim();
    if (!nom) return;
    S.extras.push({ id: "x" + Date.now(), nom, qte: "", rayon: $("#addr").value });
    save(); render(); $("#addn").focus();
  };
}

// ---- Dates ----
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDay = key => {
  const [y, m, d] = key.split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return key === dateKey(new Date()) ? "Aujourd'hui, " + s : s[0].toUpperCase() + s.slice(1);
};
const fmtTime = iso => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtWhen = iso => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) + " " + fmtTime(iso);

// ---- Onglet Semaine ----
// Une carte par plat cuisiné cette semaine (recette terminée), sans notion de jour : on y note les portions mangées.
// Un plat n'apparaît qu'une fois ; ✕ le masque sans rien déclarer. Les repas déclarés sans cuisson ont aussi leur carte.
const hid = k => !!(S.hide && S.hide.wk === wkKey() && S.hide.keys[k]);
const nHid = () => S.hide && S.hide.wk === wkKey() ? Object.keys(S.hide.keys).length : 0;
// Confirmation dans l'appli : le 1er appui transforme le ✕ en question rouge (3 s), le 2e appui confirme
function sure(btn, txt) {
  if (btn.dataset.sure) return true;
  btn.dataset.sure = 1; btn.textContent = txt; btn.style.color = "#d33"; btn.style.fontWeight = "700";
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = "✕"; btn.style.color = btn.style.fontWeight = ""; } }, 3000);
  return false;
}
function hideCard(k) {
  if (!S.hide || S.hide.wk !== wkKey()) S.hide = { wk: wkKey(), keys: {} };
  S.hide.keys[k] = 1; save(); render(); toast("Plat masqué");
}
// Part du plat déjà mangée, en portions (une entrée du journal à 100 = une portion)
const eatenOf = c => S.log.filter(e => e.ck === c.end && e.rid === c.id).reduce((a, e) => a + (e.to - e.from) / 100, 0);
const dishPct = c => Math.min(100, Math.round(eatenOf(c) / (c.portions || c.n || 1) * 100 / 5) * 5);
const editing = {}; // plats finis rouverts pour modification
// Le curseur dit « j'ai mangé tant de % du plat entier » : la différence avec avant part dans le journal, à l'heure actuelle.
// Si on baisse le curseur, on retire d'abord les dernières entrées de ce plat.
function setDish(c, pct) {
  const tot = c.portions || c.n || 1, mine = e => e.ck === c.end && e.rid === c.id;
  let delta = pct / 100 * tot - eatenOf(c); // en portions
  while (delta < -0.001) {
    const last = [...S.log].reverse().find(mine); if (!last) break;
    const amt = (last.to - last.from) / 100;
    if (amt <= -delta + 0.001) { S.log.splice(S.log.indexOf(last), 1); delta += amt; }
    else { last.to = Math.round(last.to + delta * 100); delta = 0; }
  }
  if (delta > 0.001) S.log.push({ rid: c.id, ck: c.end, from: 0, to: Math.round(delta * 100), at: new Date().toISOString() });
  delete editing[c.id + c.end];
  buzz(pct === 100 ? 60 : 15); save(); render();
  if (pct === 100) toast("Plat fini 🎉");
}
function renderSemaine() {
  rollWeek(); // initialise aussi S.log et S.food
  setHeader(fmtDay(dateKey(new Date())), null);
  const ws = weekStart();
  const cooks = S.cooks.map((c, n) => ({ c, n })).filter(x => new Date(x.c.end) >= ws && getR(x.c.id) && !hid("c" + x.c.id + x.c.end)).reverse();
  const extras = S.log.map((e, n) => e.rid && !e.ck && getR(e.rid) ? extraCard(e, n) : "").join("");
  // Plats de côté (frigo, congélateur) d'une semaine d'avant ou donnés : ils se mangent ici aussi.
  // Ceux d'un plat cuisiné cette semaine sont déjà comptés par le curseur de sa carte : on ne les montre pas deux fois.
  const cuits = new Set(S.cooks.filter(c => new Date(c.end) >= ws).map(c => c.id));
  const cote = (S.plats || []).filter(p => !cuits.has(p.rid)).map(platCard).join("");
  $("#view").innerHTML = cooks.map(x => cookCard(x.c, x.n)).join("") + cote + extras
    + (!cooks.length && !cote && !extras ? `<p class="empty">Aucun plat cuisiné cette semaine.<br>Termine une recette (« ✓ Recette faite ») : elle apparaît ici.</p>` : "")
    + `<button class="wide" id="declare" style="margin-top:12px">＋ Déclarer un repas sans cuisson</button>`
    + (nHid() ? `<button class="link" id="unhide" style="display:block;margin:10px auto">Réafficher les plats masqués (${nHid()})</button>` : "");

  fillCookPhotos($("#view"));
  // Pendant le glissement : on met à jour l'affichage sans tout redessiner
  $("#view").oninput = e => {
    const sl = e.target.closest("input[type=range]"); if (!sl) return;
    const box = sl.closest(".meal");
    box.querySelector(".pct").textContent = sl.value + " %";
    sl.style.setProperty("--v", sl.value + "%");
    box.querySelector(".ok").classList.toggle("off", sl.value === sl.dataset.cur);
  };
  $("#view").onclick = e => {
    const im = e.target.closest(".cph img");
    if (im) return im.classList.toggle("zoom");
    if (e.target.closest("#declare")) return sheetDeclare();
    if (e.target.closest("#unhide")) { delete S.hide; save(); return render(); }
    const hd = e.target.closest("[data-hide]");
    if (hd) return sure(hd, "Masquer ?") && hideCard(hd.dataset.hide);
    const ok = e.target.closest("[data-ok]:not(.off)");
    if (ok) return setDish(S.cooks[+ok.dataset.ok], +ok.closest(".meal").querySelector("input").value);
    const full = e.target.closest("[data-full]");
    if (full) return setDish(S.cooks[+full.dataset.full], 100);
    const ed = e.target.closest("[data-edit]");
    if (ed) { const c = S.cooks[+ed.dataset.edit]; editing[c.id + c.end] = true; return render(); }
    const ep = e.target.closest("[data-eatplat]");
    if (ep) return eatPlat(S.plats.find(p => p.id === ep.dataset.eatplat));
    const xd = e.target.closest("[data-xdel]");
    if (xd) { if (sure(xd, "Retirer ?")) { S.log.splice(+xd.dataset.xdel, 1); save(); render(); } return; }
    const nb = e.target.closest("[data-note]");
    if (nb) return sheetNote(nb.dataset.note);
    const o = e.target.closest("[data-open]");
    if (o) openCook(o.dataset.open);
  };
}
// Carte d'un plat cuisiné : un curseur « combien j'en ai mangé » (du plat entier), Valider, ou « Tout ✓ »
function cookCard(c, n) {
  const r = getR(c.id), tot = c.portions || c.n || 1, cur = dishPct(c), nt = S.notes[c.id];
  const fini = cur === 100 && !editing[c.id + c.end], kcal = Math.round(portionOf(c.id).kcal * eatenOf(c));
  return `<div class="meal ${fini ? "fini" : ""}">
    <div class="meal-top" data-open="${esc(c.id)}"><span class="what">${r.emoji} ${esc(r.nom)}<small>${cur ? `${cur} % · ${kcal} kcal · ` : ""}${num(tot)} portion${tot > 1 ? "s" : ""} · cuisiné ${fmtWhen(c.end)}</small></span>
      <button class="note ${nt ? "on" : ""}" data-note="${esc(c.id)}">${nt && nt.stars ? "★ " + nt.stars : "☆"}</button><button class="note" data-hide="c${esc(c.id + c.end)}" aria-label="Masquer ce plat">✕</button></div>
    ${c.nPhotos ? `<div class="cph" data-cph="${esc(c.end)}"></div>` : ""}
    ${fini
      ? `<div class="done-row"><span class="badge">✓ Fini</span><button data-edit="${n}">Modifier</button></div>`
      : `<div class="slide-row">
          <input type="range" min="0" max="100" step="5" value="${cur}" data-cur="${cur}" style="--v:${cur}%">
          <span class="pct">${cur} %</span>
          <button class="fullbtn" data-full="${n}">Tout ✓</button>
          <button class="primary ok off" data-ok="${n}">Valider</button>
        </div>`}
  </div>`;
}
// Carte d'un plat de côté : portions restantes, où il est, et jusqu'à quand il se garde
function platCard(p) {
  return `<div class="meal"><div class="meal-top"><span class="what">${p.emoji || "🍱"} ${esc(p.nom)}<small>${p.n} portion${p.n > 1 ? "s" : ""} de côté · ${p.loc === "congel" ? "❄️ congélateur" : "🧊 frigo"} · à manger avant : ${dlTxt(daysLeft(platExp(p)))}${p.kcalP ? ` · ${p.kcalP} kcal la portion` : ""}</small></span></div>
    <div class="done-row"><span class="badge">🍱 De côté</span><button class="primary" data-eatplat="${esc(p.id)}">J'en mange une portion</button></div></div>`;
}
// Carte d'un repas déclaré sans cuisson (plat acheté, reste, dessert d'un coloc…)
function extraCard(e, n) {
  const r = getR(e.rid);
  return `<div class="meal fini"><div class="meal-top"><span class="what">${r.emoji} ${esc(r.nom)}<small>${e.to} % d'une portion · ${fmtWhen(e.at)} · sans cuisson</small></span><button class="note" data-xdel="${n}" aria-label="Retirer">✕</button></div></div>`;
}

// Bouton retour Android : ferme ce qui est ouvert au premier plan au lieu de quitter l'appli
window.onBack = () => {
  if ($("#sheet").classList.contains("open")) { stopScan(); closeSheet(); return true; }
  if ($("#add").classList.contains("open")) { closeAdd(); return true; }
  if ($("#plan").classList.contains("open")) { if (P.view === "recipe" && !P.solo) { P.view = "plan"; drawPlan(); } else closePlan(); return true; }
  if ($("#cook").classList.contains("open")) { closeCook(); return true; }
  return false;
};

// ---- Navigation ----
function setHeader(sub, ratio) {
  $("#title").textContent = D.titre;
  $("#subtitle").textContent = sub;
  $(".bar").style.display = ratio == null ? "none" : "";
  if (ratio != null) $("#progress").style.width = Math.round(ratio * 100) + "%";
}
function render() {
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("cur", b.dataset.tab === S.tab));
  ({ journal: renderJournal, courses: renderCourses, semaine: renderSemaine, recettes: renderRecettes })[S.tab]();
}
document.querySelectorAll("nav button").forEach(b => b.onclick = () => { S.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); });
rollWeek(); // ici et pas plus haut : utilise dateKey, défini au milieu de ce fichier
render();
startCloud();

// Mise à jour de l'appli : la nouvelle version se télécharge en arrière-plan. On recharge tout de suite si l'appli vient de s'ouvrir,
// sinon dès qu'on la quitte (pour ne pas couper ce qu'on est en train de faire) : au retour, c'est la nouvelle version.
if (!NATIVE && location.protocol.startsWith("http") && "serviceWorker" in navigator) {
  const t0 = Date.now(), had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!had) return; // première installation : la page est déjà à jour
    if (Date.now() - t0 < 5000) return location.reload();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && !Object.keys(timers).length) location.reload(); }); // un minuteur de cuisine en cours : on attend
  });
}
