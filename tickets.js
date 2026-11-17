// ---- Tickets de caisse : liste datée, plusieurs photos par ticket (IndexedDB), prix par article ----
// Les prix (petits) sont dans S.tickets ; les photos (lourdes) sont dans IndexedDB, rangées par id de ticket.
// Chargé après placard.js, avant app.js. Utilise S, D, $, esc, save, render, buzz, toast, openSheet, closeSheet, stopScan, fmtDate, euro, dateKey.

let TKDB = null;
function tkDB() {
  if (TKDB) return Promise.resolve(TKDB);
  return new Promise((ok, ko) => {
    const r = indexedDB.open("courses-tickets", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => ok(TKDB = r.result);
    r.onerror = () => ko(r.error);
  });
}
async function tkPhotos(id) {
  const db = await tkDB();
  return new Promise((ok, ko) => { const q = db.transaction("photos").objectStore("photos").get(id); q.onsuccess = () => ok(q.result || []); q.onerror = () => ko(q.error); });
}
async function tkSavePhotos(id, arr) {
  const db = await tkDB();
  return new Promise((ok, ko) => { const t = db.transaction("photos", "readwrite"); t.objectStore("photos").put(arr, id); t.oncomplete = () => ok(); t.onerror = () => ko(t.error); });
}
async function tkDelPhotos(id) {
  const db = await tkDB();
  return new Promise((ok, ko) => { const t = db.transaction("photos", "readwrite"); t.objectStore("photos").delete(id); t.oncomplete = () => ok(); t.onerror = () => ko(t.error); });
}

// Un article de la liste de courses : [id, nom, qté, aliment, grammes]
const itemOf = id => [...D.courses, ...(D.coursesBase || [])].flatMap(r => r.items).find(i => i[0] === id); // liste en cours, sinon liste d'origine

// Le prix au gramme retenu pour chaque aliment vient du ticket le plus récent qui le contient
function recomputePrix() {
  S.prix = {};
  for (const t of [...S.tickets].sort((a, b) => a.at.localeCompare(b.at)))
    for (const x of Object.values(t.prices)) if (x.k && x.g) S.prix[x.k] = x.p / x.g;
}

// Anciens tickets (une photo, prix par id seul) : convertis une fois au démarrage
function initTickets() {
  S.tickets ||= [];
  for (const t of S.tickets) {
    t.id ||= "t" + Date.parse(t.at || new Date().toISOString()).toString(36);
    if (t.v2) continue;
    t.prices = Object.fromEntries(Object.entries(t.prices || {}).map(([id, p]) => {
      const it = itemOf(id);
      return [id, { p: +p || 0, k: it ? it[3] : null, g: it ? it[4] : 0, nom: it ? it[1] : id }];
    }));
    if (t.photo) { tkSavePhotos(t.id, [t.photo]).catch(() => {}); delete t.photo; }
    t.nPhotos ||= 0; t.v2 = true;
  }
  recomputePrix(); save();
}

function sheetTickets() {
  const list = [...S.tickets].sort((a, b) => b.at.localeCompare(a.at));
  openSheet(`<h3>🧾 Tickets de caisse</h3>
    <button class="primary wide" id="tnew">＋ Nouveau ticket</button>
    <div class="list" style="margin-top:12px">${list.map(t => `<div class="row" data-tk="${esc(t.id)}">
        <span class="txt">${fmtDate(t.at)}<small>${Object.keys(t.prices).length} prix · ${t.nPhotos || 0} photo${t.nPhotos > 1 ? "s" : ""}</small></span>
        <span class="qty">${t.total != null ? euro(t.total) : ""}</span></div>`).join("")
      || `<p class="empty">Aucun ticket. Enregistre le premier après tes courses.</p>`}</div>`, () => {
    $("#sheet").onclick = e => {
      if (e.target.id === "tnew") return sheetTicketEdit(null);
      const r = e.target.closest("[data-tk]");
      if (r) sheetTicketEdit(S.tickets.find(t => t.id === r.dataset.tk));
    };
  });
}

async function sheetTicketEdit(t) {
  const isNew = !t;
  const T = t ? { ...t, prices: { ...t.prices } } : { id: "t" + Date.now().toString(36), at: new Date().toISOString(), prices: {}, total: null, nPhotos: 0 };
  const photos = isNew ? [] : await tkPhotos(T.id).catch(() => []);
  // Articles : ceux de la liste en cours, plus ceux déjà prix dans ce ticket (même s'ils ne sont plus dans la liste)
  const rows = D.courses.flatMap(r => r.items).filter(i => i[3]).map(i => [i[0], i[1], i[2], i[3], i[4]]);
  for (const [id, x] of Object.entries(T.prices)) if (!rows.some(r => r[0] === id)) rows.push([id, x.nom, "", x.k, x.g]);
  const thumbs = () => photos.map((src, j) => `<div class="tph-wrap"><img class="tph" data-zoom="${j}" src="${src}" alt="Photo ${j + 1}"><button class="tph-del" data-pdel="${j}" aria-label="Supprimer la photo">✕</button></div>`).join("");

  openSheet(`<h3>🧾 ${isNew ? "Nouveau ticket" : "Ticket"}</h3>
    <label class="qtyrow">Date <input id="tdate" type="date" value="${dateKey(new Date(T.at))}"></label>
    <div class="tphotos" id="tphotos">${thumbs()}</div>
    <button class="wide" id="tadd">📸 Ajouter une photo</button>
    <div id="tcam"></div>
    <p class="sub">Recopie les prix en regardant les photos (touche une photo pour l'agrandir). Chaque prix sert au coût des recettes.</p>
    <div class="list">${rows.map(([id, nom, qte, k, g]) => `<label class="row price"><span class="txt">${esc(nom)}<small>${esc(qte || "")}</small></span>
      <input type="number" inputmode="decimal" step="0.01" min="0" data-price="${esc(id)}" data-k="${esc(k || "")}" data-g="${g || 0}" data-nom="${esc(nom)}" value="${T.prices[id] ? T.prices[id].p : ""}" placeholder="€"></label>`).join("")}</div>
    <div class="calc">Total des prix saisis : <b id="tsum">0,00 €</b></div>
    <label class="qtyrow">Total du ticket <input id="ttot" type="number" inputmode="decimal" step="0.01" value="${T.total ?? ""}"> €</label>
    <div class="two">${isNew ? "" : `<button id="tdel">🗑️ Supprimer</button>`}<button class="primary" id="tok">Enregistrer</button></div>`, () => {
    const sum = () => { const s = [...document.querySelectorAll("[data-price]")].reduce((a, i) => a + (+i.value || 0), 0); $("#tsum").textContent = euro(s); };
    sum();
    $("#sheet").oninput = e => { if (e.target.dataset.price != null) sum(); };
    const redraw = () => { $("#tphotos").innerHTML = thumbs(); };
    $("#sheet").onclick = async e => {
      if (e.target.closest("#tadd")) return camInto($("#tcam"), src => { photos.push(src); redraw(); toast(`Photo ${photos.length} ajoutée`); });
      const z = e.target.closest("[data-zoom]"); if (z) return z.classList.toggle("zoom");
      const pd = e.target.closest("[data-pdel]");
      if (pd && confirm("Supprimer cette photo ?")) { photos.splice(+pd.dataset.pdel, 1); redraw(); return; }
      if (e.target.id === "tdel" && confirm("Supprimer ce ticket et ses photos ?")) {
        S.tickets = S.tickets.filter(x => x.id !== T.id); tkDelPhotos(T.id).catch(() => {});
        recomputePrix(); save(); stopScan(); closeSheet(); render(); toast("Ticket supprimé"); return;
      }
      if (e.target.id === "tok") {
        stopScan();
        const prices = {};
        for (const i of document.querySelectorAll("[data-price]")) if (i.value !== "") prices[i.dataset.price] = { p: +i.value, k: i.dataset.k || null, g: +i.dataset.g || 0, nom: i.dataset.nom };
        const d = $("#tdate").value;
        const at = d && d !== dateKey(new Date(T.at)) ? new Date(...d.split("-").map((x, j) => j === 1 ? x - 1 : +x), 12).toISOString() : T.at;
        const ticket = { id: T.id, at, prices, total: $("#ttot").value === "" ? null : +$("#ttot").value, nPhotos: photos.length, v2: true };
        await tkSavePhotos(T.id, photos).catch(() => toast("Photos non enregistrées (mémoire pleine ?)"));
        S.tickets = S.tickets.some(x => x.id === T.id) ? S.tickets.map(x => x.id === T.id ? ticket : x) : [...S.tickets, ticket];
        recomputePrix(); save(); closeSheet(); render();
        toast(`Ticket enregistré · ${Object.keys(prices).length} prix`);
      }
    };
  });
}

// ---- Caméra dans une fiche : flux vidéo + bouton « Prendre » dans box ; onPhoto reçoit l'image (JPEG, 1200 px de large au plus) ----
async function camInto(box, onPhoto) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } } });
    box.innerHTML = `<video id="cam" playsinline muted></video><button type="button" class="primary wide" id="camshot">📷 Prendre</button>`;
    const v = box.querySelector("video"); v.srcObject = stream; await v.play();
    scan = { stop: () => stream.getTracks().forEach(t => t.stop()) };
    box.querySelector("#camshot").onclick = () => {
      if (!v.videoWidth) return;
      const w = Math.min(1200, v.videoWidth), c = document.createElement("canvas");
      c.width = w; c.height = Math.round(v.videoHeight * w / v.videoWidth);
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      stopScan(); buzz(40); box.innerHTML = ""; onPhoto(c.toDataURL("image/jpeg", 0.65));
    };
  } catch { toast("Caméra indisponible"); }
}

