/* ============================================================
   La Mia Libreria — logica dell'app
   Tutti i dati restano sul dispositivo (localStorage + IndexedDB).
   ============================================================ */
(function () {
'use strict';

/* ---------------------------------------------------------- utils */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const uid = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const icon = (n, cls = 'icon') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

const K = { books: 'lml.v1.books', cats: 'lml.v1.categories', set: 'lml.v1.settings',
            auth: 'lml.v1.auth', unlocked: 'lml.v1.unlocked' };
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch { toast('Memoria piena: elimina qualche copertina'); return false; } };

/* ---------------------------------------------------- copertine (IndexedDB) */
const Covers = (() => {
  const STORE = 'covers', FALLBACK = 'lml.v1.covers';
  let dbp = null, useIdb = 'indexedDB' in window;
  const mem = new Map();

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('la-mia-libreria', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }).catch(e => { useIdb = false; throw e; });
    return dbp;
  }
  const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
    const req = fn(s);
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
  }));

  return {
    map: mem,
    async init() {
      if (useIdb) {
        try {
          const db = await open();
          await new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readonly'), s = t.objectStore(STORE);
            const cur = s.openCursor();
            cur.onsuccess = e => { const c = e.target.result; if (c) { mem.set(c.key, c.value); c.continue(); } else res(); };
            cur.onerror = () => rej(cur.error);
          });
          return;
        } catch { useIdb = false; }
      }
      Object.entries(load(FALLBACK, {})).forEach(([k, v]) => mem.set(k, v));
    },
    get(id) { return mem.get(id) || null; },
    async set(id, data) {
      mem.set(id, data);
      if (useIdb) { try { await run('readwrite', s => s.put(data, id)); return; } catch { useIdb = false; } }
      save(FALLBACK, Object.fromEntries(mem));
    },
    async del(id) {
      mem.delete(id);
      if (useIdb) { try { await run('readwrite', s => s.delete(id)); return; } catch { useIdb = false; } }
      save(FALLBACK, Object.fromEntries(mem));
    },
    async clear() {
      mem.clear();
      if (useIdb) { try { await run('readwrite', s => s.clear()); } catch { useIdb = false; } }
      localStorage.removeItem(FALLBACK);
    },
    async replaceAll(obj) {
      await this.clear();
      for (const [k, v] of Object.entries(obj || {})) await this.set(k, v);
    }
  };
})();

/* ------------------------------------------------------------- password */
const Auth = (() => {
  const enc = s => new TextEncoder().encode(s);
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++)
    { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }
  async function derive(pwd, salt, algo) {
    if (algo === 'pbkdf2') {
      const key = await crypto.subtle.importKey('raw', enc(pwd), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc(salt), iterations: 150000, hash: 'SHA-256' }, key, 256);
      return b64(bits);
    }
    let out = salt + '|' + pwd;
    for (let i = 0; i < 800; i++) out = fnv(out + i);
    return out;
  }
  const canSubtle = () => !!(window.crypto && crypto.subtle && crypto.subtle.deriveBits);

  /* Password d'accesso fissa. Qui sotto c'è solo la sua impronta, mai la password
     in chiaro: il repository è pubblico e dall'impronta non si torna indietro.
     Le due varianti servono perché crypto.subtle non c'è in tutti i contesti. */
  const FIXED = {
    salt: 'la-mia-libreria-2026',
    pbkdf2: 'yqR5syX6OWL/RXwxGGQl6XSJthhCjmETFemxXpIm4lE=',
    fnv: 'd822e672'
  };

  return {
    async verify(pwd) {
      const algo = canSubtle() ? 'pbkdf2' : 'fnv';
      return (await derive(pwd, FIXED.salt, algo)) === FIXED[algo];
    },
    /* lo sblocco resta memorizzato sul dispositivo: la password si inserisce una volta
       sola e poi non viene più chiesta, finché non si usa "Blocca l'app". */
    unlock() {
      try { localStorage.setItem(K.unlocked, '1'); } catch {}
      try { sessionStorage.setItem(K.unlocked, '1'); } catch {}   // se localStorage è negato
    },
    lock() {
      try { localStorage.removeItem(K.unlocked); } catch {}
      try { sessionStorage.removeItem(K.unlocked); } catch {}
    },
    isUnlocked() {
      try { if (localStorage.getItem(K.unlocked) === '1') return true; } catch {}
      try { return sessionStorage.getItem(K.unlocked) === '1'; } catch { return false; }
    }
  };
})();

/* ---------------------------------------------------------------- stato */
const PASTELS = ['#ffd7e6','#f7dcf2','#eadffb','#dee5fb','#c9e6fb','#cdeeee','#d6f0e0',
                 '#eaf3cf','#fdf3c8','#ffe3c8','#ffd8d0','#f0e2d6','#e4e0f7','#f6d9e9'];
const CAT_ICONS = ['flower','star','heart','sparkle','moon','butterfly','cloud',
                   'crown','book','bookmark','tag','key'];
const STATES = [
  { id: 'fav',     label: 'Preferiti',    ic: 'heart-fill',   color: '#e880ac' },
  { id: 'read',    label: 'Letti',        ic: 'book',         color: '#6bb7dd' },
  { id: 'reading', label: 'In lettura',   ic: 'bookmark',     color: '#c49bdd' },
  { id: 'todo',    label: 'Da iniziare',  ic: 'star',         color: '#d8b25e' },
  { id: 'nope',    label: 'Non piaciuti', ic: 'heart-broken', color: '#a893b5' }
];

