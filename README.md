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

Al primo avvio scegli la password (minimo 4 caratteri) e, se vuoi, un suggerimento.
Da quel momento serve per entrare. La password non viene salvata in chiaro: si conserva
solo la sua impronta (PBKDF2-SHA256 con 150.000 iterazioni), quindi **non è recuperabile** —
se la dimentichi resta il suggerimento, altrimenti bisogna ripartire da zero.
L'app si riblocca da sola dopo 15 minuti in secondo piano, oppure con
*Impostazioni → Blocca l'app*.

### La griglia

In alto a destra si sceglie come vedere i libri:

| Vista | Cosa mostra |
|---|---|
| ☰ Elenco | riga per riga, con autrice, avanzamento e categorie |
| 4 | 4 per riga: copertina, titolo, autrice, avanzamento |
| 6 | 6 per riga: copertina e titolo breve |
| 8 | 8 per riga: mosaico di sole copertine |

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

### Categorie

Dall'icona 🏷️ in alto: crea, rinomina, elimina, scegli l'icona (fiore, stella, cuore,
scintille, luna, farfalla, nuvola, corona, libro, segnalibro…) e il colore fra 14 pastelli
o con il cursore *Colore libero*, che genera solo tonalità pastello.
Un libro può stare in **più categorie** insieme: alcuni titoli dell'elenco iniziale, per
esempio, sono sia in *«In attesa di nuove uscite»* sia in *«Preferiti finiti»*.
Eliminando una categoria i libri restano, perdono solo quell'etichetta.

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
manifest.webmanifest    installazione come app
icons/                  icona dell'app (SVG + PNG)
```

Nessuna dipendenza esterna, nessun passaggio di build: sono file statici.

**Dove finiscono i dati:** libri, categorie e impostazioni in `localStorage`; le copertine
in `IndexedDB` (con ripiego su `localStorage` se non disponibile); lo sblocco della
sessione in `sessionStorage`.

## Provarla sul computer

Serve un server locale (il service worker e IndexedDB non funzionano aprendo il file
direttamente da disco):

```bash
npx http-server -p 8080 .
# poi apri http://127.0.0.1:8080
```

## Pubblicarla su GitHub Pages

Impostazioni del repository → *Pages* → *Deploy from a branch* → branch
`claude/la-mia-libreria-app-vrkzf5` (o `main`), cartella `/root`.
L'indirizzo che ne esce è quello da aprire sul telefono. Pages serve il sito in HTTPS,
requisito necessario per l'installazione e per il funzionamento offline.