// ---- Photos des plats terminés : même rangement que les tickets, sous la clé « cook: » + date de fin de cuisson ----
const cookKey = c => "cook:" + c.end;
// Remplit les emplacements [data-cph] (fiche recette, onglet Semaine) une fois les photos lues
function fillCookPhotos(root) {
  for (const el of root.querySelectorAll("[data-cph]"))
    tkPhotos("cook:" + el.dataset.cph).then(a => { el.innerHTML = a.map(s => `<img class="tph" src="${s}" alt="Photo du plat">`).join(""); }).catch(() => {});
}

// ---- Export : toutes les données dans un fichier JSON (Téléchargements/Courses sur le téléphone) ----
async function buildExport(withPhotos) {
  const out = { app: "courses", format: 1, exportedAt: new Date().toISOString(), semaineId: D.semaineId || null,
    etat: S, plan: D.semaine, courses: D.courses, recettes: { ...D.recettes, ...S.lib }, aliments: AL };
  if (withPhotos) {
    out.photos = {};
    for (const k of [...S.tickets.map(t => t.id), ...S.cooks.filter(c => c.nPhotos).map(cookKey)]) {
      const a = await tkPhotos(k).catch(() => []); if (a.length) out.photos[k] = a;
    }
  }
  return out;
}
async function exportData(withPhotos) {
  toast("Préparation de l'export…");
  const json = JSON.stringify(await buildExport(withPhotos), null, withPhotos ? 0 : 1);
  const name = `courses-${dateKey(new Date())}${withPhotos ? "-photos" : ""}.json`;
  if (NATIVE && NATIVE.exportBegin) {
    if (!NATIVE.exportBegin(name)) return toast("Export impossible sur ce téléphone");
    for (let i = 0; i < json.length; i += 200000) if (!NATIVE.exportWrite(json.slice(i, i + 200000))) return toast("Export interrompu (stockage plein ?)");
    return toast("Enregistré : " + NATIVE.exportEnd());
  }
  if (NATIVE) return NATIVE.share(json);
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name; a.click();
  toast("Fichier téléchargé : " + name);
}
