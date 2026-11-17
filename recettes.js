// Recettes livrées avec l'appli (les recettes partagées par les utilisateurs viennent du serveur, voir cloud.js). Chargé juste après data.js (qui contient les aliments).
// Ingrédient : [quantité, unité (g, pc = pièce, cc = c. à café, cs = c. à soupe), aliment] ou un simple texte.
// Étape : un texte, ou { t: texte, min: minuteur }. Sans kcal/prot indiqués, ils sont calculés depuis les ingrédients (cuisine.js).
// Cuissons vérifiées le 2026-11-14 sur des sources en ligne ; les durées de four restent des repères : fie-toi aux signes décrits.
Object.assign(window.DATA, {
  // Plan par défaut : vide. Chacun compose sa semaine dans l'appli (Recettes > Préparer ma semaine) ou la reçoit de son assistant.
  // Pour imposer un plan au prochain lancement (courses recalculées), définir ici semaineId (texte) et semaine.
  portions: 14, // repas à couvrir par semaine, par défaut
  hebdo: [], // ajouté chaque semaine à la liste de courses, en plus des recettes : [aliment, grammes] (réglage personnel S.cfg.hebdo)
  semaine: [],

  recettes: {
    // ---------- Novembre 2026 : plats de saison. Poulet-butternut, parmentier, dahl (et chili plus bas) sont en grande quantité pour la semaine ; les autres sont pour 1 portion ----------
    omelette: {
      nom: "Omelette champignons-épinards, pommes de terre sautées", emoji: "🍳", n: 1, portions: "1 portion", temps: "25 min",
      ingredients: [[3, "pc", "oeuf"], [60, "g", "jambon"], [150, "g", "champi"], [80, "g", "epinard"], [25, "g", "emmental"], [150, "g", "pdt"], [2, "cc", "huile"], "Sel, poivre"],
      etapes: [
        { t: "Coupe les pommes de terre en dés de 1,5 cm. Précuis-les à l'eau bouillante salée : la pointe d'un couteau doit entrer, sans qu'elles se défassent. Égoutte bien.", min: 6 },
        { t: "Fais-les dorer à la poêle avec la moitié de l'huile, feu moyen-vif, sans trop remuer. Sale, réserve.", min: 8 },
        { t: "Même poêle, feu vif : champignons émincés, sans couvrir, jusqu'à ce que leur eau soit évaporée et qu'ils dorent. Ajoute les épinards 1 min, puis les dés de jambon.", min: 6 },
        "Bats les œufs avec sel et poivre. Baisse à feu moyen, ajoute le reste d'huile, verse les œufs sur la garniture.",
        { t: "Ramène les bords vers le centre tant que c'est liquide. Quand le dessus est encore un peu baveux, parsème d'emmental, plie et sers avec les pommes de terre.", min: 3 }
      ]
    },
    saumon_lentilles: {
      nom: "Saumon rôti, lentilles vertes et poireau", emoji: "🐟", n: 1, portions: "1 portion", temps: "35 min",
      ingredients: [[1, "pc", "saumon"], [60, "g", "lentv"], [1, "pc", "poireau"], [1, "pc", "carotte"], [1, "cc", "huile"], [1, "cc", "moutarde"], "Sel, poivre, 1/2 citron"],
      etapes: [
        "Préchauffe le four à 200 °C. Rince les lentilles.",
        { t: "Lentilles dans une casserole avec 3 fois leur volume d'eau FROIDE, sans sel (le sel durcit la peau). Porte à ébullition puis petit feu. Elles sont cuites quand elles sont tendres mais entières. Sale à la fin, égoutte.", min: 22 },
        { t: "Pendant ce temps : poireau et carotte émincés fin dans une poêle avec l'huile et 2 c. à soupe d'eau, à couvert, feu doux, jusqu'à ce qu'ils soient fondants.", min: 12 },
        { t: "Saumon sur une plaque, peau dessous, salé. Enfourne. Pour un pavé de 2 à 3 cm : il est cuit quand la chair est opaque sur les bords et se détache à la fourchette, encore nacrée au centre.", min: 13 },
        "Mélange lentilles, légumes et moutarde. Pose le saumon dessus, un filet de citron."
      ]
    },
    poulet_butternut: {
      nom: "Poulet rôti, butternut et pois chiches", emoji: "🍗", n: 3, portions: "3 portions", temps: "50 min",
      ingredients: [[540, "g", "poulet"], [900, "g", "courge"], [360, "g", "pchiches"], [3, "cs", "huile"], [3, "cc", "paprika"], [3, "cc", "cumin"], [150, "g", "ygrec"], "Sel, poivre"],
      etapes: [
        "Préchauffe le four à 220 °C, chaleur tournante. Épluche la butternut, coupe-la en cubes de 2 cm. Rince et égoutte les pois chiches.",
        { t: "Répartis butternut + pois chiches + huile + épices + sel sur DEUX plaques, en une seule couche : sur une seule plaque trop chargée, tout cuit à la vapeur et reste mou. Enfourne les deux.", min: 20 },
        { t: "Coupe chaque blanc en 3 gros morceaux, sale. Retourne les légumes, répartis le poulet sur les plaques, inverse les plaques de niveau et remets au four.", min: 17 },
        "Vérifie le poulet : coupe le plus gros morceau, la chair doit être blanche jusqu'au centre, plus du tout rosée (74 °C à cœur). Sinon, 3 à 5 min de plus.",
        "Mange une portion avec 50 g de yaourt grec en sauce. Mets les 2 autres en boîtes dès qu'elles ont tiédi (moins de 2 h à température ambiante), au frigo : à manger sous 3 jours. Réchauffe 2 à 3 min au micro-ondes, yaourt ajouté après."
      ]
    },
    cabillaud: {
      nom: "Cabillaud moutarde-citron, pommes de terre et brocoli", emoji: "🐟", n: 1, portions: "1 portion", temps: "40 min",
      ingredients: [[200, "g", "cabillaud"], [250, "g", "pdt"], [200, "g", "brocoli"], [2, "cc", "moutarde"], [1, "cs", "huile"], [1, "pc", "ail"], "1/2 citron, sel, poivre"],
      etapes: [
        "Préchauffe le four à 220 °C. Coupe les pommes de terre en quartiers, le brocoli en bouquets.",
        { t: "Pommes de terre sur une plaque avec la moitié de l'huile, l'ail écrasé et du sel. Enfourne.", min: 20 },
        "Mélange la moutarde et le jus de citron, badigeonne le cabillaud. Enrobe le brocoli du reste d'huile.",
        { t: "Baisse le four à 200 °C. Retourne les pommes de terre, ajoute le brocoli et le poisson sur la plaque. Le cabillaud est cuit quand il est blanc opaque et s'effeuille sous la fourchette (dos de 3 cm : compte le temps entier ; filet fin : sors-le 4 min plus tôt).", min: 13 }
      ]
    },
    bowl_thon: {
      nom: "Bol thon, riz, avocat et œuf", emoji: "🥗", n: 1, portions: "1 portion", temps: "20 min",
      ingredients: [[1, "pc", "thon"], [70, "g", "riz"], [0.5, "pc", "avocat"], [1, "pc", "oeuf"], [1, "pc", "carotte"], [50, "g", "skyr"], [1, "cc", "moutarde"], "1/2 citron, sel, poivre"],
      etapes: [
        "Rince le riz. Mets-le dans une petite casserole avec 1,5 fois son volume d'eau et une pincée de sel.",
        { t: "Porte à ébullition, couvre, feu au minimum. Ne soulève pas le couvercle.", min: 11 },
        { t: "Coupe le feu et laisse reposer à couvert : c'est ce repos qui finit la cuisson.", min: 5 },
        { t: "Œuf dans l'eau bouillante pour un jaune crémeux (9 min pour un jaune dur), puis eau froide et écale.", min: 7 },
        "Sauce : skyr + moutarde + jus de citron. Dans un bol : riz, thon égoutté, avocat, carotte râpée, œuf coupé en deux, sauce."
      ]
    },
    parmentier: {
      nom: "Parmentier de patate douce au bœuf", emoji: "🍠", n: 3, portions: "3 portions", temps: "55 min",
      ingredients: [[900, "g", "patate_d"], [450, "g", "boeuf"], [1.5, "pc", "oignon"], [3, "pc", "carotte"], [300, "g", "concassees"], [60, "g", "emmental"], [90, "g", "lait"], [1, "cs", "huile"], "Sel, poivre, muscade"],
      etapes: [
        { t: "Épluche les patates douces, coupe-les en cubes de 2 cm. Cuis-les à l'eau bouillante salée : la pointe d'un couteau doit les traverser sans résistance.", min: 18 },
        "Préchauffe le four à 180 °C. Égoutte bien, écrase à la fourchette avec le lait, sel et muscade.",
        { t: "Grande poêle : oignons et carottes en tout petits dés dans l'huile, feu moyen.", min: 6 },
        { t: "Monte le feu, ajoute le bœuf en deux fois pour qu'il dore au lieu de bouillir, émiette-le. Puis les tomates : laisse réduire jusqu'à ce qu'il n'y ait presque plus de jus (sinon le parmentier sera liquide). Sale, poivre.", min: 12 },
        { t: "Monte 3 plats individuels (ou barquettes qui vont au four et au congélateur) : la viande, la purée, l'emmental. Enfourne ; 3 min sous le gril à la fin pour gratiner.", min: 18 },
        "Laisse tiédir. Un plat cuisiné se garde 3 jours au frigo : mets au congélateur, le jour même, les portions que tu mangeras plus tard que ça (sors-les au frigo la veille). Pour réchauffer : décongèle au frigo la veille, puis 15 min au four à 180 °C ou 3 à 4 min au micro-ondes, jusqu'à ce que le centre soit brûlant."
      ]
    },
    dinde_champi: {
      nom: "Émincé de dinde aux champignons, sauce moutarde et riz", emoji: "🍄", n: 1, portions: "1 portion", temps: "25 min",
      ingredients: [[180, "g", "dinde"], [200, "g", "champi"], [0.5, "pc", "oignon"], [80, "g", "fblanc"], [2, "cc", "moutarde"], [70, "g", "riz"], [1, "cc", "huile"], "Sel, poivre"],
      etapes: [
        { t: "Riz rincé dans 1,5 fois son volume d'eau salée : ébullition, puis couvercle et feu au minimum.", min: 11 },
        { t: "Laisse le riz reposer à couvert, feu éteint.", min: 5 },
        { t: "Poêle très chaude, sans matière grasse : champignons émincés, sans couvrir ni saler au début. Ils rendent leur eau, puis dorent.", min: 6 },
        { t: "Ajoute l'huile, l'oignon émincé et la dinde en lamelles. Feu vif : la dinde est cuite quand elle est blanche à cœur (coupe une lamelle).", min: 5 },
        "HORS DU FEU, ajoute le fromage blanc et la moutarde, mélange. S'il bout, le fromage blanc 0 % fait des grumeaux. Sale, poivre, sers avec le riz."
      ]
    },
    endives: {
      nom: "Endives au jambon gratinées, béchamel légère", emoji: "🥬", n: 1, portions: "1 portion", temps: "50 min",
      ingredients: [[3, "pc", "endive"], [3, "pc", "jambonb"], [250, "g", "lait"], [20, "g", "maizena"], [40, "g", "emmental"], [1, "pc", "painc"], "Muscade, sel, poivre"],
      etapes: [
        { t: "Retire le petit cône amer à la base des endives. Cuis-les entières à la vapeur ou à l'eau bouillante salée : un couteau doit entrer facilement.", min: 18 },
        "Égoutte-les tête en bas puis PRESSE-les dans tes mains ou dans un torchon : c'est l'étape qui évite un gratin plein d'eau. Préchauffe le four à 210 °C.",
        { t: "Béchamel sans beurre : délaye la maïzena dans le lait FROID, puis chauffe en fouettant sans arrêt jusqu'à ce que ça épaississe. Sel, poivre, muscade, la moitié de l'emmental.", min: 4 },
        "Roule chaque endive dans une tranche de jambon, range dans un plat, nappe de béchamel, parsème du reste d'emmental.",
        { t: "Enfourne jusqu'à ce que le dessus soit bien doré. Sers avec la tranche de pain.", min: 18 }
      ]
    },
    bolo: {
      nom: "Pâtes bolognaise bœuf-carottes", emoji: "🍝", n: 1, portions: "1 portion", temps: "35 min",
      ingredients: [[80, "g", "pates"], [150, "g", "boeuf"], [1, "pc", "carotte"], [0.5, "pc", "oignon"], [1, "pc", "ail"], [200, "g", "concassees"], [15, "g", "emmental"], [1, "cc", "huile"], "Sel, poivre, herbes de Provence"],
      etapes: [
        { t: "Oignon émincé et carotte râpée dans l'huile, feu moyen, jusqu'à ce qu'ils soient tendres. Ajoute l'ail 30 secondes.", min: 5 },
        { t: "Monte le feu, ajoute le bœuf, émiette-le et laisse-le dorer sans trop remuer.", min: 5 },
        { t: "Ajoute les tomates, les herbes, sel et poivre. Laisse mijoter à découvert, petit feu : la sauce doit épaissir.", min: 20 },
        "Pendant ce temps, cuis les pâtes dans beaucoup d'eau bouillante salée, 1 min de moins que le temps du paquet. Garde une demi-louche d'eau de cuisson.",
        "Mélange les pâtes à la sauce avec un peu d'eau de cuisson, 1 min sur le feu. Emmental par-dessus."
      ]
    },
    dahl: {
      nom: "Dahl de lentilles corail aux épinards, œufs mollets", types: ["proteine", "legumineuse", "legumes"], emoji: "🍛", n: 5, portions: "5 portions", temps: "45 min",
      ingredients: [[400, "g", "lentc"], [500, "g", "epinard"], [1000, "g", "concassees"], [250, "g", "laitcoco"], [2.5, "pc", "oignon"], [5, "pc", "ail"], [3, "pc", "gingembre"], [5, "cc", "curry"], [3, "cc", "curcuma"], [10, "pc", "oeuf"], [1, "cs", "huile"], "Sel"],
      etapes: [
        { t: "Grande casserole : oignons, ail et gingembre hachés dans l'huile, feu moyen. Ajoute les épices et remue 30 secondes.", min: 4 },
        { t: "Ajoute les lentilles rincées, les tomates et 1,25 litre d'eau. Pas de sel maintenant. Petit feu, remue souvent (ça accroche au fond) : les lentilles doivent s'écraser sous la cuillère. Ajoute un peu d'eau si c'est trop épais.", min: 20 },
        { t: "Ajoute les épinards (surgelés : sans décongeler) et le lait de coco, laisse juste tomber les feuilles. Sale à la fin.", min: 4 },
        { t: "Les œufs se font au moment de manger, 2 par portion : plonge-les dans l'eau bouillante, puis eau froide et écale.", min: 6 },
        "Répartis le dahl en 5 portions dès qu'il a tiédi : 2 au frigo (3 jours), 3 au congélateur. Il épaissit en refroidissant : ajoute 2 c. à soupe d'eau en le réchauffant, à la casserole ou 3 min au micro-ondes en remuant à mi-temps."
      ]
    },
    poulet_brocoli: {
      nom: "Poulet sauté au brocoli, soja-gingembre et riz", emoji: "🥦", n: 1, portions: "1 portion", temps: "25 min",
      ingredients: [[180, "g", "poulet"], [250, "g", "brocoli"], [2, "pc", "ail"], [1, "pc", "gingembre"], [2, "cs", "soja"], [70, "g", "riz"], [1, "cs", "huile"]],
      etapes: [
        { t: "Riz rincé dans 1,5 fois son volume d'eau : ébullition, puis couvercle et feu au minimum.", min: 11 },
        { t: "Laisse le riz reposer à couvert, feu éteint.", min: 5 },
        { t: "Brocoli en petits bouquets dans l'eau bouillante salée, puis égoutte : il doit rester vert vif et croquant.", min: 2 },
        { t: "Poêle ou wok très chaud avec l'huile : poulet en fines lamelles, en une seule couche, sans remuer la première minute. Il est cuit quand il est blanc à cœur.", min: 5 },
        { t: "Ajoute ail et gingembre hachés 30 secondes, puis le brocoli, la sauce soja et 2 c. à soupe d'eau.", min: 2 }
      ]
    },
    porc_carottes: {
      nom: "Filet mignon à la moutarde, carottes rôties et semoule", emoji: "🥕", n: 1, portions: "1 portion", temps: "40 min",
      ingredients: [[180, "g", "porc"], [3, "pc", "carotte"], [60, "g", "semoule"], [2, "cc", "moutarde"], [1, "cs", "huile"], [1, "cc", "cumin"], "Sel, poivre"],
      etapes: [
        "Préchauffe le four à 200 °C. Coupe les carottes en bâtonnets.",
        { t: "Carottes sur une plaque avec la moitié de l'huile, le cumin et du sel. Enfourne.", min: 10 },
        { t: "Poêle très chaude avec le reste d'huile : saisis le morceau de filet mignon sur toutes ses faces. Sale, poivre, badigeonne de moutarde.", min: 4 },
        { t: "Pose le porc sur la plaque avec les carottes et remets au four. Il est cuit à 63 °C à cœur : en le coupant, la chair est rose très pâle et le jus est clair.", min: 17 },
        { t: "Laisse reposer la viande sous une feuille d'aluminium avant de la trancher. Pendant ce temps, semoule : verse le même volume d'eau bouillante salée, couvre, puis égraine à la fourchette.", min: 5 }
      ]
    },
    shakshuka: {
      nom: "Shakshuka aux pois chiches", emoji: "🍳", n: 1, portions: "1 portion", temps: "25 min",
      ingredients: [[1, "pc", "concassees"], [100, "g", "pchiches"], [3, "pc", "oeuf"], [0.5, "pc", "oignon"], [1, "pc", "ail"], [1, "cc", "cumin"], [1, "cc", "paprika"], [1, "cc", "huile"], [1, "pc", "painc"], [50, "g", "skyr"], "Sel, piment"],
      etapes: [
        { t: "Oignon émincé dans l'huile, feu moyen. Ajoute l'ail et les épices 30 secondes.", min: 4 },
        { t: "Ajoute les tomates et les pois chiches rincés. Laisse réduire à découvert : la sauce doit être épaisse pour tenir les œufs. Sale.", min: 10 },
        { t: "Creuse 3 puits, casse un œuf dans chacun. Couvre, feu doux. C'est prêt quand les blancs sont pris et que les jaunes tremblent encore.", min: 6 },
        "Sers dans la poêle, avec le skyr et le pain pour saucer."
      ]
    },
    crevettes_poireaux: {
      nom: "Crevettes ail-paprika, poireaux fondants et riz", emoji: "🦐", n: 1, portions: "1 portion", temps: "25 min",
      ingredients: [[200, "g", "crevette"], [2, "pc", "poireau"], [70, "g", "riz"], [2, "pc", "ail"], [1, "cc", "paprika"], [1, "cs", "huile"], [50, "g", "fblanc"], "1/2 citron, sel, poivre"],
      etapes: [
        "Sors les crevettes du congélateur le matin (au frigo), ou décongèle-les 10 min dans l'eau froide. Sèche-les bien dans du papier absorbant.",
        { t: "Riz rincé dans 1,5 fois son volume d'eau salée : ébullition, puis couvercle et feu au minimum. Ensuite 5 min de repos à couvert, feu éteint.", min: 11 },
        { t: "Poireaux émincés avec la moitié de l'huile et 2 c. à soupe d'eau, à couvert, feu doux. Hors du feu, ajoute le fromage blanc.", min: 13 },
        { t: "Poêle très chaude, reste d'huile : crevettes en une seule couche. Elles sont cuites dès qu'elles sont roses et opaques ; au-delà, elles deviennent caoutchouteuses. Ajoute l'ail haché et le paprika 30 secondes à la fin.", min: 3 },
        "Citron, sel, poivre. Sers sur les poireaux et le riz."
      ]
    },

    // ---------- Briques à associer : une protéine + des légumes + un féculent (étiquette « type ») ----------
    poulet_four: {
      nom: "Blancs de poulet rôtis", types: ["proteine"], emoji: "🍗", n: 5, portions: "5 portions", temps: "35 min",
      ingredients: [[900, "g", "poulet"], [2, "cs", "huile"], [3, "cc", "paprika"], [250, "g", "ygrec"], "Sel, poivre, thym"],
      etapes: [
        "Préchauffe le four à 200 °C. Si un blanc est beaucoup plus épais d'un côté, aplatis-le avec la paume pour qu'il cuise régulièrement.",
        "Enrobe les blancs d'huile, de paprika, de thym, sel et poivre. Pose-les sur une plaque, sans qu'ils se touchent (deux plaques si besoin).",
        { t: "Enfourne. Vérifie en coupant le plus épais : chair blanche jusqu'au centre, plus du tout rosée, jus clair (74 °C à cœur). Sinon, 3 à 5 min de plus.", min: 22 },
        { t: "Laisse reposer avant de couper : le jus reste dans la viande.", min: 5 },
        "Coupe en tranches et répartis en 5 portions : 2 au frigo (3 jours), 3 au congélateur. Réchauffe 1 à 2 min au micro-ondes, couvert, avec 1 c. à soupe d'eau pour qu'il ne sèche pas. Le yaourt grec (50 g par portion) sert de sauce, ajouté froid."
      ]
    },
    butternut_pchiches: {
      nom: "Butternut et pois chiches rôtis", types: ["legumes", "legumineuse"], emoji: "🎃", n: 5, portions: "5 portions", temps: "45 min",
      ingredients: [[1500, "g", "courge"], [600, "g", "pchiches"], [4, "cs", "huile"], [3, "cc", "paprika"], [3, "cc", "cumin"], "Sel, poivre"],
      etapes: [
        "Préchauffe le four à 220 °C, chaleur tournante. Épluche la butternut, coupe-la en cubes de 2 cm. Rince et égoutte bien les pois chiches.",
        { t: "Mélange butternut, pois chiches, huile, épices et sel. Répartis sur DEUX plaques, en une seule couche : sur une plaque trop chargée, tout cuit à la vapeur et reste mou. Enfourne les deux.", min: 15 },
        { t: "Retourne les légumes, inverse les plaques de niveau et poursuis : la butternut doit être tendre sous la pointe d'un couteau et dorée sur les arêtes, les pois chiches un peu croustillants.", min: 15 },
        "Répartis en 5 portions : 2 au frigo (3 jours), 3 au congélateur. Réchauffe 2 à 3 min au micro-ondes, ou 10 min au four à 200 °C pour retrouver du croustillant."
      ]
    },
    legumes_express: {
      nom: "Légumes mijotés, base surgelée et épices (méthode de papa)", types: ["legumes"], emoji: "🥦", n: 5, portions: "5 portions", temps: "40 min",
      ingredients: [[400, "g", "oignonsurg"], [600, "g", "champi"], [500, "g", "poivronsurg"], [1000, "g", "legsurg"], [5, "pc", "ail"], [2, "pc", "gingembre"], [2, "cc", "curcuma"], [3, "cc", "cumin"], [5, "cc", "huile"], "Sel, poivre, autres épices au choix"],
      etapes: [
        { t: "Grande sauteuse ou cocotte bien chaude, à découvert : oignons surgelés, champignons émincés et poivrons surgelés, sans décongeler. Laisse cuire à feu vif en remuant de temps en temps, jusqu'à ce que toute l'eau soit partie et que ça commence à accrocher légèrement. En grande quantité, ça prend plus de temps : ne passe pas à la suite tant qu'il reste du liquide.", min: 15 },
        "Ajoute l'huile, l'ail et le gingembre hachés, le curcuma, le cumin et du poivre. Remue 30 secondes : les épices doivent chauffer dans le gras, sans brûler.",
        { t: "Ajoute ton légume (courgette, chou-fleur, brocoli, haricots verts, épinards, carottes en rondelles…) et un verre d'eau. Couvre, feu doux, et laisse mijoter jusqu'à ce qu'il soit tendre. Légume surgelé : 10 à 12 min. Légume frais dur (carotte, chou-fleur) : 15 à 20 min.", min: 15 },
        "Sale à la fin, goûte et corrige les épices. Se garde 3 jours au frigo ; au-delà, congèle en portions le jour même. Change le légume et les épices à chaque fois."
      ]
    },
    riz_nature: {
      nom: "Riz basmati", types: ["feculent"], emoji: "🍚", n: 1, portions: "1 portion", temps: "20 min",
      ingredients: [[70, "g", "riz"], "Sel"],
      etapes: [
        "Rince le riz jusqu'à ce que l'eau soit claire. Mets-le dans une petite casserole avec 1,5 fois son volume d'eau et une pincée de sel.",
        { t: "Porte à ébullition, couvre, feu au minimum. Ne soulève pas le couvercle.", min: 11 },
        { t: "Coupe le feu et laisse reposer à couvert, puis égraine à la fourchette.", min: 5 }
      ]
    },

    // ---------- Recettes d'avant, cuissons corrigées le 2026-11-14 ----------
    chili: {
      nom: "Chili con carne (sans le riz)", types: ["proteine", "legumineuse", "legumes"], emoji: "🌶️", n: 5, portions: "5 portions", temps: "1 h 05",
      ingredients: [[750, "g", "boeuf"], [3, "pc", "oignon"], [3, "pc", "poivron"], [5, "pc", "ail"],
        [1000, "g", "concassees"], [400, "g", "haricots"], [3, "cc", "cumin"], [3, "cc", "paprika"], [75, "g", "skyr"], "Piment selon ton goût, sel, poivre"],
      etapes: [
        { t: "Grande cocotte : fais revenir les oignons et les poivrons émincés dans un filet d'huile, feu moyen. Ajoute l'ail à la fin. Réserve dans un bol.", min: 7 },
        { t: "Feu vif : fais dorer le bœuf en TROIS fois (250 g à la fois), en l'émiettant. Tout d'un coup, il rend son eau et bout au lieu de dorer.", min: 10 },
        { t: "Remets les légumes, ajoute les épices, puis les tomates. Laisse mijoter à petit feu, à moitié couvert. Sale et poivre.", min: 25 },
        { t: "Ajoute les haricots rincés et égouttés (plus tôt, ils s'écrasent). Poursuis jusqu'à ce que la sauce soit épaisse.", min: 15 },
        "Répartis en 5 portions dès qu'il a tiédi : 2 au frigo (3 jours), 3 au congélateur. Réchauffe à la casserole ou 3 min au micro-ondes, jusqu'à ce qu'il bouillonne. Sers avec une cuillère de skyr, et au choix du riz (11 min, à faire le jour même) ou des légumes en plus."
      ]
    },
    tikka: {
      nom: "Poulet tikka masala light", kcal: 520, prot: 48, emoji: "🍛", n: 2, portions: "2 portions", temps: "35 min + marinade",
      macros: "520 kcal · 48 g prot. / portion",
      ingredients: [[360, "g", "poulet"], [300, "g", "ygrec"], [1, "pc", "oignon"], [2, "pc", "ail"],
        [1, "pc", "gingembre"], [2, "cc", "garam"], [1, "cc", "curcuma"], [1, "pc", "concassees"], [120, "g", "riz"]],
      etapes: [
        { t: "Coupe le poulet en cubes de 2 à 3 cm. Mélange-le avec 200 g de yaourt, la moitié des épices, l'ail et le gingembre. Laisse mariner au frigo (30 min minimum, l'idéal est la veille).", min: 30 },
        { t: "Poêle bien chaude, un filet d'huile : fais dorer le poulet en une seule couche, en deux fois si besoin. Il finira de cuire dans la sauce. Réserve.", min: 5 },
        { t: "Dans la même poêle, fais revenir l'oignon émincé avec le reste des épices.", min: 4 },
        { t: "Ajoute les tomates et laisse réduire. Remets le poulet : il doit être blanc à cœur. Cuis le riz en même temps (1,5 volume d'eau, couvercle, feu au minimum, puis 5 min de repos).", min: 11 },
        "HORS DU FEU, attends 1 min puis ajoute le reste du yaourt en remuant : s'il bout, il tranche et fait des grumeaux. Sers avec le riz."
      ]
    },
    tarte: {
      nom: "Tarte aux poireaux boostée", kcal: 475, prot: 30, emoji: "🥧", n: 4, portions: "4 parts", temps: "1 h 05",
      macros: "475 kcal · 30 g prot. / part",
      ingredients: [[1, "pc", "brisee"], [3, "pc", "poireau"], [4, "pc", "oeuf"], [250, "g", "fblanc"],
        [200, "g", "jambon"], [60, "g", "emmental"], "Muscade, sel, poivre"],
      etapes: [
        "Préchauffe le four à 190 °C. Étale la pâte dans un moule, pique tout le fond à la fourchette.",
        { t: "Précuis la pâte à blanc : couvre-la de papier cuisson et de légumes secs (ou d'un second moule) et enfourne. Sans ça, le fond reste mou sous la garniture.", min: 12 },
        { t: "Émince les poireaux et fais-les fondre à la poêle à découvert, jusqu'à ce qu'il n'y ait PLUS d'eau au fond (c'est elle qui détrempe la tarte).", min: 15 },
        "Fouette les œufs avec le fromage blanc, la muscade, le sel et le poivre.",
        "Répartis les poireaux et les dés de jambon sur la pâte précuite. Verse l'appareil, puis l'emmental.",
        { t: "Enfourne à 180 °C. La tarte est cuite quand le dessus est doré et que le centre ne tremble plus. Laisse tiédir 10 min avant de couper. Sers une part avec une grosse salade.", min: 35 }
      ]
    },
    burger: {
      nom: "Smash burger maison", kcal: 620, prot: 38, emoji: "🍔", n: 1, portions: "1 burger", temps: "15 min",
      macros: "620 kcal · 38 g prot.",
      ingredients: [[1, "pc", "pain"], [125, "g", "boeuf"], [1, "pc", "cheddar"], [40, "g", "salade"], [1, "pc", "tomate"],
        [30, "g", "oignonr"], [2, "cs", "skyr"], [1, "cc", "moutarde"], [2, "pc", "cornichon"]],
      etapes: [
        "Mélange les ingrédients de la sauce (skyr, moutarde, cornichons hachés). Toaste le pain.",
        "Fais une boule de viande sans la tasser. Chauffe une poêle (fonte ou inox) à feu vif 2 min, à sec. Avec du bœuf à 5 %, mets quelques gouttes d'huile : il accroche plus que du 15 %.",
        { t: "Pose la boule et écrase-la tout de suite très fort avec une spatule (un papier cuisson entre les deux évite que ça colle). Sale, poivre. Ne touche plus : la croûte doit être brun foncé.", min: 1 },
        { t: "Racle bien sous le steak pour décoller la croûte, retourne, pose le cheddar et laisse fondre.", min: 1 },
        "Monte le burger : sauce, salade, steak, tomate, oignon."
      ]
    },
    frites: {
      nom: "Frites au four", types: ["feculent"], kcal: 260, prot: 4, emoji: "🍟", n: 1, portions: "1 portion", temps: "45 min + trempage",
      macros: "260 kcal · 4 g prot. / portion (estimation)",
      ingredients: [[150, "g", "pdt"], [1, "cs", "huile"], "Sel"],
      etapes: [
        { t: "Coupe les pommes de terre en bâtonnets réguliers de 1 cm. Fais-les tremper dans l'eau froide : ça retire l'amidon qui les rend molles.", min: 30 },
        "Préchauffe le four à 220 °C (chaleur tournante). Égoutte les frites et SÈCHE-les complètement dans un torchon : c'est l'étape la plus importante pour le croustillant.",
        { t: "Enrobe-les d'huile, étale-les sur une plaque sans qu'elles se touchent. Enfourne.", min: 15 },
        { t: "Retourne-les et poursuis jusqu'à ce qu'elles soient bien dorées (10 à 20 min de plus selon l'épaisseur). Sale à la sortie du four, pas avant.", min: 15 }
      ]
    },
    dessert: {
      nom: "Tarte poire-chocolat (coloc)", types: ["dessert"], emoji: "🍐", n: 6, portions: "6 parts", temps: "50 min",
      kcal: 600, prot: 8, macros: "≈ 600 kcal · 8 g prot. / part (estimation)",
      lien: "https://www.marmiton.org/recettes/recette_tarte-poire-chocolat_70420.aspx",
      ingredients: [[1, "pc", "feuilletee"], [200, "g", "chocolat"], [80, "g", "beurre"], [100, "g", "sucre"],
        [20, "g", "cassonade"], [1, "pc", "poires"], [150, "g", "creme"], [3, "pc", "oeuf"]],
      etapes: [
        "Préchauffe le four à 190 °C. Étale la pâte dans un moule et pique tout le fond à la fourchette.",
        "Fais fondre le chocolat avec le beurre et la crème, à feu très doux ou au micro-ondes par tranches de 30 secondes. Laisse tiédir 5 min (trop chaud, il cuirait les œufs).",
        "Fouette les œufs avec le sucre, puis mélange avec le chocolat fondu.",
        "Égoutte les poires et sèche-les dans du papier absorbant, coupe-les en lamelles et dispose-les sur la pâte. Verse l'appareil au chocolat.",
        { t: "Saupoudre de cassonade et enfourne, grille dans le bas du four pour bien cuire la pâte. C'est cuit quand les bords sont gonflés et que le centre tremble encore un peu : il fige en refroidissant.", min: 32 }
      ]
    }
  }
});