const state = {
  books: [], cats: [],
  settings: { view: '6', sort: 'title' },
  f: { q: '', states: new Set(), cats: new Set(), catsAll: false, author: '' },
  editing: null, editingCover: undefined, editingCoverUrl: undefined, editingCat: null,
  editingVols: [], volPicking: null
};

function bootData() {
  state.books = load(K.books, null);
  state.cats  = load(K.cats, null);
  state.settings = Object.assign({ view: '6', sort: 'title' }, load(K.set, {}));
  // le viste 4 e 8 non esistono più: chi le aveva scelte passa alla griglia
  if (state.settings.view !== 'list') state.settings.view = '6';
  if (!state.books || !state.cats) seed();
  else migraVolumi();
}

/* I quattro campi numerici non ci sono più: quello che contenevano finisce nelle note,
   e chi era a metà di un volume resta contrassegnato come "in lettura". */
function migraVolumi() {
  let cambiato = false;
  for (const b of state.books) {
    if (!Array.isArray(b.volumes)) { b.volumes = []; cambiato = true; }
    if (!('volTot' in b || 'volCur' in b || 'pageCur' in b || 'pageTot' in b)) continue;
    const bits = [];
    if (b.volCur) bits.push('vol. ' + b.volCur + (b.volTot ? ' di ' + b.volTot : ''));
    else if (b.volTot) bits.push(b.volTot + ' volumi');
    if (b.pageCur) bits.push('pag. ' + b.pageCur + (b.pageTot ? ' di ' + b.pageTot : ''));
    const n = norm(b.notes || '');
    const giaDetto = (!b.volCur || n.includes('vol. ' + b.volCur) || n.includes('vol.' + b.volCur)) &&
                     (!b.pageCur || n.includes('pag. ' + b.pageCur) || n.includes('pag.' + b.pageCur));
    if (bits.length && !giaDetto) b.notes = (b.notes ? b.notes + ' · ' : '') + bits.join(', ');
    if (b.reading === undefined) b.reading = !b.read && !!(b.volCur || b.pageCur);
    delete b.volTot; delete b.volCur; delete b.pageCur; delete b.pageTot;
    cambiato = true;
  }
  if (cambiato) persist();
}
/* l'avanzamento dell'elenco iniziale finisce nelle note, se non c'è già */
function seedNotes(b) {
  const bits = [];
  if (b.vc) bits.push('vol. ' + b.vc + (b.vt ? ' di ' + b.vt : ''));
  if (b.pc) bits.push('pag. ' + b.pc + (b.pt ? ' di ' + b.pt : ''));
  if (!bits.length) return b.n || '';
  const n = norm(b.n || '');
  const detto = (!b.vc || n.includes('vol. ' + b.vc) || n.includes('vol.' + b.vc)) &&
                (!b.pc || n.includes('pag. ' + b.pc) || n.includes('pag.' + b.pc));
  return detto ? (b.n || '') : (b.n ? b.n + ' · ' : '') + bits.join(', ');
}

function seed() {
  const now = Date.now();
  state.cats = window.SEED.categories.map(c => ({ ...c }));
  state.books = window.SEED.books.map((b, i) => ({
    id: uid() + i, title: b.t, author: b.a || '', cats: b.c.slice(),
    fav: !!b.fav, read: !!b.read, nope: !!b.nope,
    reading: !b.read && !!(b.vc || b.pc),
    volumes: [], notes: seedNotes(b), cover: false, coverUrl: null, created: now - (window.SEED.books.length - i) * 1000, updated: now
  }));
  persist();
}
const persist = () => { save(K.books, state.books); save(K.cats, state.cats); save(K.set, state.settings); };
const catById = id => state.cats.find(c => c.id === id);

/* -------------------------------------------------------------- helpers UI */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400);
}
function confirmBox(title, text, yes = 'Conferma') {
  return new Promise(res => {
    const box = $('#confirm');
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmYes').textContent = yes;
    box.hidden = false;
    const done = v => { box.hidden = true; $('#confirmYes').onclick = null; $('#confirmNo').onclick = null; res(v); };
    $('#confirmYes').onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
    $('#confirm .sheet__backdrop').onclick = () => done(false);
  });
}
const openSheet = id => { $('#' + id).hidden = false; document.body.style.overflow = 'hidden'; };
const closeSheet = el => { el.hidden = true; if (!$$('.sheet').some(s => !s.hidden)) document.body.style.overflow = ''; };

function bookState(b) {
  if (b.nope) return 'nope';
  if (b.read) return 'read';
  if (b.reading) return 'reading';
  return 'todo';
}
/* "preferito" e "non piaciuto" convivono con letto / in lettura:
   ognuno è una condizione a sé, i filtri scelti valgono in OR. */
const STATE_TEST = {
  fav:     b => !!b.fav,
  nope:    b => !!b.nope,
  read:    b => !!b.read,
  reading: b => !!b.reading && !b.read && !b.nope,
  todo:    b => bookState(b) === 'todo'
};
function progressText(b) {
  const n = (b.volumes || []).length;
  return n ? (n === 1 ? '1 volume' : n + ' volumi') : '';
}
function coverGradient(b) {
  const cs = b.cats.map(catById).filter(Boolean);
  const a = cs[0]?.color || '#e3d2f7', c = cs[1]?.color || '#ffd3e5';
  return `linear-gradient(150deg, ${a}, ${c})`;
}
const coverIcon = b => (catById(b.cats[0])?.icon) || 'flower';
const SKIP_WORDS = new Set(['il','lo','la','i','gli','le','un','uno','una','l','dei','del','della',
  'delle','degli','di','da','de','e','a','al','ai','the','of','and','in','per','con','su']);
