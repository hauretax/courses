// ---- Placard : ce que j'ai à la maison (frigo, congélo, placard, épices), plats de côté, ticket de caisse ----
// Affiché dans l'onglet Courses (sélecteur « À acheter | Placard »). Chargé avant app.js.

const LOCS = [["frigo", "Frigo", "🧊"], ["congel", "Congélateur", "❄️"], ["placard", "Placard", "🗄️"], ["epices", "Épices", "🧂"]];
const PLAT_DAYS = { frigo: 3, congel: 90 }; // conservation d'un plat maison
function initPlacard() { S.pantry ||= []; S.plats ||= []; S.stored ||= {}; S.tickets ||= []; S.ctab ||= "liste"; }
const pid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isoDay = d => dateKey(d);
const daysLeft = exp => { if (!exp) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(exp + "T00:00:00") - t) / 864e5); };
const dlTxt = d => d < 0 ? "périmé" : d === 0 ? "aujourd'hui" : d === 1 ? "demain" : d <= 30 ? `${d} j` : `${Math.round(d / 30)} mois`;
const expCls = d => d == null ? "" : d < 0 ? "x-bad" : d <= 3 ? "x-soon" : "x-ok";
const platExp = p => isoDay(new Date(new Date(p.at).getTime() + (PLAT_DAYS[p.loc] || 3) * 864e5));

// Quantités : en pièces pour les aliments qui ont un poids moyen, sinon en grammes
const pGrams = p => p.u === "pc" ? p.q * ((AL[p.k] || {}).pc || 0) : p.u === "g" ? p.q : 0;
const pQty = p => p.u === "pc" ? `${num(p.q)} ${AL[p.k] ? "" : "pièce" + (p.q > 1 ? "s" : "")}`.trim() : p.u === "g" ? (p.q >= 1000 ? `${num(p.q / 1000)} kg` : `${Math.round(p.q)} g`) : p.q > 1 ? `×${num(p.q)}` : "";
const pName = p => p.k && AL[p.k] ? (p.u === "pc" && p.q > 1 ? AL[p.k].np || AL[p.k].n : AL[p.k].n) : p.nom;
const pEmoji = p => (AL[p.k] || {}).e || p.e || (LOCS.find(l => l[0] === p.loc) || [])[2] || "📦";

function stockOf(k) { return k ? S.pantry.filter(p => p.k === k).reduce((a, p) => a + pGrams(p), 0) : 0; }
// Une recette terminée retire ce qu'elle a utilisé (en commençant par ce qui périme en premier)
function useStock(k, g) {
  const items = S.pantry.filter(p => p.k === k && pGrams(p) > 0).sort((a, b) => (a.exp || "9").localeCompare(b.exp || "9"));
  if (!items.length || !g) return [];
  let left = g;
  for (const p of items) {
    if (left <= 0) break;
    const pg = pGrams(p), take = Math.min(pg, left), per = p.u === "pc" ? AL[p.k].pc : 1;
    left -= take; p.q = Math.round((pg - take) / per * 10) / 10;
  }
  S.pantry = S.pantry.filter(p => p.u === "x" || p.q > 0.05);
  return [`${AL[k].n} −${Math.round(g - Math.max(0, left))} g`];
}
function addPlat(p) { S.plats.push({ id: pid(), at: new Date().toISOString(), ...p }); }

