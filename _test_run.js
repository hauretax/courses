// Banc d'essai : chargé à la fin d'une copie d'index.html (voir _test.sh), avec un état simulé dans le localStorage.
// État de départ : un repas validé la semaine dernière (ancien format), chili cuisiné la semaine dernière,
// tarte du coloc (6 parts) et chili (2 portions) cuisinés aujourd'hui, un vieux ticket, des pommes de terre et du bœuf au placard.
window.addEventListener("load", () => {
  const out = [], q = s => document.querySelector(s), qa = s => document.querySelectorAll(s), must = (c, m) => { if (!c) throw m; };
  const T = (n, f) => { try { f(); out.push("OK   " + n); } catch (e) { out.push("FAIL " + n + " : " + (e.message || e)); } };
  const semaine = () => { S.tab = "semaine"; render(); };

  T("semaine : une carte par plat cuisiné cette semaine, pas de jour", () => {
    must(qa(".meal").length === 2, "attendu 2 cartes, vu " + qa(".meal").length);
    must(!/Samedi|Dimanche|Mardi/.test(q("#view").textContent), "un nom de jour est affiché");
    must(!/Fini/.test(q("#view").textContent), "un Fini de la semaine passée reste");
  });
  T("ancien repas archivé au journal", () => { must(S.food.some(f => /burger/i.test(f.nom) && f.kcal === 620), "burger pas archivé sous son nom : " + JSON.stringify(S.food)); must(!S.log.length, "log pas vidé"); });
  const slide = (card, v) => { const sl = card.querySelector("input[type=range]"); sl.value = v; sl.dispatchEvent(new Event("input", { bubbles: true })); };
  T("curseur : valider la moitié du chili = 1 portion au journal", () => {
    const card = qa(".meal")[0]; must(card.querySelector(".ok.off"), "Valider visible avant de bouger"); slide(card, 50);
    must(!card.querySelector(".ok.off"), "Valider reste caché"); card.querySelector("[data-ok]").click();
    must(qa(".meal").length === 2, "plat en double : " + qa(".meal").length + " cartes");
    must(S.log.length === 1 && S.log[0].to === 100, "journal : attendu 1 portion, vu " + JSON.stringify(S.log));
    must(/50 % · 550 kcal/.test(q("#view").textContent), "affichage 50 % · 550 kcal absent");
  });
  T("Tout ✓ : fini, une seule carte, puis baisser le curseur corrige le journal", () => {
    q("[data-full]").click(); must(qa(".meal").length === 2 && qa(".meal.fini").length === 1, "pas une seule carte finie");
    const tot = () => S.log.reduce((x, e) => x + e.to - e.from, 0); must(tot() === 200, "attendu 2 portions, vu " + tot());
    q("[data-edit]").click(); const card = qa(".meal")[0]; slide(card, 25); card.querySelector("[data-ok]").click();
    must(tot() === 50, "après baisse à 25 % : attendu 50, vu " + tot());
  });
  T("masquer sans déclarer, puis réafficher", () => {
    const n = qa(".meal").length, logs = S.log.length; q("[data-hide]").click();
    must(qa(".meal").length === n, "masqué dès le 1er appui, sans confirmation"); must(/Masquer/.test(q("[data-hide]").textContent), "pas de question affichée");
    q("[data-hide]").click();
    must(qa(".meal").length === n - 1, "carte toujours là"); must(S.log.length === logs, "a déclaré quelque chose");
    q("#unhide").click(); must(qa(".meal").length === n, "pas réaffichée");
  });
  T("recette faite → apparaît dans la semaine, placard débité", () => {
    const b = stockOf("boeuf"), n = qa(".meal").length; finishCook("burger"); closeSheet(); semaine();
    must(qa(".meal").length === n + 1, "burger absent de la semaine"); must(stockOf("boeuf") < b, "bœuf pas retiré du placard");
  });
  T("repas sans cuisson : journal + placard, puis cuisson sans double retrait", () => {
    const p = stockOf("pdt"); sheetDeclare("frites"); must(q("#dr").value === "frites", "pas présélectionné"); q("#dform").requestSubmit();
    must(S.log.some(e => e.rid === "frites" && !e.ck), "pas déclaré"); const p2 = stockOf("pdt"); must(p2 < p, "pdt pas retirées");
    finishCook("frites"); closeSheet(); must(stockOf("pdt") === p2, "retirées deux fois : " + p2 + " -> " + stockOf("pdt"));
  });
  T("étiquettes multiples : associations sans doublon, changement, filtre", () => {
    must(String(typesOf("poulet_four")) === "proteine" && String(typesOf("chili")) === "proteine,legumineuse,legumes" && String(typesOf("tikka")) === "proteine,legumes,feculent", "étiquettes de base");
    openCook("poulet_four");
    must(q('[data-pair="butternut_pchiches"]') && q('[data-pair="legumes_express"]') && q('[data-pair="riz_nature"]'), "légumes et féculents non proposés avec le poulet");
    must(!q('[data-pair="chili"]') && !q('[data-pair="dahl"]'), "une recette qui contient déjà une protéine est proposée avec le poulet");
    openCook("chili"); must(q('[data-pair="riz_nature"]') && q('[data-pair="legumes_express"]'), "avec le chili : riz facultatif ou légumes en plus");
    must(!q('[data-pair="butternut_pchiches"]') && !q('[data-pair="poulet_four"]'), "avec le chili : pas de doublon de légumineuse ni de viande");
    openCook("legumes_express"); must(q('[data-pair="poulet_four"]') && !q('[data-pair="chili"]'), "avec des légumes seuls : une protéine sans légumes");
    openCook("tikka"); must(!q("[data-pair]"), "un plat qui a tout ne doit rien proposer");
    openCook("riz_nature"); q("#ctype").click(); q('[data-settype="legumes"]').click(); q("#typeok").click();
    must(String(typesOf("riz_nature")) === "legumes,feculent", "étiquettes non changées : " + typesOf("riz_nature"));
    delete S.types.riz_nature; closeCook();
    S.tab = "recettes"; render(); must(q("#newrec"), "bouton d'ajout de recette absent"); q('[data-t="legumineuse"]').click();
    const noms = [...qa("#libl .card b")].map(b => b.textContent); must(noms.length === 3 && noms.some(n => /Chili/.test(n)) && noms.some(n => /Dahl/.test(n)) && noms.some(n => /Butternut/.test(n)), "filtre légumineuse : " + noms.join(", "));
    q('[data-t="legumineuse"]').click(); semaine();
  });
  T("ajouter une recette depuis l'onglet Recettes", () => {
    openRecipeForm(); must(q("#plan.open #rsave"), "formulaire absent"); P.rec.nom = "Plat de papa"; P.rec.types = ["legumes"]; saveRecipe();
    must(!q("#plan.open"), "le formulaire ne se ferme pas"); const id = Object.keys(S.lib).find(k => S.lib[k].nom === "Plat de papa"); must(id && String(typesOf(id)) === "legumes", "recette ou étiquette non enregistrée");
    delete S.lib[id];
  });
  T("plan de la semaine : équilibré sur 15 repas, aliments connus", () => {
    const c = coverage(D.semaine); must(c.prot >= 15 && c.legumes >= 15 && c.viande >= 10 && c.legumineuse >= 5 && c.feculent >= 1, "couverture : " + JSON.stringify(c));
    for (const id of new Set(D.semaine.map(d => d.recette))) {
      const r = getR(id), n = D.semaine.filter(d => d.recette === id).length; must(r, "recette absente : " + id);
      must(n % r.n === 0, id + " : " + n + " portions prévues pour des fournées de " + r.n);
      for (const g of r.ingredients.map(normIng)) if (!g.free) { must(AL[g.k], id + " : aliment inconnu " + g.k); must(gramsOf(g) > 0, id + " : quantité nulle pour " + g.k); }
    }
    const repas = [["poulet_four", "butternut_pchiches"], ["chili", "riz_nature"], ["chili", "legumes_express"], ["dahl"]].map(l => l.reduce((a, id) => ({ k: a.k + getR(id).kcal, p: a.p + getR(id).prot }), { k: 0, p: 0 }));
    for (const m of repas) must(m.k >= 450 && m.k <= 750 && m.p >= 40, "repas hors cible : " + JSON.stringify(repas));
  });
  T("courses : « déjà au placard » retire l'article et l'ajoute au placard, annulable", () => {
    S.tab = "courses"; S.ctab = "liste"; render();
    const n = qa(".row[data-id]").length, row = q(".row[data-id]"), id = row.dataset.id, k = id.replace("g_", ""), st = stockOf(k); must(n > 5, "liste vide");
    must(!q("[data-have]"), "il reste un bouton placard par article (risque d'appui par accident)");
    row.click(); must(S.checked[id] && stockOf(k) === st, "hors mode placard, toucher un article doit seulement le cocher"); q('.row[data-id="' + id + '"]').click();
    q("#havemode").click(); must(/Mode placard/.test(q("#view").textContent) && !q("#ranger"), "mode placard non affiché");
    q('.row[data-id="' + id + '"]').click(); must(qa(".row[data-id]").length === n - 1 && !q('.row[data-id="' + id + '"]'), "article toujours dans la liste");
    must(stockOf(k) > st, "rien ajouté au placard pour " + k); must(/1 article déjà au placard/.test(q("#view").textContent), "rappel absent");
    q("#havemode").click(); must(!/Mode placard/.test(q("#view").textContent) && q("#ranger"), "sortie du mode placard");
    q("#unhave").click(); must(qa(".row[data-id]").length === n && stockOf(k) === st, "annulation incomplète");
    semaine();
  });
  T("remise à zéro : courses et placard vidés, seul le poulet tikka de côté reste", () => {
    must(S.resetId === D.reset && S.pantry.length, "la remise à zéro s'est rejouée alors qu'elle était déjà appliquée");
    const sauve = JSON.stringify(S);
    S.plats = [{ id: "a", nom: "Chili con carne", n: 2, rid: "chili", loc: "congel", at: new Date().toISOString() }, { id: "b", nom: "Lasagnes", n: 1, loc: "frigo", at: new Date().toISOString() }];
    S.checked = { g_riz: true }; S.extras = [{ id: "x1", nom: "Sel", rayon: "Divers" }]; S.have = { g_skyr: "p9" };
    resetStock(D.resetGarde, D.resetAjoute);
    must(!S.pantry.length && !S.extras.length && !Object.keys(S.checked).length && !Object.keys(S.have).length, "placard ou liste non vidés");
    must(S.plats.length === 1 && S.plats[0].rid === "tikka" && S.plats[0].n === 1 && S.plats[0].kcalP === 520, "plats de côté : " + JSON.stringify(S.plats));
    S.plats[0].n = 3; resetStock(D.resetGarde, D.resetAjoute); must(S.plats.length === 1 && S.plats[0].n === 3, "un tikka déjà noté doit être gardé tel quel, sans doublon");
    must(S.plan.courses.flatMap(r => r.items).some(i => i[0] === "g_boeuf" && i[4] === 750), "courses non recalculées sans le stock");
    Object.assign(S, JSON.parse(sauve)); applyPlan();
  });
  T("plat de côté : visible dans la semaine, une portion mangée part au journal", () => {
    S.plats = [{ id: "pc1", nom: "Chili d'avant", emoji: "🌶️", n: 2, kcalP: 550, protP: 45, rid: "zz_ancien", loc: "congel", at: new Date().toISOString() }];
    const f = S.food.length; semaine(); const b = q('[data-eatplat="pc1"]'); must(b, "le plat de côté n'apparaît pas dans la semaine");
    b.click(); must(S.plats[0].n === 1 && S.food.length === f + 1 && S.food[f].kcal === 550, "portion non comptée");
    q('[data-eatplat="pc1"]').click(); must(!S.plats.length && !q("[data-eatplat]"), "le plat fini reste affiché");
    const c = S.cooks[S.cooks.length - 1]; S.plats = [{ id: "pc2", nom: "x", n: 1, rid: c.id, loc: "frigo", at: c.end }]; semaine();
    must(!q('[data-eatplat="pc2"]'), "un plat cuisiné cette semaine apparaît deux fois (carte + plat de côté)"); S.plats = [];
  });
  T("plats de côté corrigés : le chili reste ou est recréé, le tikka part, le placard n'est pas touché", () => {
    const sauve = JSON.stringify(S), stock = S.pantry.length; must(stock, "placard de test vide");
    S.plats = [{ id: "t", nom: "Poulet tikka masala light", n: 1, rid: "tikka", loc: "congel", at: new Date().toISOString() }];
    fixPlats(D.platsFix.garde, D.platsFix.ajoute);
    must(S.plats.length === 1 && S.plats[0].rid === "chili" && S.plats[0].kcalP === 550 && S.plats[0].loc === "congel", "attendu le chili seul : " + JSON.stringify(S.plats));
    must(S.pantry.length === stock, "le placard a été vidé");
    S.plats[0].n = 3; fixPlats(D.platsFix.garde, D.platsFix.ajoute); must(S.plats.length === 1 && S.plats[0].n === 3, "un chili déjà noté doit rester tel quel");
    Object.assign(S, JSON.parse(sauve));
  });
  T("remise à zéro d'une journée : le journal de ce jour est vidé, les autres jours restent", () => {
    const sauve = JSON.stringify(S), auj = dateKey(new Date()), hier = new Date(Date.now() - 864e5).toISOString(), now = new Date().toISOString();
    S.food = [{ nom: "a", kcal: 100, prot: 1, meal: "diner", at: now }, { nom: "b", kcal: 200, prot: 2, meal: "diner", at: hier }];
    S.log = [{ rid: "chili", from: 0, to: 100, at: now }, { rid: "chili", from: 0, to: 100, at: hier }];
    const cuissons = S.cooks.length; resetDay(auj);
    must(dayTotals(auj).k === 0, "il reste des kcal aujourd'hui : " + dayTotals(auj).k);
    must(S.food.length === 1 && S.log.length === 1 && dayTotals(dateKey(new Date(hier))).k > 0, "la veille a été touchée");
    must(S.cooks.length === cuissons, "des cuissons ont été effacées");
    Object.assign(S, JSON.parse(sauve));
  });
  T("portions : pas dans le nom, réglables dans la fiche, quantités et coût qui suivent", () => {
    for (const id of allIds()) must(!/\(\d+ portion/.test(getR(id).nom), "portions dans le nom : " + getR(id).nom);
    must(getR("legumes_express").n === 5, "légumes mijotés : attendu 5 portions par défaut");
    S.tab = "recettes"; render();
    must(/5 portions prévues/.test(q('.card[data-r="poulet_four"]').textContent), "portions prévues absentes de la carte du poulet");
    must(/3 portions prévues \(recette pour 1\)/.test(q('.card[data-r="riz_nature"]').textContent), "riz : " + q('.card[data-r="riz_nature"]').textContent);
    must(/pour 2 portions/.test(q('#libl .card[data-r="tikka"]').textContent), "recette hors plan : portions de la recette absentes");
    delete S.sess.poulet_four; openCook("poulet_four");
    must(/5 portions/.test(q("#cook .portst").textContent) && /900 g/.test(q("#cook .row.ing").textContent), "par défaut : 5 portions, 900 g de poulet");
    const kcal = q("#cook .sumbox b").textContent;
    q('[data-por="-1"]').click(); q('[data-por="-1"]').click();
    must(/3 portions/.test(q("#cook .portst").textContent) && /540 g/.test(q("#cook .row.ing").textContent), "à 3 portions : attendu 540 g, vu " + q("#cook .row.ing").textContent);
    must(q("#cook .sumbox b").textContent === kcal, "les kcal par portion ne doivent pas changer avec le nombre de portions");
    must(!/au lieu de/.test(q("#cook .row.ing").textContent), "une quantité mise à l'échelle est signalée comme modifiée");
    const p = stockOf("poulet"); S.pantry.push({ id: "px", k: "poulet", q: 1000, u: "g", loc: "frigo" }); finishCook("poulet_four"); closeSheet();
    const c = S.cooks[S.cooks.length - 1]; must(c.n === 3 && Math.round(p + 1000 - stockOf("poulet")) === 540, "cuisson : " + c.n + " portions, " + (p + 1000 - stockOf("poulet")) + " g retirés du placard");
    S.cooks.pop(); S.pantry = S.pantry.filter(x => x.id !== "px"); semaine();
  });
  T("ticket converti + prix", () => must(S.tickets[0].v2 && S.prix.boeuf, "conversion ticket"));
  T("liste des tickets", () => { sheetTickets(); must(q("[data-tk]"), "pas de ligne"); closeSheet(); });
  T("journal : repas du jour + édition", () => {
    S.tab = "journal"; render(); const en = q("[data-entry]"); must(en, "aucune entrée");
    sheetEditEntry(en.dataset.entry); must(q("#eok,#fform"), "fiche vide"); closeSheet();
  });
  T("calendrier", () => {
    q(".ringcard").click(); must(qa(".cal-day").length >= 28, "grille"); must(q(".cal-part,.cal-ok"), "aucun jour coloré");
    q(".cal-day").click(); must(J.view === "day", "retour jour");
  });
  T("fiche recette + coût", () => { openCook("chili"); must(q("#finish") && q(".costbox"), "bouton ou coût absent"); closeCook(); });
  T("planificateur + nouvelle recette", () => {
    openPlanner(); must(qa("[data-pit]").length === 6, "une ligne par plat cuisiné"); must(/Légumes 20 \/ 15 ✓/.test(q("#pcover").textContent), "couverture des légumes absente : " + q("#pcover").textContent);
    const pn = qa("[data-pn]")[2]; pn.value = 0; // on retire le chili : les légumes baissent pn.dispatchEvent(new Event("input", { bubbles: true })); must(/Légumes 15 \/ 15 ✓/.test(q("#pcover").textContent), "la couverture ne suit pas : " + q("#pcover").textContent);
    pn.value = 5; pn.dispatchEvent(new Event("input", { bubbles: true }));
    P.rec = newRec(); P.rec.nom = "Test"; P.rec.n = 1; P.rec.ings[0] = { name: "riz", q: "200", u: "g" }; P.view = "recipe"; drawRecipe(); saveRecipe();
    must(Object.values(S.lib).some(r => r.nom === "Test" && r.kcal === 710), "recette non créée ou kcal faux");
  });
  T("courses générées", () => {
    const all = buildCourses(D.semaine).flatMap(r => r.items); must(all.length, "vide");
    must(all.some(i => i[0] === "g_lentc" && i[4] === 400), "lentilles corail : attendu 400 g"); must(all.some(i => i[0] === "g_skyr"), "skyr des petits-déj absent");
    must(!all.some(i => i[0] === "g_pdt"), "pommes de terre dans la liste alors qu'il y en a assez au placard");
  });
  T("plat déjà de côté : pas racheté", () => {
    const sem = [{ recette: "chili" }, { recette: "chili" }], keep = S.plats, k = curIngs("chili", true).find(g => g.k && !g.free).k;
    const qty = () => (buildCourses(sem).flatMap(r => r.items).find(i => i[3] === k) || [])[4] || 0;
    S.plats = []; const sans = qty(); must(sans > 0, `ingrédient ${k} du chili absent sans plat de côté`);
    S.plats = [{ id: "t1", rid: "chili", nom: "Chili", n: 2, loc: "congel", at: new Date().toISOString() }];
    must(qty() === 0, `${k} encore à acheter alors que 2 portions de chili sont au congélateur`);
    S.plats = [{ id: "t2", nom: getR("chili").nom, n: 2, loc: "frigo", at: new Date().toISOString() }]; // plat ajouté à la main, sans rid
    must(qty() === 0, "plat de côté reconnu par son nom ignoré");
    S.plats = keep;
  });
  T("nouvelle semaine", () => {
    window.confirm = () => true; startFromPlan(); must(S.plan && !S.log.length && D.courses.length, "plan non appliqué");
    for (const t of ["courses", "semaine", "recettes", "journal"]) { S.tab = t; render(); }
  });
  T("nouvel aliment", () => { openNewAliment("Mirabelle", () => {}); q("#nk").value = 60; q("#nform").requestSubmit(); must(alimKey("Mirabelle"), "non créé"); });
  T("placard", () => { S.tab = "courses"; S.ctab = "placard"; render(); sheetProduit(null, "frigo"); must(q("#pnew"), "lien aliment absent"); closeSheet(); });
  // Vérifications asynchrones (IndexedDB) : photos d'un plat et export
  document.body.insertAdjacentHTML("beforeend", "<pre id=res></pre>");
  const show = () => { document.querySelector("#res").textContent = out.join(String.fromCharCode(10)); };
  show(); // les résultats synchrones restent visibles même si la suite asynchrone ne finit pas
  // IndexedDB ne répond pas dans Edge sans écran (fichier local, temps virtuel) : on le remplace ici par une mémoire.
  // Le rangement réel des photos sur le téléphone n'est donc PAS couvert par ce banc d'essai.
  const mem = {}; tkPhotos = async k => mem[k] || []; tkSavePhotos = async (k, a) => { mem[k] = a; }; tkDelPhotos = async k => { delete mem[k]; };
  (async () => {
    const A = async (n, f) => { try { await f(); out.push("OK   " + n); } catch (e) { out.push("FAIL " + n + " : " + (e.message || e)); } show(); };
    await A("photo d'un plat : rangée, relue, affichée dans la fiche et dans la semaine", async () => {
      finishCook("riz_nature"); closeSheet(); // une cuisson de cette semaine (la « nouvelle semaine » du test vient de démarrer)
      const c = S.cooks[S.cooks.length - 1]; c.nPhotos = 1; await tkSavePhotos(cookKey(c), ["data:image/gif;base64,R0lGODlhAQABAAAAACw="]);
      must((await tkPhotos(cookKey(c))).length === 1, "photo non relue");
      const wait = () => new Promise(r => setTimeout(r, 300));
      openCook(c.id); await wait(); must(q("#cook .cph img"), "photo absente de la fiche recette"); closeCook();
      delete S.hide; semaine(); await wait(); must(q("#view .cph img"), "photo absente de la carte du plat");
    });
    await A("export JSON : état, recettes, photos", async () => {
      const o = JSON.parse(JSON.stringify(await buildExport(true)));
      must(o.etat.cooks.length && o.recettes.chili && o.aliments.riz && o.plan.length === D.semaine.length, "contenu incomplet");
      must(Object.keys(o.photos).some(k => k.startsWith("cook:")), "photos absentes de l'export");
      must(!(await buildExport(false)).photos, "photos présentes dans l'export sans photos");
    });
    // ---- En ligne (cloud.js) : le banc d'essai coupe le réseau (_test.sh), on vérifie ce qui se passe dans l'appli ----
    await A("réglages : objectifs personnels, résumé envoyé à l'assistant", async () => {
      must(/^[a-z0-9]{26}$/.test(UID), "code personnel absent");
      q("#gear").click(); must(q("#gk") && q("#sassist") && q("#sdata"), "fiche réglages incomplète");
      q("#gk").value = 2300; q("#gsave").click(); must(D.kcalJour === 2300 && S.cfg.kcalJour === 2300, "objectif non enregistré");
      S.tab = "journal"; render(); must(/2300/.test(q("#view").textContent), "objectif absent du journal");
      const v = JSON.parse(JSON.stringify(buildView()));
      must(v.goals.kcal_par_jour === 2300 && v.week.prevu.length && v.journal.length && Array.isArray(v.pantry) && v.shopping.length, "résumé incomplet : " + Object.keys(v));
      must(!S.sync, "la synchro ne doit pas être active sans accord");
      sheetAssistant(); must(q("#aon") && !q("#murl"), "le lien ne doit apparaître qu'après activation"); closeSheet();
      sheetData(); must(q("#dimp") && q("#dcode"), "fiche données incomplète"); closeSheet();
    });
    await A("assistant : recette, objectifs, repas et semaine proposée arrivent dans l'appli", async () => {
      const rec = { nom: "Tofu brocoli", emoji: "🥦", n: 2, temps: "20 min", types: ["proteine", "legumes"], kcal: 200, prot: 20,
        ingredients: [[200, "g", "atofu"], [300, "g", "brocoli"], "sel"], etapes: ["Dore le tofu."], alim: { atofu: { n: "tofu ferme", k: 140, p: 15, loc: "frigo", e: "🧊", ray: "Crèmerie et frais" } } };
      handleInbox([{ id: 1, kind: "recipe", data: { id: "rbot1", recipe: rec } }, { id: 2, kind: "goals", data: { protJour: 150 } },
        { id: 3, kind: "food", data: { nom: "Kebab", kcal: 800, prot: 35, meal: null, at: new Date().toISOString() } },
        { id: 4, kind: "week", data: { items: [{ recette: "rbot1", n: 4 }, { recette: "chili", n: 5 }, { recette: "inconnue", n: 2 }], goal: 9, note: "Semaine test" } }]);
      must(S.lib.rbot1 && AL.atofu && S.alim.atofu, "recette ou aliment non reçus");
      must(D.protJour === 150 && D.kcalJour === 2300, "objectifs : " + D.kcalJour + " / " + D.protJour);
      must(S.food.some(f => f.nom === "Kebab" && f.meal), "repas absent du journal");
      must(S.acks.length === 4, "accusés de réception : " + S.acks);
      must(S.proposal && q("#pgo2") && /Semaine test/.test(q("#sheet").textContent), "proposition non affichée");
      q("#plater").click(); must(S.proposal, "« Plus tard » ne doit pas effacer la proposition");
      showProposal(); q("#pgo2").click();
      must(!S.proposal && D.semaine.length === 9 && S.goal === 9, "semaine non lancée : " + D.semaine.length);
      must(D.courses.flatMap(r => r.items).some(i => i[0] === "g_atofu" && i[4] === 400), "courses : tofu absent ou mal compté");
    });
    await A("recettes de la communauté : visibles, filtrables, partage réservé aux siennes", async () => {
      setCatalog({ pubx: { nom: "Gratin partagé", emoji: "🧀", n: 2, temps: "30 min", kcal: 400, prot: 20, ingredients: [[300, "g", "pdt"]], etapes: ["Cuire."] }, chili: { nom: "Faux chili", ingredients: [], etapes: [] } });
      must(getR("pubx") && allIds().includes("pubx") && getR("chili").nom !== "Faux chili", "catalogue mal fusionné");
      S.tab = "recettes"; render(); q('[data-f="pub"]').click();
      must(qa("#libl .card").length === 1 && /Gratin partagé/.test(q("#libl").textContent), "filtre communauté : " + qa("#libl .card").length);
      q('[data-f="miennes"]').click(); must(/Tofu brocoli/.test(q("#libl").textContent) && !/Gratin/.test(q("#libl").textContent), "filtre « les miennes »");
      R.f = "toutes";
      openCook("pubx"); must(!q("#cpub") && /communauté/.test(q("#cook").textContent), "recette d'un autre : pas de bouton de partage"); closeCook();
      openCook("rbot1"); must(q("#cpub"), "ma recette : bouton de partage absent"); closeCook();
      openCook("chili"); must(!q("#cpub"), "recette de base : pas de partage"); closeCook();
      openRecipeForm(); must(q('[data-rf="pub"]'), "case « partager » absente du formulaire"); closePlan();
    });
    out.push("FIN"); show();
  })();
});