function initials(title) {
  const w = String(title).replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/[\s']+/)
    .filter(x => x && !SKIP_WORDS.has(x.toLowerCase()));
  return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || '?';
}

/* ------------------------------------------------------------- filtraggio */
function filtered() {
  const q = norm(state.f.q).trim();
  const terms = q ? q.split(/\s+/) : [];
  let out = state.books.filter(b => {
    if (terms.length) {
      const hay = norm([b.title, b.author, b.notes, (b.volumes || []).map(v => v.name).join(' '),
                        b.cats.map(i => catById(i)?.name).join(' ')].join(' '));
      if (!terms.every(t => hay.includes(t))) return false;
    }
    if (state.f.states.size && ![...state.f.states].some(s => STATE_TEST[s]?.(b))) return false;
    if (state.f.cats.size) {
      const sel = [...state.f.cats];
      const ok = state.f.catsAll ? sel.every(c => b.cats.includes(c)) : sel.some(c => b.cats.includes(c));
      if (!ok) return false;
    }
    if (state.f.author && b.author !== state.f.author) return false;
    return true;
  });
  const s = state.settings.sort;
  out.sort((a, b) => {
    switch (s) {
      case 'title_desc': return collator.compare(b.title, a.title);
      case 'author': return collator.compare(a.author || 'zzz', b.author || 'zzz') || collator.compare(a.title, b.title);
      case 'recent': return b.created - a.created;
      case 'updated': return b.updated - a.updated;
      default: return collator.compare(a.title, b.title);
    }
  });
  return out;
}

/* --------------------------------------------------------------- rendering */
function render() {
  renderQuickFilters();
  renderBooks();
  renderFilterCount();
}

function renderBooks() {
  const list = filtered();
  const wrap = $('#books');
  const isList = state.settings.view === 'list';
  wrap.className = 'books' + (isList ? ' is-list' : '');
  wrap.dataset.cols = isList ? 'list' : state.settings.view;
  wrap.style.setProperty('--cols', isList ? 1 : state.settings.view);

  $('#results').textContent = list.length
    ? `${list.length} libr${list.length === 1 ? 'o' : 'i'}${state.books.length !== list.length ? ' su ' + state.books.length : ''}`
    : '';
  $('#empty').hidden = list.length > 0;

  wrap.innerHTML = list.map(b => {
    // coverUrl: copertine collegate da una versione precedente dell'app, non se ne creano più
    const cov = Covers.get(b.id) || b.coverUrl || null;
    const cats = b.cats.map(catById).filter(Boolean);
    const strip = cats.length
      ? `<div class="card__strip">${cats.slice(0, 4).map(c => `<span style="background:${esc(c.color)}"></span>`).join('')}</div>` : '';
    const badges = [
      b.fav ? `<span class="badge badge--fav">${icon('heart-fill')}</span>` : '',
      b.read ? `<span class="badge badge--read">${icon('book')}</span>` : '',
      b.nope ? `<span class="badge badge--nope">${icon('heart-broken')}</span>` : ''
    ].join('');
    const prog = progressText(b);
    return `<button class="card" data-id="${b.id}">
      <div class="card__cover" style="background:${coverGradient(b)}">
        ${cov ? `<img src="${cov}" alt="" loading="lazy">`
              : `<span class="card__ph">${icon(coverIcon(b), '')}<b class="card__init">${esc(initials(b.title))}</b></span>`}
        <div class="card__badges">${badges}</div>
        ${strip}
      </div>
      <div class="card__body">
        <p class="card__title">${esc(b.title)}</p>
        ${b.author ? `<p class="card__author">${esc(b.author)}</p>` : ''}
        ${prog ? `<p class="card__prog">${esc(prog)}</p>` : ''}
        ${isList && cats.length ? `<div class="card__cats">${cats.map(c =>
            `<span class="minicat" style="background:${esc(c.color)}">${esc(c.name)}</span>`).join('')}</div>` : ''}
      </div>
    </button>`;
  }).join('');
}

function renderQuickFilters() {
  const box = $('#quickFilters');
  const chips = [`<button class="chip chip--scroll${state.f.cats.size || state.f.states.size ? '' : ' is-on'}" data-quick="all"
      style="${state.f.cats.size || state.f.states.size ? '' : 'background:linear-gradient(135deg,#f1e6fb,#ffe7f1)'}">
      ${icon('sparkle')} Tutti</button>`];
  STATES.filter(s => s.id === 'fav' || s.id === 'read').forEach(s => {
    const on = state.f.states.has(s.id);
    chips.push(`<button class="chip chip--scroll${on ? ' is-on' : ''}" data-quick="s:${s.id}"
      style="${on ? `background:${s.color}22;color:${s.color}` : ''}">${icon(s.ic)} ${esc(s.label)}</button>`);
  });
  state.cats.forEach(c => {
    const on = state.f.cats.has(c.id);
    const n = state.books.filter(b => b.cats.includes(c.id)).length;
    chips.push(`<button class="chip chip--scroll${on ? ' is-on' : ''}" data-quick="c:${c.id}"
      style="background:${esc(c.color)}${on ? '' : '80'}">${icon(c.icon)} ${esc(c.name)} <b>${n}</b></button>`);
  });
  box.innerHTML = chips.join('');
}

function renderFilterCount() {
  const n = state.f.states.size + state.f.cats.size + (state.f.author ? 1 : 0);
  const el = $('#filterCount');
  el.hidden = n === 0; el.textContent = n;
  $('#btnFilters').classList.toggle('is-on', n > 0);
  $$('.viewswitch__btn').forEach(b => b.classList.toggle('is-on', b.dataset.view === state.settings.view));
}

/* ------------------------------------------------------------ filtri sheet */
function renderFiltersSheet() {
  $('#filterStates').innerHTML = STATES.map(s => {
    const on = state.f.states.has(s.id);
    return `<button type="button" class="chip${on ? ' is-on' : ''}" data-fstate="${s.id}"
      style="${on ? `background:${s.color}26;color:${s.color}` : ''}">${icon(s.ic)} ${esc(s.label)}</button>`;
  }).join('');
  $('#filterCats').innerHTML = state.cats.map(c => {
    const on = state.f.cats.has(c.id);
    return `<button type="button" class="chip${on ? ' is-on' : ''}" data-fcat="${c.id}"
      style="background:${esc(c.color)}${on ? '' : '80'}">${icon(c.icon)} ${esc(c.name)}</button>`;
  }).join('');
  $('#filterCatsAll').checked = state.f.catsAll;

  const authors = [...new Set(state.books.map(b => b.author).filter(Boolean))].sort(collator.compare);
  $('#filterAuthor').innerHTML = `<option value="">Tutte le autrici</option>` +
    authors.map(a => `<option value="${esc(a)}"${a === state.f.author ? ' selected' : ''}>${esc(a)}</option>`).join('');
  $('#filterSort').value = state.settings.sort;
}

/* ------------------------------------------------------------- scheda libro */
function openBook(id) {
  const b = id ? state.books.find(x => x.id === id) : null;
  state.editing = b ? b.id : null;
  state.editingCover = undefined;
  state.editingCoverUrl = undefined;
  $('#bookSheetTitle').innerHTML = icon('book') + (b ? ' Modifica scheda' : ' Nuovo libro');
  $('#fTitle').value = b?.title || '';
  $('#fAuthor').value = b?.author || '';
  $('#fNotes').value = b?.notes || '';
  $('#bookDelete').hidden = !b;

  state.editingVols = (b?.volumes || []).map(v => ({ id: v.id, name: v.name, data: undefined }));
  const flags = { fav: !!b?.fav, reading: !!b?.reading, read: !!b?.read, nope: !!b?.nope };
  $('#bookStates').dataset.flags = JSON.stringify(flags);
  $('#bookCats').dataset.sel = JSON.stringify(b?.cats || []);
  renderBookFlags(); renderBookCats(); renderVolumes(); renderCoverPreview(b);

  $('#authorsList').innerHTML = [...new Set(state.books.map(x => x.author).filter(Boolean))]
    .sort(collator.compare).map(a => `<option value="${esc(a)}">`).join('');
  openSheet('sheetBook');
  if (!b) setTimeout(() => $('#fTitle').focus(), 250);
}
function bookFlags() { return JSON.parse($('#bookStates').dataset.flags || '{}'); }
function renderBookFlags() {
  const f = bookFlags();
  const items = [
    { id: 'fav', label: 'Preferito', ic: 'heart-fill', color: '#e880ac' },
    { id: 'reading', label: 'In lettura', ic: 'bookmark', color: '#c49bdd' },
    { id: 'read', label: 'Letto', ic: 'book', color: '#6bb7dd' },
    { id: 'nope', label: 'Non mi è piaciuto', ic: 'heart-broken', color: '#a893b5' }
  ];
  $('#bookStates').innerHTML = items.map(i => `<button type="button" class="chip${f[i.id] ? ' is-on' : ''}"
    data-flag="${i.id}" style="${f[i.id] ? `background:${i.color}26;color:${i.color}` : ''}">
    ${icon(i.ic)} ${esc(i.label)}</button>`).join('');
}
function bookCatsSel() { return JSON.parse($('#bookCats').dataset.sel || '[]'); }
function renderBookCats() {
  const sel = bookCatsSel();
  $('#bookCats').innerHTML = state.cats.map(c => {
    const on = sel.includes(c.id);
    return `<button type="button" class="chip${on ? ' is-on' : ''}" data-bcat="${c.id}"
      style="background:${esc(c.color)}${on ? '' : '80'}">${icon(c.icon)} ${esc(c.name)}${on ? ' ' + icon('check') : ''}</button>`;
  }).join('') + `<button type="button" class="chip" data-newcat="1">${icon('plus')} Nuova</button>`;
}
/* ---- volumi della serie: copertina + nome, uno per riga ---- */
function renderVolumes() {
  const list = $('#volList');
  list.innerHTML = state.editingVols.map((v, i) => {
    const img = v.data !== undefined ? v.data : Covers.get(v.id);
    return `<div class="volrow" data-vol="${i}">
      <button type="button" class="volrow__cover" data-volpic="${i}"
              aria-label="Copertina del volume">
        ${img ? `<img src="${img}" alt="">` : icon('image', 'icon')}
      </button>
      <input type="text" class="input volrow__name" data-volname="${i}"
             value="${esc(v.name)}" placeholder="Nome del volume">
      <button type="button" class="icon-btn icon-btn--ghost" data-voldel="${i}"
              aria-label="Elimina volume">${icon('trash')}</button>
    </div>`;
  }).join('') || `<p class="hint hint--empty">Nessun volume. Aggiungili qui sotto: per ognuno
    puoi mettere la copertina e il nome.</p>`;
}

function renderCoverPreview(b) {
  const box = $('#coverPreview');
  const data = (state.editingCover !== undefined ? state.editingCover : (b ? Covers.get(b.id) : null))
    || (state.editingCoverUrl !== undefined ? state.editingCoverUrl : (b ? b.coverUrl : null));
  const fake = { cats: bookCatsSel() };
  box.style.background = coverGradient(fake);
  box.innerHTML = data
    ? `<img src="${data}" alt="">`
    : `<span class="card__ph">${icon(catById(bookCatsSel()[0])?.icon || 'flower', '')}
       <b class="card__init">${esc(initials($('#fTitle').value || '?'))}</b></span>`;
}

async function saveBook() {
  const title = $('#fTitle').value.trim();
  if (!title) { toast('Serve almeno il titolo'); $('#fTitle').focus(); return; }
  const f = bookFlags();
  let b = state.books.find(x => x.id === state.editing);
  const isNew = !b;
  if (isNew) { b = { id: uid(), created: Date.now(), cover: false, volumes: [] }; state.books.push(b); }
  // volumi tolti dall'elenco: via anche le loro copertine
  for (const v of (b.volumes || []))
    if (!state.editingVols.some(x => x.id === v.id)) await Covers.del(v.id);
  for (const v of state.editingVols) {
    if (v.data !== undefined) {
      if (v.data) await Covers.set(v.id, v.data); else await Covers.del(v.id);
    }
  }
  Object.assign(b, {
    title, author: $('#fAuthor').value.trim(), cats: bookCatsSel(),
    fav: !!f.fav, reading: !!f.reading, read: !!f.read, nope: !!f.nope,
    volumes: state.editingVols.map(v => ({ id: v.id, name: v.name.trim(), cover: !!Covers.get(v.id) })),
    notes: $('#fNotes').value.trim(), updated: Date.now()
  });
  if (state.editingCover !== undefined) {
    if (state.editingCover) { await Covers.set(b.id, state.editingCover); b.cover = true; }
    else { await Covers.del(b.id); b.cover = false; }
  }
  if (state.editingCoverUrl !== undefined) b.coverUrl = state.editingCoverUrl;
  persist(); render();
  closeSheet($('#sheetBook'));
  toast(isNew ? 'Libro aggiunto' : 'Scheda aggiornata');
}

/* ------------------------------------------------------------- immagini */
function readImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = e => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}
async function processImage(file) {
  const img = await readImage(file);
  const MAX_W = 420, MAX_H = 630;
  let { width: w, height: h } = img;
  const r = Math.min(MAX_W / w, MAX_H / h, 1);
  w = Math.round(w * r); h = Math.round(h * r);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.78);
}