// Un article de la liste de courses devient un produit du placard (en pièces si l'aliment a un poids moyen, sinon en grammes)
function pantryItem(nom, k, g) {
  const a = AL[k], pc = a && a.pc >= 20, base = { id: pid(), exp: null, at: new Date().toISOString() };
  return a ? { ...base, k, q: pc ? Math.max(1, Math.round(g / a.pc)) : g, u: pc ? "pc" : "g", loc: a.loc } : { ...base, nom, q: 1, u: "x", loc: "placard" };
}
// « Déjà au placard » sur un article de la liste : il sort des courses sans passer par le panier, et entre au placard
// avec la quantité prévue (pour que les recettes la retirent ensuite). S.have garde le produit créé, pour pouvoir annuler.
function haveItem(id) {
  const it = D.courses.flatMap(r => r.items).find(i => i[0] === id), x = S.extras.find(e => e.id === id);
  if (!it && !x) return;
  const p = it ? pantryItem(it[1], it[3], it[4]) : pantryItem(x.nom);
  S.have ||= {}; S.pantry.push(p); S.have[id] = p.id; delete S.checked[id];
  buzz(); save(); render(); toast("Noté au placard, retiré des courses");
}
function unhaveAll() {
  const ids = new Set(Object.values(S.have || {}));
  S.pantry = S.pantry.filter(p => !ids.has(p.id)); S.have = {};
  save(); render();
}
// Les articles cochés de la liste de courses partent au placard (une seule fois par article)
function rangerCourses() {
  let n = 0;
  for (const r of D.courses) for (const [id, nom, , k, g] of r.items) {
    if (!S.checked[id] || S.stored[id]) continue;
    S.pantry.push(pantryItem(nom, k, g));
    S.stored[id] = true; n++;
  }
  for (const x of S.extras) if (S.checked[x.id] && !S.stored[x.id]) {
    S.pantry.push(pantryItem(x.nom));
    S.stored[x.id] = true; n++;
  }
  save();
  if (n) { S.ctab = "placard"; render(); toast(`${n} produit${n > 1 ? "s" : ""} rangé${n > 1 ? "s" : ""} · ajoute les dates si tu veux`); }
  else toast("Rien de nouveau à ranger : coche d'abord ce que tu as acheté");
}

const segHTML = () => `<div class="seg"><button data-seg="liste" class="${S.ctab !== "placard" ? "cur" : ""}">🛒 À acheter</button><button data-seg="placard" class="${S.ctab === "placard" ? "cur" : ""}">🗄️ Placard</button></div>`;

function renderPlacard() {
  const portions = S.plats.reduce((a, p) => a + p.n, 0);
  setHeader(`${S.pantry.length} produit${S.pantry.length > 1 ? "s" : ""} · ${portions} portion${portions > 1 ? "s" : ""} de côté`, null);
  const soon = [
    ...S.pantry.filter(p => { const d = daysLeft(p.exp); return d != null && d <= 3; }).map(p => ({ e: pEmoji(p), nom: pName(p), d: daysLeft(p.exp) })),
    ...S.plats.map(p => ({ e: p.emoji || "🍱", nom: p.nom, d: daysLeft(platExp(p)) })).filter(x => x.d <= 1)
  ].sort((a, b) => a.d - b.d);

  let h = segHTML();
  if (soon.length) h += `<div class="alert">⏰ <b>À manger vite :</b> ${soon.map(x => `${x.e} ${esc(x.nom)} <small>(${dlTxt(x.d)})</small>`).join(" · ")}</div>`;

  const shelves = (tiles, empty) => {
    const rows = []; for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));
    return (rows.length ? rows : [[]]).map(r => `<div class="shelf">${r.join("") || `<span class="emptyshelf">${empty}</span>`}</div>`).join("");
  };
  const plats = S.plats.map(p => { const d = daysLeft(platExp(p)); return `<button class="jar tup ${expCls(d)}" data-plat="${p.id}">
      <span class="je">${p.emoji || "🍱"}</span><span class="jn">${esc(p.nom)}</span><span class="jq">${p.n} portion${p.n > 1 ? "s" : ""} ${p.loc === "congel" ? "❄️" : "🧊"}</span>
      <span class="jx">${p.from ? "de " + esc(p.from) : dlTxt(d)}</span></button>`; });
  h += `<div class="cab cab-plats"><div class="cabhead"><span>🍱 Plats de côté</span><button class="plus" data-addplat aria-label="Ajouter un plat">+</button></div>
    ${shelves(plats, "Aucun plat d'avance")}</div>`;

  for (const [loc, nom, e] of LOCS) {
    const items = S.pantry.filter(p => p.loc === loc).sort((a, b) => (a.exp || "9").localeCompare(b.exp || "9"));
    const tiles = items.map(p => { const d = daysLeft(p.exp); return `<button class="jar ${expCls(d)}" data-p="${p.id}">
        <span class="je">${pEmoji(p)}</span><span class="jn">${esc(pName(p))}</span><span class="jq">${esc(pQty(p))}</span>${d != null ? `<span class="jx">${dlTxt(d)}</span>` : ""}</button>`; });
    h += `<div class="cab cab-${loc}"><div class="cabhead"><span>${e} ${nom} <small>${items.length || ""}</small></span><button class="plus" data-addp="${loc}" aria-label="Ajouter">+</button></div>
      ${shelves(tiles, "vide")}</div>`;
  }
  h += `<p class="sub" style="text-align:center">Astuce : dans « À acheter », le bouton « Ranger » met tes achats cochés ici.</p>`;
  $("#view").innerHTML = h;
  $("#view").onclick = e => {
    const sg = e.target.closest("[data-seg]");
    if (sg) { S.ctab = sg.dataset.seg; save(); return render(); }
    const ap = e.target.closest("[data-addp]"); if (ap) return sheetProduit(null, ap.dataset.addp);
    const p = e.target.closest("[data-p]"); if (p) return sheetProduit(S.pantry.find(x => x.id === p.dataset.p));
    if (e.target.closest("[data-addplat]")) return sheetPlat();
    const pl = e.target.closest("[data-plat]"); if (pl) return sheetPlat(S.plats.find(x => x.id === pl.dataset.plat));
  };
}

