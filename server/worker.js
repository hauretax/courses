// Serveur de « Courses & recettes » : un Worker Cloudflare + une base D1.
//  - /api/recipes : catalogue public de recettes (lecture libre, écriture avec le code personnel de l'appli)
//  - /api/sync    : copie des données d'une personne, seulement si elle a activé « Connecter un assistant »
//  - /mcp/<code>  : serveur MCP (Claude, ChatGPT…) qui lit cette copie et dépose des propositions pour l'appli
// Tout le reste (l'appli elle-même) est servi comme fichiers statiques.
import "./shim.js";
import "../data.js";
import "../recettes.js";

const DATA = globalThis.DATA;
const AL = DATA.aliments;
const UNITS = ["g", "pc", "cc", "cs"], UNIT_G = { cc: 3, cs: 15 };
const TYPES = ["proteine", "legumineuse", "legumes", "feculent", "dessert"];
const LOCS = ["frigo", "congel", "placard", "epices"];
const RAYS = ["Viande et poisson", "Fruits et légumes", "Crèmerie et frais", "Épicerie", "Surgelés", "Épices", "Divers"];
const MEALS = ["petitdej", "dejeuner", "collation", "diner"];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type,accept,mcp-session-id,mcp-protocol-version",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-max-age": "86400"
};
const json = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...h } });
const fail = (status, error) => json({ error }, status);
const uidOk = u => /^[a-z0-9]{20,40}$/.test(u || "");
const str = (x, n) => String(x ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, n);
const rid = p => p + Date.now().toString(36) + [...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(36)).join("").slice(0, 5);
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const bearer = req => (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
async function readBody(req, max) {
  const t = await req.text();
  if (t.length > max) throw new Error("trop volumineux");
  return JSON.parse(t);
}

// ---------- Recettes : nettoyage et calculs ----------
function cleanAlim(a) {
  const n = str(a && a.n, 60); if (!n) throw new Error("aliment sans nom");
  const num = (x, max) => Math.min(max, Math.max(0, +x || 0));
  const np = str(a.np, 60), pc = num(a.pc, 5000);
  return { n, ...(np ? { np } : {}), k: num(a.k, 900), p: num(a.p, 100), ...(pc ? { pc } : {}),
    loc: LOCS.includes(a.loc) ? a.loc : "placard", e: str(a.e, 8) || "🍽️", ray: RAYS.includes(a.ray) ? a.ray : "Divers" };
}
// Valeurs d'une portion, calculées depuis les ingrédients (mêmes règles que l'appli)
function nutrition(r, extra = {}) {
  let k = 0, p = 0;
  for (const g of r.ingredients) if (Array.isArray(g)) {
    const a = AL[g[2]] || extra[g[2]] || {}, w = g[1] === "g" ? g[0] : g[1] === "pc" ? g[0] * (a.pc || 0) : g[0] * UNIT_G[g[1]];
    k += w * (a.k || 0) / 100; p += w * (a.p || 0) / 100;
  }
  const n = r.n || 1;
  return { kcal: Math.round(k / n / 10) * 10, prot: Math.round(p / n) };
}
// Une recette reçue de l'extérieur : on ne garde que les champs connus, bornés. known = aliments personnels déjà connus.
function cleanRecipe(r, known = {}) {
  if (!r || typeof r !== "object") throw new Error("recette invalide");
  const nom = str(r.nom, 120); if (!nom) throw new Error("il manque le nom de la recette");
  const n = Math.min(50, Math.max(1, Math.round(+r.n || 1)));
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).slice(0, 60).map(g => {
    if (typeof g === "string") return str(g, 200) || null;
    if (Array.isArray(g) && +g[0] > 0 && UNITS.includes(g[1]) && typeof g[2] === "string") return [Math.round(+g[0] * 100) / 100, g[1], str(g[2], 40)];
    return null;
  }).filter(Boolean);
  const etapes = (Array.isArray(r.etapes) ? r.etapes : []).slice(0, 40).map(e => {
    if (typeof e === "string") return str(e, 1500) || null;
    const t = e && str(e.t, 1500); if (!t) return null;
    return +e.min > 0 ? { t, min: Math.min(600, Math.round(+e.min)) } : t;
  }).filter(Boolean);
  if (!ingredients.length || !etapes.length) throw new Error("il faut au moins un ingrédient et une étape");
  const alim = {};
  for (const g of ingredients) if (Array.isArray(g) && !AL[g[2]]) {
    const a = (r.alim || {})[g[2]] || known[g[2]];
    if (!a) throw new Error(`aliment inconnu : ${g[2]}`);
    alim[g[2]] = cleanAlim(a);
  }
  const types = [...new Set((Array.isArray(r.types) ? r.types : []).filter(t => TYPES.includes(t)))];
  const out = { nom, emoji: str(r.emoji, 8) || "🍽️", n, portions: `${n} portion${n > 1 ? "s" : ""}`, temps: str(r.temps, 40) || "—",
    ...(types.length ? { types } : {}), ingredients, etapes, ...(Object.keys(alim).length ? { alim } : {}) };
  if (/^https:\/\/[^\s"<>]{4,300}$/.test(r.lien || "")) out.lien = r.lien;
  Object.assign(out, nutrition(out, alim));
  out.macros = `${out.kcal} kcal · ${out.prot} g prot. / portion`;
  return out;
}
const baseRecipes = (() => {
  let cache;
  return () => cache ||= Object.fromEntries(Object.entries(DATA.recettes).map(([id, r]) => [id, r.kcal == null ? { ...r, ...nutrition(r) } : r]));
})();
async function publicRecipes(env) {
  const { results } = await env.DB.prepare("SELECT id, data FROM recipes WHERE hidden = 0 ORDER BY created DESC LIMIT 2000").all();
  return Object.fromEntries(results.map(x => [x.id, JSON.parse(x.data)]));
}
// Publie (ou met à jour) une recette dans le catalogue public. Renvoie une erreur lisible si c'est refusé.
async function publish(env, uh, ip, id, recipe) {
  if (!/^[a-z0-9_]{3,40}$/.test(id) || DATA.recettes[id]) throw new Error("identifiant de recette invalide");
  const now = Date.now(), old = await env.DB.prepare("SELECT author FROM recipes WHERE id = ?").bind(id).first();
  if (old && old.author !== uh) throw new Error("cette recette appartient à quelqu'un d'autre");
  if (!old) {
    const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM recipes WHERE (author = ? OR ip = ?) AND created > ?").bind(uh, ip, now - 864e5).first();
    if (c.n >= 20) throw new Error("trop de recettes publiées aujourd'hui, réessaie demain");
  }
  await env.DB.prepare(`INSERT INTO recipes (id, author, ip, nom, data, created, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
    ON CONFLICT(id) DO UPDATE SET nom = ?4, data = ?5, updated = ?6`).bind(id, uh, ip, recipe.nom, JSON.stringify(recipe), now).run();
}

// ---------- API de l'appli ----------
async function api(req, env, path) {
  const m = req.method, uid = bearer(req), ip = await sha("ip:" + (req.headers.get("cf-connecting-ip") || ""));
  if (path === "/api/recipes" && m === "GET") return json({ recipes: await publicRecipes(env) }, 200, { "cache-control": "public, max-age=30" });

  if (path === "/api/recipes" && m === "POST") {
    if (!uidOk(uid)) return fail(401, "code personnel manquant");
    const b = await readBody(req, 40000);
    try { const r = cleanRecipe(b.recipe); await publish(env, await sha(uid), ip, str(b.id, 40), r); return json({ ok: true, id: b.id, recipe: r }); }
    catch (e) { return fail(400, e.message); }
  }
  const del = path.match(/^\/api\/recipes\/([a-z0-9_]{3,40})$/);
  if (del && m === "DELETE") {
    const admin = env.ADMIN && uid === env.ADMIN;
    if (!admin && !uidOk(uid)) return fail(401, "code personnel manquant");
    const q = admin ? env.DB.prepare("DELETE FROM recipes WHERE id = ?").bind(del[1])
      : env.DB.prepare("DELETE FROM recipes WHERE id = ? AND author = ?").bind(del[1], await sha(uid));
    const r = await q.run();
    return r.meta.changes ? json({ ok: true }) : fail(404, "recette introuvable ou pas la tienne");
  }

  // Lecture légère de ce que l'assistant a déposé (au retour dans l'appli, ou bouton 🔄) : rien n'est écrit,
  // l'accusé de réception part avec la synchro suivante (PUT /api/sync)
  if (path === "/api/inbox" && m === "GET") {
    if (!uidOk(uid)) return fail(401, "code personnel manquant");
    const { results } = await env.DB.prepare("SELECT id, kind, data FROM inbox WHERE uh = ? ORDER BY id LIMIT 50").bind(await sha(uid)).all();
    return json({ inbox: results.map(x => ({ id: x.id, kind: x.kind, data: JSON.parse(x.data) })) }, 200, { "cache-control": "no-store" });
  }

  if (path === "/api/sync") {
    if (!uidOk(uid)) return fail(401, "code personnel manquant");
    const uh = await sha(uid);
    if (m === "GET") { // restauration sur un autre appareil
      const u = await env.DB.prepare("SELECT backup, updated FROM users WHERE uh = ?").bind(uh).first();
      return u ? json({ backup: JSON.parse(u.backup || "null"), updated: u.updated }) : fail(404, "aucune donnée pour ce code");
    }
    if (m === "DELETE") {
      await env.DB.batch([env.DB.prepare("DELETE FROM users WHERE uh = ?").bind(uh), env.DB.prepare("DELETE FROM inbox WHERE uh = ?").bind(uh)]);
      return json({ ok: true });
    }
    if (m === "PUT") {
      const b = await readBody(req, 1_500_000), ack = (Array.isArray(b.ack) ? b.ack : []).map(Number).filter(Number.isInteger).slice(0, 100);
      const st = [env.DB.prepare(`INSERT INTO users (uh, view, backup, updated) VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(uh) DO UPDATE SET view = ?2, backup = ?3, updated = ?4`).bind(uh, JSON.stringify(b.view || {}), JSON.stringify(b.backup || null), Date.now())];
      if (ack.length) st.push(env.DB.prepare(`DELETE FROM inbox WHERE uh = ? AND id IN (${ack.map(() => "?").join(",")})`).bind(uh, ...ack));
      await env.DB.batch(st);
      const { results } = await env.DB.prepare("SELECT id, kind, data FROM inbox WHERE uh = ? ORDER BY id LIMIT 50").bind(uh).all();
      return json({ ok: true, inbox: results.map(x => ({ id: x.id, kind: x.kind, data: JSON.parse(x.data) })) });
    }
  }
  return fail(404, "inconnu");
}

// ---------- MCP ----------
const INSTRUCTIONS = `Tu es relié à l'appli « Courses & recettes » d'une personne : liste de courses, recettes avec mode cuisine, placard, journal des calories et protéines.
Tu lis une copie de ses données, envoyée par son appli (get_profile indique de quand elle date). Ce que tu écris (recette, semaine proposée, objectifs, aliment mangé) arrive dans son appli à sa prochaine ouverture ; une semaine proposée n'est lancée que si la personne l'accepte dans l'appli.
Pour préparer une semaine : get_profile (objectifs, goûts, notes), get_pantry (ce qu'il y a déjà, à utiliser d'abord), search_recipes, puis propose_week. S'il manque une recette, crée-la avec create_recipe (après list_foods pour utiliser les aliments connus : c'est ce qui permet le calcul des calories et la liste de courses).
Un repas équilibré = une source de protéines + des légumes ; le féculent est facultatif. Les gens cuisinent souvent en grosses fournées : mieux vaut 3 ou 4 plats en plusieurs portions que 14 plats différents, sauf demande contraire. Parle français.`;

const P = (type, description, extra = {}) => ({ type, description, ...extra });
const TOOLS = [
  { name: "get_profile", description: "Objectifs quotidiens (kcal, protéines), nombre de repas à couvrir par semaine, recettes favorites, notes et commentaires laissés sur les plats cuisinés, date de la dernière synchronisation.", inputSchema: { type: "object", properties: {} } },
  { name: "get_journal", description: "Ce que la personne a mangé : total kcal et protéines par jour, avec le détail des repas.", inputSchema: { type: "object", properties: { days: P("integer", "Nombre de jours en arrière (défaut 7, max 60)") } } },
  { name: "get_pantry", description: "Contenu du placard, du frigo et du congélateur (avec les dates limites) et les portions de plats déjà cuisinés mises de côté.", inputSchema: { type: "object", properties: {} } },
  { name: "get_week", description: "La semaine en cours : plats prévus et portions, plats déjà cuisinés et part mangée, liste de courses restante.", inputSchema: { type: "object", properties: {} } },
  { name: "search_recipes", description: "Cherche dans les recettes disponibles : recettes de base de l'appli, recettes partagées par la communauté et recettes personnelles. Renvoie un résumé (id, nom, étiquettes, portions, temps, kcal et protéines par portion, note personnelle).",
    inputSchema: { type: "object", properties: { query: P("string", "Mots à chercher dans le nom ou les ingrédients"), type: P("string", "Étiquette", { enum: TYPES }), max_kcal: P("number", "kcal max par portion"), min_prot: P("number", "Protéines min par portion (g)"), limit: P("integer", "Défaut 40") } } },
  { name: "get_recipe", description: "Une recette complète : ingrédients, étapes, valeurs par portion.", inputSchema: { type: "object", properties: { id: P("string", "Identifiant de la recette") }, required: ["id"] } },
  { name: "list_foods", description: "Les aliments connus de l'appli (clé, nom, kcal et protéines pour 100 g, poids d'une pièce). À consulter avant create_recipe.", inputSchema: { type: "object", properties: { query: P("string", "Filtre sur le nom") } } },
  { name: "create_recipe", description: "Ajoute une recette aux recettes de la personne (visible dans son appli à la prochaine ouverture). Les kcal et protéines sont calculés depuis les ingrédients. Renvoie l'id, utilisable aussitôt dans propose_week.",
    inputSchema: { type: "object", required: ["name", "servings", "ingredients", "steps"], properties: {
      name: P("string", "Nom de la recette"), emoji: P("string", "Un emoji"), servings: P("integer", "Nombre de portions"), time: P("string", "Durée, ex. « 30 min »"),
      types: P("array", "Ce qu'apporte le plat", { items: { type: "string", enum: TYPES } }),
      ingredients: P("array", "Ingrédients", { items: { type: "object", required: ["food"], properties: {
        food: P("string", "Clé ou nom d'un aliment connu (list_foods), nom d'un aliment de new_foods, ou texte libre si qty est absent (ex. « sel, poivre »)"),
        qty: P("number", "Quantité"), unit: P("string", "g, pc (pièce), cc (c. à café), cs (c. à soupe)", { enum: UNITS }) } } }),
      steps: P("array", "Étapes, dans l'ordre", { items: { type: "object", required: ["text"], properties: { text: P("string", "Ce qu'il faut faire, avec les signes de cuisson à surveiller"), timer_min: P("number", "Minuteur en minutes, si utile") } } }),
      new_foods: P("array", "Aliments absents de list_foods", { items: { type: "object", required: ["name", "kcal_100g", "prot_100g"], properties: {
        name: P("string", "Nom au singulier"), plural: P("string", "Pluriel"), kcal_100g: P("number", ""), prot_100g: P("number", ""), piece_g: P("number", "Poids moyen d'une pièce, si ça se compte en pièces"),
        storage: P("string", "Où ça se range", { enum: LOCS }), aisle: P("string", "Rayon", { enum: RAYS }), emoji: P("string", "") } } }),
      share: P("boolean", "true pour la publier aussi dans le catalogue public (seulement si la personne le demande)") } } },
  { name: "propose_week", description: "Propose le programme de la semaine : des recettes et un nombre de portions pour chacune. La personne voit la proposition dans son appli et l'accepte ou non ; la liste de courses est alors calculée, moins ce qu'elle a déjà.",
    inputSchema: { type: "object", required: ["items"], properties: {
      items: P("array", "Plats de la semaine", { items: { type: "object", required: ["recipe_id", "portions"], properties: { recipe_id: P("string", ""), portions: P("integer", "Portions à manger dans la semaine") } } }),
      meals: P("integer", "Nombre de repas à couvrir (défaut : celui du profil)"), note: P("string", "Un mot d'explication affiché avec la proposition") } } },
  { name: "set_goals", description: "Change les objectifs quotidiens de la personne.", inputSchema: { type: "object", properties: { kcal: P("number", "kcal par jour"), prot: P("number", "Protéines par jour (g)") } } },
  { name: "log_food", description: "Ajoute au journal quelque chose que la personne dit avoir mangé.", inputSchema: { type: "object", required: ["name", "kcal"], properties: {
    name: P("string", "Quoi"), kcal: P("number", ""), prot: P("number", "Protéines (g)"), meal: P("string", "Repas", { enum: MEALS }), at: P("string", "Date et heure ISO (défaut : maintenant)") } } }
];

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function ingText(g, extra) {
  if (!Array.isArray(g)) return g;
  const a = AL[g[2]] || extra[g[2]] || {}, u = { g: "g", pc: "", cc: "c. à c.", cs: "c. à s." }[g[1]];
  return `${g[0]} ${u} ${g[0] > 1 && g[1] === "pc" && a.np || a.n || g[2]}`.replace(/\s+/g, " ");
}
const summary = (id, r, source, note) => ({ id, nom: r.nom, source, types: r.types || ["proteine", "legumes", "feculent"], portions: r.n || 1, temps: r.temps,
  kcal_portion: r.kcal, prot_portion: r.prot, ...(note ? { note_perso: note } : {}) });

async function callTool(env, uh, name, a) {
  const u = await env.DB.prepare("SELECT view, updated FROM users WHERE uh = ?").bind(uh).first();
  if (!u) throw new Error("Aucune donnée pour ce lien. Dans l'appli : ⚙️ > Connecter un assistant, puis « Activer ». Si le code a été renouvelé, ce lien n'est plus valable.");
  const V = JSON.parse(u.view || "{}"), mine = V.myRecipes || {}, foods = V.foods || {};
  const pending = async () => {
    const { results } = await env.DB.prepare("SELECT data FROM inbox WHERE uh = ? AND kind = 'recipe'").bind(uh).all();
    return Object.fromEntries(results.map(x => JSON.parse(x.data)).map(d => [d.id, d.recipe]));
  };
  const allRecipes = async () => {
    const out = {}, notes = Object.fromEntries((V.ratings || []).map(n => [n.id, n]));
    const add = (set, source) => { for (const [id, r] of Object.entries(set)) out[id] ||= { r, source, note: notes[id] }; };
    add(mine, "perso"); add(await pending(), "perso (en attente dans l'appli)"); add(baseRecipes(), "base"); add(await publicRecipes(env), "communauté");
    return out;
  };
  const push = (kind, data) => env.DB.prepare("INSERT INTO inbox (uh, kind, data, created) VALUES (?, ?, ?, ?)").bind(uh, kind, JSON.stringify(data), Date.now()).run();

  switch (name) {
    case "get_profile": return { derniere_synchro: new Date(u.updated).toISOString(), objectifs: V.goals, favoris: V.favs, notes_des_plats: V.ratings, aujourd_hui: V.today };
    case "get_journal": { const n = Math.min(60, Math.max(1, +a.days || 7)); return { objectifs: V.goals, jours: (V.journal || []).slice(0, n) }; }
    case "get_pantry": return { placard: V.pantry || [], plats_de_cote: V.dishes || [] };
    case "get_week": return { semaine: V.week || null, courses: V.shopping || [] };
    case "list_foods": {
      const q = norm(a.query), all = { ...AL, ...foods };
      return Object.entries(all).filter(([k, x]) => !q || norm(x.n + " " + k).includes(q))
        .map(([k, x]) => ({ key: k, nom: x.n, kcal_100g: x.k, prot_100g: x.p, ...(x.pc ? { piece_g: x.pc } : {}) }));
    }
    case "search_recipes": {
      const q = norm(a.query).split(/\s+/).filter(Boolean), all = await allRecipes();
      const hit = ({ r }) => { const t = norm(r.nom + " " + r.ingredients.map(g => ingText(g, { ...foods, ...(r.alim || {}) })).join(" ")); return q.every(w => t.includes(w)); };
      return Object.entries(all).filter(([, x]) => hit(x) && (!a.type || (x.r.types || []).includes(a.type))
        && (!a.max_kcal || x.r.kcal <= a.max_kcal) && (!a.min_prot || x.r.prot >= a.min_prot))
        .slice(0, Math.min(100, +a.limit || 40)).map(([id, x]) => summary(id, x.r, x.source, x.note && { etoiles: x.note.stars, tags: x.note.tags, commentaire: x.note.txt }));
    }
    case "get_recipe": {
      const x = (await allRecipes())[a.id]; if (!x) throw new Error("recette inconnue : " + a.id);
      const r = x.r, extra = { ...foods, ...(r.alim || {}) };
      return { ...summary(a.id, r, x.source, x.note), ingredients: r.ingredients.map(g => ingText(g, extra)), etapes: r.etapes.map(e => typeof e === "string" ? e : `${e.t} (${e.min} min)`), ...(r.lien ? { lien: r.lien } : {}) };
    }
    case "create_recipe": {
      const alim = {}, byName = {};
      for (const [k, x] of Object.entries({ ...AL, ...foods })) { byName[norm(x.n)] = k; if (x.np) byName[norm(x.np)] = k; }
      for (const f of a.new_foods || []) {
        const k = rid("a");
        alim[k] = cleanAlim({ n: f.name, np: f.plural, k: f.kcal_100g, p: f.prot_100g, pc: f.piece_g, loc: f.storage, ray: f.aisle, e: f.emoji });
        byName[norm(f.name)] = k;
      }
      const ingredients = (a.ingredients || []).map(g => {
        const k = AL[g.food] || foods[g.food] ? g.food : byName[norm(g.food)];
        if (k && +g.qty > 0) { if (foods[k]) alim[k] ||= foods[k]; return [+g.qty, UNITS.includes(g.unit) ? g.unit : "g", k]; }
        if (+g.qty > 0 && !k) throw new Error(`Aliment inconnu : « ${g.food} ». Utilise une clé de list_foods ou décris-le dans new_foods.`);
        return str(g.food, 200);
      });
      const used = Object.fromEntries(Object.entries(alim).filter(([k]) => ingredients.some(g => Array.isArray(g) && g[2] === k)));
      const recipe = cleanRecipe({ nom: a.name, emoji: a.emoji, n: a.servings, temps: a.time, types: a.types, ingredients, alim: used,
        etapes: (a.steps || []).map(s => typeof s === "string" ? s : { t: s.text, min: s.timer_min }) });
      const id = rid("r");
      if (a.share) await publish(env, uh, "mcp:" + uh.slice(0, 16), id, recipe);
      await push("recipe", { id, recipe, shared: !!a.share });
      return { id, ...summary(id, recipe, "perso"), message: "Recette envoyée : elle apparaîtra dans l'appli à sa prochaine ouverture." + (a.share ? " Elle est aussi publiée dans le catalogue public." : "") };
    }
    case "propose_week": {
      const all = await allRecipes(), items = (a.items || []).map(i => ({ recette: str(i.recipe_id, 40), n: Math.min(60, Math.max(1, Math.round(+i.portions || 1))) }));
      if (!items.length) throw new Error("items est vide");
      const bad = items.filter(i => !all[i.recette]).map(i => i.recette);
      if (bad.length) throw new Error("recettes inconnues : " + bad.join(", "));
      // Les recettes de la communauté voyagent avec la proposition : l'appli les a peut-être pas encore en cache
      const recipes = Object.fromEntries(items.filter(i => all[i.recette].source === "communauté").map(i => [i.recette, all[i.recette].r]));
      await push("week", { items, goal: +a.meals > 0 ? Math.round(+a.meals) : null, note: str(a.note, 1000), recipes });
      const tot = items.reduce((s, i) => ({ k: s.k + (all[i.recette].r.kcal || 0) * i.n, p: s.p + (all[i.recette].r.prot || 0) * i.n }), { k: 0, p: 0 });
      return { message: "Semaine proposée : la personne la verra à la prochaine ouverture de l'appli et pourra la lancer.", plats: items.map(i => `${i.n} × ${all[i.recette].r.nom}`), total_kcal: tot.k, total_prot: tot.p };
    }
    case "set_goals": {
      const g = { ...(+a.kcal >= 800 && +a.kcal <= 6000 ? { kcalJour: Math.round(+a.kcal) } : {}), ...(+a.prot >= 20 && +a.prot <= 400 ? { protJour: Math.round(+a.prot) } : {}) };
      if (!Object.keys(g).length) throw new Error("donne kcal (800 à 6000) et/ou prot (20 à 400)");
      await push("goals", g); return { message: "Objectifs envoyés à l'appli.", ...g };
    }
    case "log_food": {
      const nom = str(a.name, 120), kcal = Math.round(+a.kcal);
      if (!nom || !(kcal >= 0 && kcal < 10000)) throw new Error("name et kcal sont obligatoires");
      const at = a.at && !isNaN(new Date(a.at)) ? new Date(a.at).toISOString() : new Date().toISOString();
      await push("food", { nom, kcal, prot: Math.max(0, Math.round(+a.prot || 0)), meal: MEALS.includes(a.meal) ? a.meal : null, at });
      return { message: "Ajouté : visible dans le journal à la prochaine ouverture de l'appli." };
    }
  }
  throw new Error("outil inconnu : " + name);
}

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
async function mcpMessage(env, uh, msg) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return { jsonrpc: "2.0", id: msg && msg.id || null, error: { code: -32600, message: "Invalid Request" } };
  if (!("id" in msg)) return null; // notification
  const ok = result => ({ jsonrpc: "2.0", id: msg.id, result });
  switch (msg.method) {
    case "initialize": {
      const v = (msg.params || {}).protocolVersion;
      return ok({ protocolVersion: VERSIONS.includes(v) ? v : VERSIONS[0], capabilities: { tools: {} }, serverInfo: { name: "courses-recettes", title: "Courses & recettes", version: "1.0.0" }, instructions: INSTRUCTIONS });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "resources/list": return ok({ resources: [] });
    case "prompts/list": return ok({ prompts: [] });
    case "tools/call": {
      const p = msg.params || {};
      try { return ok({ content: [{ type: "text", text: JSON.stringify(await callTool(env, uh, p.name, p.arguments || {})) }] }); }
      catch (e) { return ok({ content: [{ type: "text", text: "Erreur : " + e.message }], isError: true }); }
    }
  }
  return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } };
}
async function mcp(req, env, uid) {
  if (req.method !== "POST") return new Response("Ce point d'accès MCP n'accepte que POST.", { status: 405, headers: { allow: "POST", ...CORS } });
  if (!uidOk(uid)) return fail(404, "lien invalide");
  let body; try { body = await readBody(req, 200000); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  const uh = await sha(uid);
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => mcpMessage(env, uh, m)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = await mcpMessage(env, uh, body);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      const m = path.match(/^\/mcp\/([^/]+)\/?$/);
      if (m) return await mcp(req, env, m[1]);
      if (path.startsWith("/api/")) return await api(req, env, path);
    } catch (e) { return fail(500, "erreur du serveur : " + e.message); }
    return env.ASSETS.fetch(req);
  }
};
