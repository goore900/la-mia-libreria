/* ============================================================
   Genera dist/la-mia-libreria.html: un unico file autonomo con
   dentro CSS, dati iniziali, logica e icona. Serve per usare
   l'app senza GitHub Pages (hosting gratuito o file locale).

   Uso:  node build-single.mjs
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');

const html  = read('./index.html');
const css   = read('./css/styles.css');
const seed  = read('./js/seed.js');
const app   = read('./js/app.js');
const svg   = read('./icons/icon.svg');
const svgUri = 'data:image/svg+xml,' + encodeURIComponent(svg.trim());

// nessuna delle risorse deve poter chiudere il tag che la contiene
for (const [name, src] of [['css', css], ['seed.js', seed], ['app.js', app]]) {
  if (/<\/(script|style)/i.test(src)) throw new Error(`${name} contiene una chiusura di tag`);
}

// il testo sostituito va passato come funzione: in una stringa di sostituzione
// "$$" varrebbe "$" e "$&" il testo trovato, storpiando il codice inserito
const sub = (s, re, text) => s.replace(re, () => text);

let out = html;
// niente manifest/service worker: qui non c'è una cartella da cui servirli
out = sub(out, /^.*<link rel="manifest".*$\n/m, '');
out = sub(out, /^.*rel="icon".*$\n/m, `<link rel="icon" href="${svgUri}" type="image/svg+xml">\n`);
out = sub(out, /^.*rel="apple-touch-icon".*$\n/m, `<link rel="apple-touch-icon" href="${svgUri}">\n`);
out = sub(out, /^.*<link rel="stylesheet".*$\n/m, `<style>\n${css}\n</style>\n`);
out = sub(out, /^.*<script src="js\/seed\.js"><\/script>.*$\n/m, `<script>\n${seed}\n</script>\n`);
out = sub(out, /^.*<script src="js\/app\.js"><\/script>.*$\n/m, `<script>\n${app}\n</script>\n`);

for (const leftover of [/<link rel="stylesheet"/, /src="js\//, /rel="manifest"/]) {
  if (leftover.test(out)) throw new Error('resta un riferimento esterno: ' + leftover);
}

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/la-mia-libreria.html', import.meta.url), out);
console.log(`dist/la-mia-libreria.html — ${(out.length / 1024).toFixed(0)} KB, tutto incluso`);