// Ajouter / modifier un produit du placard
function sheetProduit(p, loc0, pre = "") {
  const isNew = !p;
  p = p ? { ...p } : { id: pid(), q: "", u: "g", loc: loc0 || "placard", exp: null, at: new Date().toISOString() };
  const plus = n => isoDay(new Date(Date.now() + n * 864e5));
  openSheet(`<h3>${isNew ? "Ajouter au placard" : `${pEmoji(p)} ${esc(pName(p))}`}</h3>
    <form id="pform" class="qform">
      <input id="pn" list="plist" placeholder="Quoi ? (ex. riz, carottes, lait…)" value="${esc(p.k && AL[p.k] ? AL[p.k].n : p.nom || pre)}" required autocomplete="off">
      <datalist id="plist">${Object.values(AL).map(a => `<option value="${esc(a.n)}">`).join("")}</datalist>
      <div class="two"><input id="pq" type="number" inputmode="decimal" step="any" placeholder="Quantité" value="${p.q}">
        <select id="pu"><option value="g">g</option><option value="pc">pièce(s)</option><option value="x">unité(s)</option></select></div>
      <div class="chips" id="ploc">${LOCS.map(([k, n, e]) => `<button type="button" data-loc="${k}" class="${p.loc === k ? "cur" : ""}">${e} ${n}</button>`).join("")}</div>
      <label class="sub">Date de péremption (facultatif)</label>
      <div class="two"><input id="pe" type="date" value="${p.exp || ""}"></div>
      <div class="quick">${[["+3 j", 3], ["+1 sem.", 7], ["+1 mois", 30], ["+6 mois", 182]].map(([l, n]) => `<button type="button" data-exp="${plus(n)}">${l}</button>`).join("")}<button type="button" data-exp="">Aucune</button></div>
      ${isNew ? `<button type="button" class="link" id="pnew">+ Pas dans la liste ? Crée l'aliment</button>` : ""}
      <div class="two">${isNew ? "" :`<button type="button" id="pdel">🗑️ Plus rien</button>`}<button class="primary wide">${isNew ? "Ajouter" : "Enregistrer"}</button></div>
    </form>`, () => {
    $("#pu").value = p.u;
    const keyOf = n => Object.keys(AL).find(k => [AL[k].n, AL[k].np || ""].some(x => x.toLowerCase() === n.trim().toLowerCase()));
    if (isNew) $("#pn").focus();
    $("#pn").oninput = () => {
      const k = keyOf($("#pn").value); if (!k || !isNew) return;
      $("#pu").value = AL[k].pc >= 20 ? "pc" : "g";
      p.loc = AL[k].loc; document.querySelectorAll("#ploc button").forEach(b => b.classList.toggle("cur", b.dataset.loc === p.loc));
    };
    $("#sheet").onclick = e => {
      const l = e.target.closest("[data-loc]");
      if (l) { p.loc = l.dataset.loc; document.querySelectorAll("#ploc button").forEach(b => b.classList.toggle("cur", b === l)); }
      const x = e.target.closest("[data-exp]"); if (x) $("#pe").value = x.dataset.exp;
      if (e.target.id === "pnew") return openNewAliment($("#pn").value, k => sheetProduit(null, loc0, AL[k].n));
      if (e.target.id === "pdel") { S.pantry = S.pantry.filter(y => y.id !== p.id); save(); closeSheet(); render(); toast("Retiré du placard"); }
    };
    $("#pform").onsubmit = e => {
      e.preventDefault();
      const k = keyOf($("#pn").value);
      Object.assign(p, { k: k || null, nom: k ? undefined : $("#pn").value.trim(), q: +$("#pq").value || 1, u: $("#pu").value, exp: $("#pe").value || null });
      if (isNew) S.pantry.push(p); else S.pantry[S.pantry.findIndex(y => y.id === p.id)] = p;
      save(); closeSheet(); render(); buzz();
    };
  });
}

// Manger une portion d'un plat de côté : elle part dans le journal (au repas de l'heure qu'il est) et sort du placard
function eatPlat(p) {
  S.food ||= [];
  S.food.push({ nom: `${p.emoji || "🍱"} ${p.nom}`, kcal: p.kcalP || 0, prot: p.protP || 0, meal: mealNow(), at: new Date().toISOString() });
  p.n--; if (p.n <= 0) S.plats = S.plats.filter(x => x !== p);
  buzz(40); save(); render(); toast(p.kcalP ? `Bon appétit · + ${p.kcalP} kcal au journal` : "Bon appétit !");
}
// Plat de côté : manger une portion (va dans le journal), déplacer, ou en ajouter un (donné, pas enregistré…)
function sheetPlat(p) {
  if (p) return openSheet(`<h3>${p.emoji || "🍱"} ${esc(p.nom)}</h3>
    <p class="sub">${p.n} portion${p.n > 1 ? "s" : ""} · ${p.loc === "congel" ? "❄️ congélateur" : "🧊 frigo"} · ${p.from ? "de " + esc(p.from) + " · " : ""}depuis le ${fmtDate(p.at)}
      ${p.kcalP ? ` · ${p.kcalP} kcal/portion` : ""} · à manger avant : ${dlTxt(daysLeft(platExp(p)))}</p>
    <button class="primary wide" id="eat">🍽️ J'en mange une portion</button>
    <div class="two" style="margin-top:10px"><button id="mv">${p.loc === "congel" ? "🧊 Sortir au frigo" : "❄️ Congeler"}</button><button id="pdel">🗑️ Fini / jeté</button></div>`, () => {
    $("#sheet").onclick = e => {
      if (e.target.id === "eat") { closeSheet(); eatPlat(p); }
      if (e.target.id === "mv") { p.loc = p.loc === "congel" ? "frigo" : "congel"; p.at = new Date().toISOString(); save(); closeSheet(); render(); }
      if (e.target.id === "pdel") { S.plats = S.plats.filter(x => x !== p); save(); closeSheet(); render(); }
    };
  });
  const names = allIds().map(id => getR(id));
  openSheet(`<h3>Ajouter un plat de côté</h3>
    <form id="lform" class="qform">
      <input id="ln" list="llist" placeholder="Quel plat ? (ex. lasagnes de maman)" required autocomplete="off">
      <datalist id="llist">${names.map(r => `<option value="${esc(r.nom)}">`).join("")}</datalist>
      <div class="two"><input id="lnb" type="number" inputmode="numeric" placeholder="Portions" value="1" min="1"><input id="lk" type="number" inputmode="numeric" placeholder="kcal / portion"></div>
      <input id="lf" placeholder="D'où ça vient ? (facultatif : maman, un ami…)">
      <div class="chips" id="lloc"><button type="button" data-loc="frigo" class="cur">🧊 Frigo</button><button type="button" data-loc="congel">❄️ Congélateur</button></div>
      <button class="primary wide">Ajouter</button></form>`, () => {
    let loc = "frigo"; $("#ln").focus();
    $("#ln").oninput = () => { const id = allIds().find(i => getR(i).nom === $("#ln").value); if (id) $("#lk").value = portionOf(id).kcal || ""; };
    $("#sheet").onclick = e => { const l = e.target.closest("[data-loc]"); if (l) { loc = l.dataset.loc; document.querySelectorAll("#lloc button").forEach(b => b.classList.toggle("cur", b === l)); } };
    $("#lform").onsubmit = e => {
      e.preventDefault();
      const id = allIds().find(i => getR(i).nom === $("#ln").value), r = id && getR(id);
      addPlat({ nom: $("#ln").value.trim(), emoji: r ? r.emoji : "🍱", n: +$("#lnb").value || 1, kcalP: +$("#lk").value || 0,
        protP: r ? portionOf(id).prot : 0, loc, from: $("#lf").value.trim() || null, rid: id || null });
      save(); closeSheet(); render(); buzz();
    };
  });
}

