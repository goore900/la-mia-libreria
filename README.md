# 🌸 La Mia Libreria

App mobile per tenere l'archivio dei propri libri: categorie personalizzabili, preferiti,
letti, non piaciuti, avanzamento (volume e pagina), copertine, ricerca e filtri.
Palette pastello lilla / rosa / celeste su bianco, icone a fiori, stelle e cuoricini.

L'app è una **PWA**: si apre dal browser del telefono e si può installare nella schermata
Home come una vera app (icona, schermo intero, funziona anche offline).
Non serve né uno store né un account: **tutti i dati restano sul telefono**.

---

## Come si usa

### Installarla sul telefono

1. Apri l'indirizzo dell'app col browser del telefono.
2. **iPhone (Safari):** tasto *Condividi* → **Aggiungi a Home**.
   **Android (Chrome):** menu ⋮ → **Installa app** / *Aggiungi a schermata Home*.
3. Avvia l'app dall'icona: parte a schermo intero.

### Password

La password d'accesso è **fissa** ed è la stessa su ogni dispositivo: non si sceglie al
primo avvio e non si cambia dall'app.

Nel codice non è scritta in chiaro — il repository è pubblico — ma solo la sua impronta
(PBKDF2-SHA256, 150.000 iterazioni, con un ripiego per i contesti privi di `crypto.subtle`).
Dall'impronta non si risale alla password.

Per cambiarla serve ricalcolare l'impronta e sostituire la costante `FIXED` in
`js/app.js`:

```bash
node -e 'const c=require("crypto");const P="nuova-password",S="la-mia-libreria-2026";
console.log(c.pbkdf2Sync(P,S,150000,32,"sha256").toString("base64"));'
```

La password si inserisce **una volta sola per dispositivo**: lo sblocco resta memorizzato
in `localStorage`, quindi riaprendo l'app si entra direttamente. Per farla richiedere di
nuovo — o prima di prestare il telefono — si usa *Impostazioni → Blocca l'app*, che
cancella lo sblocco memorizzato.

> Il blocco impedisce di usare l'app, non nasconde i file del sito: su un sito pubblico
> l'elenco iniziale in `js/seed.js` è comunque leggibile. I libri che aggiungi e le
> copertine restano invece solo sul tuo dispositivo.

### La griglia

In alto a destra si sceglie come vedere i libri, con due pulsanti:

| Vista | Cosa mostra |
|---|---|
| ☰ Elenco | riga per riga, con autrice, avanzamento e categorie |
| ▦ Griglia | 6 copertine per riga, con il titolo sotto |

I libri senza copertina mostrano un monogramma su sfondo pastello (il colore viene dalle
sue categorie), e i badge indicano 💗 preferito, 📖 letto, 💔 non piaciuto.

### Cercare e filtrare

* **Ricerca libera**: cerca in titolo, autrice, note e nomi delle categorie
  (più parole = tutte devono corrispondere; accenti e maiuscole non contano).
* **Chip in alto**: un tocco per filtrare su una categoria, sui preferiti o sui letti.
* **Filtri**: stato (preferiti, letti, in lettura, da iniziare, non piaciuti), categorie,
  autrice e ordinamento. Con più categorie selezionate mostra i libri che stanno in
  *almeno una*; attivando *«deve avere tutte le categorie»* solo quelli che stanno in tutte.

### La scheda del libro

Tocca un libro per aprirlo e modificarlo: immagine di copertina (dalla galleria o dalla
fotocamera, viene ridimensionata e salvata sul telefono), titolo, autrice, volumi totali,
volume attuale, pagina attuale, pagine totali, stato, categorie e note.
Il tasto ➕ in basso aggiunge un libro nuovo.

### Copertine da internet

Dalla scheda del libro, **Cerca online** interroga Google Books e Open Library con titolo e
autrice e mostra le copertine trovate: si tocca quella giusta e viene assegnata.
In *Impostazioni → Copertine*, **Cerca copertine mancanti** fa lo stesso in sequenza per
tutti i libri che non hanno un'immagine, assegnandola solo quando titolo e autrice
corrispondono davvero; mostra l'avanzamento e si può fermare quando si vuole.

Le richieste partono dal browser del telefono: nessun server dell'app vede la libreria, e
le immagini restano sul dispositivo. Quando il sito che ospita l'immagine lo consente
(intestazioni CORS) l'immagine viene salvata sul telefono, quindi finisce nel backup e si
vede anche offline; altrimenti viene salvato solo il link e serve la connessione per
vederla. Google Books limita il numero di ricerche giornaliere per indirizzo IP: al
raggiungimento del limite l'app lo dice, smette di interrogarlo per dieci minuti e
prosegue con Open Library.