/* ------------------------------------------------------------- categorie */
function renderCatList() {
  $('#catList').innerHTML = state.cats.map(c => {
    const n = state.books.filter(b => b.cats.includes(c.id)).length;
    return `<div class="catrow" data-cat="${c.id}">
      <span class="catrow__grip" data-grip role="button" tabindex="-1"
            aria-label="Trascina per riordinare">${icon('grip')}</span>
      <span class="catrow__dot" style="background:${esc(c.color)}">${icon(c.icon)}</span>
      <span class="catrow__name">${esc(c.name)}</span>
      <span class="catrow__n">${n}</span>
      <button class="icon-btn icon-btn--ghost" data-editcat="${c.id}" aria-label="Modifica">${icon('pencil')}</button>
    </div>`;
  }).join('') || `<p class="hint">Nessuna categoria: creane una qui sotto.</p>`;
}
/* ---- riordino delle categorie trascinando la maniglia ----
   Pointer Events invece del drag&drop HTML5, che sui browser mobili non funziona.
   La maniglia ha touch-action:none, così il dito trascina la riga e non scorre la pagina. */
let drag = null, dragEndedAt = 0;
function wireCatDrag() {
  const list = $('#catList');
  const rowsAround = row => [row.previousElementSibling, row.nextElementSibling];
  const midOf = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };

  const autoScroll = () => {
    if (!drag) return;
    const box = drag.scroller.getBoundingClientRect();
    const margin = 56, speed = 9;
    if (drag.y < box.top + margin) drag.scroller.scrollTop -= speed;
    else if (drag.y > box.bottom - margin) drag.scroller.scrollTop += speed;
    drag.raf = requestAnimationFrame(autoScroll);
  };

  list.addEventListener('pointerdown', e => {
    const grip = e.target.closest('[data-grip]');
    if (!grip || e.button > 0) return;
    const row = grip.closest('.catrow');
    if (!row || list.children.length < 2) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    drag = { row, grip, id: e.pointerId, startY: e.clientY, y: e.clientY, moved: false, raf: 0,
             scroller: list.closest('.sheet__body') };
    row.classList.add('is-dragging');
    document.body.classList.add('is-sorting');
    drag.raf = requestAnimationFrame(autoScroll);
  });

  list.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.y = e.clientY;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dy) > 4) drag.moved = true;
    drag.row.style.transform = `translateY(${dy}px)`;

    // superato il centro del vicino, la riga prende il suo posto
    const mid = midOf(drag.row);
    const [prev, next] = rowsAround(drag.row);
    const wasAt = drag.row.getBoundingClientRect().top;
    let swapped = false;
    if (prev && mid < midOf(prev)) { list.insertBefore(drag.row, prev); swapped = true; }
    else if (next && mid > midOf(next)) { list.insertBefore(next, drag.row); swapped = true; }
    if (swapped) {
      // lo scambio sposta la riga nel layout: correggo l'origine così resta
      // ferma sotto il dito e il trascinamento prosegue senza scatti
      const shift = drag.row.getBoundingClientRect().top - wasAt;
      drag.startY += shift;
      drag.row.style.transform = `translateY(${e.clientY - drag.startY}px)`;
    }
  });

  const end = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    cancelAnimationFrame(drag.raf);
    drag.row.style.transform = '';
    drag.row.classList.remove('is-dragging');
    document.body.classList.remove('is-sorting');
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    dragEndedAt = Date.now();
    const order = $$('.catrow', list).map(r => r.dataset.cat);
    state.cats.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    persist();
    renderCatList();
    render();          // chip in alto e filtri seguono il nuovo ordine
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function openCat(id) {
  const c = id ? catById(id) : null;
  state.editingCat = { id: c?.id || null, name: c?.name || '', color: c?.color || PASTELS[0], icon: c?.icon || 'flower' };
  $('#catEditTitle').innerHTML = icon('palette') + (c ? ' Modifica categoria' : ' Nuova categoria');
  $('#catName').value = state.editingCat.name;
  $('#catDelete').hidden = !c;
  renderCatEditor();
  openSheet('sheetCatEdit');
  if (!c) setTimeout(() => $('#catName').focus(), 250);
}
function renderCatEditor() {
  const e = state.editingCat;
  $('#catSwatches').innerHTML = PASTELS.map(p =>
    `<button type="button" class="swatch${p.toLowerCase() === e.color.toLowerCase() ? ' is-on' : ''}"
      data-color="${p}" style="background:${p}" aria-label="colore ${p}">${icon('check')}</button>`).join('');
  $('#catIcons').innerHTML = CAT_ICONS.map(i =>
    `<button type="button" class="${i === e.icon ? 'is-on' : ''}" data-caticon="${i}" aria-label="${i}">${icon(i)}</button>`).join('');
  $('#catPreview').innerHTML = `<span class="chip is-on" style="background:${esc(e.color)}">
    ${icon(e.icon)} ${esc($('#catName').value.trim() || e.name || 'Anteprima')}</span>`;
}
function saveCat() {
  const name = $('#catName').value.trim();
  if (!name) { toast('Dai un nome alla categoria'); $('#catName').focus(); return; }
  const e = state.editingCat;
  if (e.id) Object.assign(catById(e.id), { name, color: e.color, icon: e.icon });
  else state.cats.push({ id: 'c' + Date.now().toString(36), name, color: e.color, icon: e.icon });
  persist(); renderCatList(); render();
  closeSheet($('#sheetCatEdit'));
  toast('Categoria salvata');
}

