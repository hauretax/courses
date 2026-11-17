// data.js et recettes.js écrivent dans window.DATA : dans le Worker, window = l'objet global.
globalThis.window = globalThis;