> Sono cataloghi internazionali: molte edizioni italiane indipendenti non ci sono, e per
> le voci scritte come nome di serie conviene cercare il titolo del singolo volume.

### Categorie

Dall'icona 🏷️ in alto: crea, rinomina, elimina, scegli l'icona (fiore, stella, cuore,
scintille, luna, farfalla, nuvola, corona, libro, segnalibro…) e il colore fra 14 pastelli
o con il cursore *Colore libero*, che genera solo tonalità pastello.
Un libro può stare in **più categorie** insieme: alcuni titoli dell'elenco iniziale, per
esempio, sono sia in *«In attesa di nuove uscite»* sia in *«Preferiti finiti»*.
Eliminando una categoria i libri restano, perdono solo quell'etichetta.

**Ordine delle categorie**: trascina la maniglia ⠿ a sinistra di ogni riga per spostarla
in su o in giù. L'ordine scelto vale ovunque — chip in alto, pannello dei filtri, elenco
nella scheda del libro — e resta salvato. Toccando invece la riga si apre la modifica.
Il trascinamento usa i Pointer Events (non il drag & drop HTML5, che sui browser mobili
non funziona) e la maniglia ha `touch-action: none`, così il dito sposta la riga senza far
scorrere il pannello; avvicinandosi al bordo la lista scorre da sola.

### Backup

I dati vivono solo su questo telefono: se lo cambi o cancelli i dati del browser, spariscono.
In *Impostazioni → Backup* puoi **esportare** un file `.json` (libri, categorie e copertine)
e **importarlo** su un altro telefono. *Ripristina elenco iniziale* rimette l'elenco di
partenza; *Cancella tutto* svuota l'archivio.

---

## Elenco iniziale

L'app parte già con **133 libri** e **7 categorie** prese dalla lista di partenza:

| Categoria | Libri |
|---|---|
| In attesa di nuove uscite | 16 |
| Da finire | 14 |
| Letti | 46 |
| Preferiti finiti | 29 |
| Sospesi (non finiti) | 14 |
| Sospesi — non so se finirli | 18 |
| Autrici da seguire | 8 |

I titoli che comparivano in più elenchi (per esempio *Winter Fe'*, *Il cuore del lupo*,
*Storm and Sea*, *The Edge of Darkness*) sono un libro solo con più categorie, e le note
dell'elenco originale («quando esce il vol. 3?», «vol. 2 a pag. 83», …) sono state
conservate nel campo *Note* insieme a volume e pagina di avanzamento.

---

## Struttura del progetto

```
index.html              interfaccia + sprite delle icone SVG
css/styles.css          palette pastello, griglie, pannelli
js/seed.js              elenco iniziale di libri e categorie
js/app.js               logica: password, archivio, filtri, categorie, backup
sw.js                   service worker (funzionamento offline)
build-single.mjs        genera la versione in un file solo
manifest.webmanifest    installazione come app
icons/                  icona dell'app (SVG + PNG)
dist/                   la-mia-libreria.html: tutta l'app in un file solo
```

Nessuna dipendenza esterna, nessun passaggio di build: sono file statici.

**Dove finiscono i dati:** libri, categorie, impostazioni e stato di sblocco in
`localStorage`; le copertine in `IndexedDB`, con ripiego su `localStorage` dove non è
disponibile.

## Provarla sul computer

Serve un server locale (il service worker e IndexedDB non funzionano aprendo il file
direttamente da disco):

```bash
npx http-server -p 8080 .
# poi apri http://127.0.0.1:8080
```

## Metterla online gratis

**GitHub Pages** (gratis se il repository è *pubblico*; con un repository privato serve un
piano a pagamento): Settings → *Pages* → *Deploy from a branch* → branch
`claude/la-mia-libreria-app-vrkzf5`, cartella `/ (root)`. L'indirizzo che compare è quello
da aprire sul telefono. Pages serve il sito in HTTPS, requisito per l'installazione nella
schermata Home e per il funzionamento offline.

**Senza GitHub Pages**: `dist/la-mia-libreria.html` è l'app intera in un unico file, senza
alcuna risorsa esterna. Si può caricare su un qualsiasi hosting statico gratuito
(per esempio Netlify Drop, che pubblica trascinando il file nella pagina) oppure aprire
direttamente dal telefono. Rigenerarlo dopo una modifica:

```bash
node build-single.mjs
```

In questa versione mancano solo installazione con manifest e cache offline del service
worker, che hanno bisogno di file separati serviti da una cartella.