/* ------------------------------------------------------------- impostazioni */
function renderStats() {
  const b = state.books;
  const s = [
    ['Libri in archivio', b.length],
    ['Letti', b.filter(x => x.read).length],
    ['Preferiti', b.filter(x => x.fav).length],
    ['In lettura', b.filter(x => bookState(x) === 'reading').length],
    ['Da iniziare', b.filter(x => bookState(x) === 'todo').length],
    ['Categorie', state.cats.length]
  ];
  $('#stats').innerHTML = s.map(([l, n]) =>
    `<div class="stat"><p class="stat__n">${n}</p><p class="stat__l">${l}</p></div>`).join('');
}
function exportData() {
  const data = {
    app: 'la-mia-libreria', version: 1, exportedAt: new Date().toISOString(),
    categories: state.cats, books: state.books, covers: Object.fromEntries(Covers.map)
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `la-mia-libreria-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup esportato');
}
async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.books) || !Array.isArray(data.categories)) throw new Error('formato');
    if (!await confirmBox('Importare il backup?',
      `Verranno sostituiti i ${state.books.length} libri attuali con i ${data.books.length} del backup.`, 'Importa')) return;
    state.books = data.books; state.cats = data.categories;
    await Covers.replaceAll(data.covers);
    persist(); render(); renderCatList(); renderStats();
    toast('Backup importato');
  } catch { toast('File non valido'); }
}

/* ------------------------------------------------------------------ lock */
function showLock() {
  $('#app').hidden = true;
  $('#lock').hidden = false;
  $('#lockError').hidden = true;
  $('#pwdInput').value = '';
  setTimeout(() => $('#pwdInput').focus(), 300);
}
function enterApp() {
  $('#lock').hidden = true;
  $('#app').hidden = false;
  render();
}

/* ---------------------------------------------------------------- eventi */
function wire() {
  /* --- lock --- */
  $('#lockForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#lockError');
    if (await Auth.verify($('#pwdInput').value)) { Auth.unlock(); enterApp(); return; }
    err.textContent = 'Password non corretta'; err.hidden = false;
    $('#lockForm').classList.remove('shake');
    void $('#lockForm').offsetWidth;
    $('#lockForm').classList.add('shake');
  });
  $('#pwdToggle').addEventListener('click', () => {
    const i = $('#pwdInput'), show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    $('#pwdToggle').innerHTML = icon(show ? 'eye-off' : 'eye');
    i.focus();
  });

  /* --- ricerca --- */
  let searchT;
  $('#search').addEventListener('input', e => {
    $('#searchClear').hidden = !e.target.value;
    clearTimeout(searchT);
    searchT = setTimeout(() => { state.f.q = e.target.value; renderBooks(); }, 140);
  });
  $('#searchClear').addEventListener('click', () => {
    $('#search').value = ''; $('#searchClear').hidden = true; state.f.q = ''; renderBooks();
  });

  /* --- vista --- */
  $$('.viewswitch__btn').forEach(b => b.addEventListener('click', () => {
    state.settings.view = b.dataset.view; persist(); renderBooks(); renderFilterCount();
  }));

  /* --- filtri rapidi --- */
  $('#quickFilters').addEventListener('click', e => {
    const btn = e.target.closest('[data-quick]'); if (!btn) return;
    const v = btn.dataset.quick;
    if (v === 'all') { state.f.cats.clear(); state.f.states.clear(); state.f.author = ''; }
    else if (v.startsWith('c:')) { const id = v.slice(2); state.f.cats.has(id) ? state.f.cats.delete(id) : state.f.cats.add(id); }
    else { const id = v.slice(2); state.f.states.has(id) ? state.f.states.delete(id) : state.f.states.add(id); }
    render();
  });

  /* --- sheet filtri --- */
  $('#btnFilters').addEventListener('click', () => { renderFiltersSheet(); openSheet('sheetFilters'); });
  $('#filterStates').addEventListener('click', e => {
    const b = e.target.closest('[data-fstate]'); if (!b) return;
    const id = b.dataset.fstate;
    state.f.states.has(id) ? state.f.states.delete(id) : state.f.states.add(id);
    renderFiltersSheet(); render();
  });
  $('#filterCats').addEventListener('click', e => {
    const b = e.target.closest('[data-fcat]'); if (!b) return;
    const id = b.dataset.fcat;
    state.f.cats.has(id) ? state.f.cats.delete(id) : state.f.cats.add(id);
    renderFiltersSheet(); render();
  });
  $('#filterCatsAll').addEventListener('change', e => { state.f.catsAll = e.target.checked; render(); });
  $('#filterAuthor').addEventListener('change', e => { state.f.author = e.target.value; render(); });
  $('#filterSort').addEventListener('change', e => { state.settings.sort = e.target.value; persist(); render(); });
  $('#filtersReset').addEventListener('click', () => {
    state.f.states.clear(); state.f.cats.clear(); state.f.author = ''; state.f.catsAll = false;
    renderFiltersSheet(); render();
  });

  /* --- libri --- */
  $('#books').addEventListener('click', e => {
    const c = e.target.closest('.card'); if (c) openBook(c.dataset.id);
  });
  $('#btnAdd').addEventListener('click', () => openBook(null));
  $('#bookSave').addEventListener('click', saveBook);
  $('#bookForm').addEventListener('submit', e => { e.preventDefault(); saveBook(); });
  $('#bookStates').addEventListener('click', e => {
    const b = e.target.closest('[data-flag]'); if (!b) return;
    const f = bookFlags(); const k = b.dataset.flag;
    f[k] = !f[k];
    if (k === 'nope' && f.nope) f.fav = false;
    if (k === 'fav' && f.fav) f.nope = false;
    if (k === 'read' && f.read) f.reading = false;      // finito: non è più in lettura
    if (k === 'reading' && f.reading) f.read = false;
    $('#bookStates').dataset.flags = JSON.stringify(f);
    renderBookFlags();
  });
  $('#bookCats').addEventListener('click', e => {
    if (e.target.closest('[data-newcat]')) { openCat(null); return; }
    const b = e.target.closest('[data-bcat]'); if (!b) return;
    const sel = bookCatsSel(); const id = b.dataset.bcat;
    const i = sel.indexOf(id);
    i >= 0 ? sel.splice(i, 1) : sel.push(id);
    $('#bookCats').dataset.sel = JSON.stringify(sel);
    renderBookCats();
    renderCoverPreview(state.books.find(x => x.id === state.editing));
  });
  $('#coverInput').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      state.editingCover = await processImage(file);
      state.editingCoverUrl = null;
      renderCoverPreview(state.books.find(x => x.id === state.editing));
    } catch { toast('Immagine non leggibile'); }
    e.target.value = '';
  });
  /* --- volumi della serie --- */
  $('#volAdd').addEventListener('click', () => {
    state.editingVols.push({ id: 'v' + uid(), name: '', data: undefined });
    renderVolumes();
    const last = $$('.volrow__name').pop();
    if (last) last.focus();
  });
  $('#volList').addEventListener('input', e => {
    const inp = e.target.closest('[data-volname]'); if (!inp) return;
    state.editingVols[+inp.dataset.volname].name = inp.value;   // niente ridisegno: perderebbe il cursore
  });
  $('#volList').addEventListener('click', e => {
    const pic = e.target.closest('[data-volpic]');
    if (pic) { state.volPicking = +pic.dataset.volpic; $('#volCoverInput').click(); return; }
    const del = e.target.closest('[data-voldel]');
    if (del) { state.editingVols.splice(+del.dataset.voldel, 1); renderVolumes(); }
  });
  $('#volCoverInput').addEventListener('change', async e => {
    const file = e.target.files[0], i = state.volPicking;
    e.target.value = '';
    if (!file || i == null || !state.editingVols[i]) return;
    try { state.editingVols[i].data = await processImage(file); renderVolumes(); }
    catch { toast('Immagine non leggibile'); }
  });

  $('#coverRemove').addEventListener('click', () => {
    state.editingCover = null;
    state.editingCoverUrl = null;
    renderCoverPreview(state.books.find(x => x.id === state.editing));
  });
  $('#bookDelete').addEventListener('click', async () => {
    const b = state.books.find(x => x.id === state.editing); if (!b) return;
    if (!await confirmBox('Eliminare il libro?', `«${b.title}» verrà rimosso dall'archivio.`, 'Elimina')) return;
    await Covers.del(b.id);
    for (const v of (b.volumes || [])) await Covers.del(v.id);
    state.books = state.books.filter(x => x.id !== b.id);
    persist(); render(); closeSheet($('#sheetBook')); toast('Libro eliminato');
  });

  /* --- categorie --- */
  $('#btnCategories').addEventListener('click', () => { renderCatList(); openSheet('sheetCats'); });
  $('#catAdd').addEventListener('click', () => openCat(null));
  $('#catList').addEventListener('click', e => {
    if (e.target.closest('[data-grip]') || Date.now() - dragEndedAt < 300) return;
    const row = e.target.closest('[data-cat]'); if (!row) return;
    openCat(row.dataset.cat);
  });
  wireCatDrag();
  $('#catSwatches').addEventListener('click', e => {
    const b = e.target.closest('[data-color]'); if (!b) return;
    state.editingCat.color = b.dataset.color; renderCatEditor();
  });
  $('#catHue').addEventListener('input', e => {
    state.editingCat.color = hslToHex(+e.target.value, 72, 88); renderCatEditor();
  });
  $('#catIcons').addEventListener('click', e => {
    const b = e.target.closest('[data-caticon]'); if (!b) return;
    state.editingCat.icon = b.dataset.caticon; renderCatEditor();
  });
  $('#catName').addEventListener('input', renderCatEditor);
  $('#catSave').addEventListener('click', saveCat);
  $('#catForm').addEventListener('submit', e => { e.preventDefault(); saveCat(); });
  $('#catDelete').addEventListener('click', async () => {
    const c = catById(state.editingCat.id); if (!c) return;
    const n = state.books.filter(b => b.cats.includes(c.id)).length;
    if (!await confirmBox('Eliminare la categoria?',
      `«${c.name}» verrà tolta da ${n} libr${n === 1 ? 'o' : 'i'}. I libri restano nell'archivio.`, 'Elimina')) return;
    state.cats = state.cats.filter(x => x.id !== c.id);
    state.books.forEach(b => { b.cats = b.cats.filter(x => x !== c.id); });
    state.f.cats.delete(c.id);
    persist(); renderCatList(); render();
    closeSheet($('#sheetCatEdit'));
    toast('Categoria eliminata');
  });

  /* --- impostazioni --- */
  $('#btnSettings').addEventListener('click', () => { renderStats(); openSheet('sheetSettings'); });
  $('#btnExport').addEventListener('click', exportData);
  $('#importInput').addEventListener('change', e => {
    const f = e.target.files[0]; if (f) importData(f); e.target.value = '';
  });
  $('#btnRestoreSeed').addEventListener('click', async () => {
    if (!await confirmBox('Ripristinare l\'elenco iniziale?',
      'I libri e le categorie attuali verranno sostituiti con l\'elenco di partenza.', 'Ripristina')) return;
    await Covers.clear(); seed(); render(); renderStats(); renderCatList(); toast('Elenco iniziale ripristinato');
  });
  $('#btnWipe').addEventListener('click', async () => {
    if (!await confirmBox('Cancellare tutto?',
      'Verranno eliminati tutti i libri, le categorie e le copertine. Operazione non annullabile.', 'Cancella')) return;
    await Covers.clear();
    state.books = []; state.cats = [];
    persist(); render(); renderStats(); renderCatList(); toast('Archivio svuotato');
  });
  $('#btnLock').addEventListener('click', () => {
    Auth.lock(); $$('.sheet').forEach(closeSheet); showLock();
  });

  /* --- il titolo aggiorna il monogramma dell'anteprima --- */
  $('#fTitle').addEventListener('input', () => {
    if (state.editingCover === undefined && !(state.editing && Covers.get(state.editing)))
      renderCoverPreview(state.books.find(x => x.id === state.editing));
  });

  /* --- chiusura sheet --- */
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]'); if (!c) return;
    const sheet = c.closest('.sheet'); if (sheet) closeSheet(sheet);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = $$('.sheet').filter(s => !s.hidden).pop();
    if (open) closeSheet(open);
  });
}

/* ------------------------------------------------------------------ avvio
   index.html e app.js devono venire dalla stessa pubblicazione: se la cache ne
   ha tenuto uno vecchio l'app si romperebbe, quindi si accorge del disallineamento,
   svuota la cache e ricarica una volta sola. Alzare il numero in entrambi i file. */
const APP_VERSION = '2';

async function ripulisciCacheVecchia() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {}
  location.reload();
}

function versioniAllineate() {
  const htmlV = document.body.dataset.version;
  if (htmlV === APP_VERSION) { try { sessionStorage.removeItem('lml.riparo'); } catch {} return true; }
  let giaProvato = false;
  try { giaProvato = sessionStorage.getItem('lml.riparo') === '1'; } catch {}
  if (!giaProvato) {
    try { sessionStorage.setItem('lml.riparo', '1'); } catch {}
    ripulisciCacheVecchia();
  } else {
    document.body.innerHTML = '<div class="ricarica"><p>L\'app è stata aggiornata.</p>' +
      '<p>Chiudila del tutto e riaprila per completare l\'aggiornamento.</p></div>';
  }
  return false;
}

(async function init() {
  if (!versioniAllineate()) return;
  bootData();
  await Covers.init();
  wire();
  localStorage.removeItem(K.auth);   // ripulisce la password scelta dalle versioni precedenti
  if (Auth.isUnlocked()) enterApp();
  else showLock();

  // registrazione del service worker (init è async: la 'load' può essere già passata)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const reg = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    if (document.readyState === 'complete') reg();
    else window.addEventListener('load', reg, { once: true });
  }
})();

})();
