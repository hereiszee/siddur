import { HDate, months } from '@hebcal/core';
import { computeDay, shirShelYom } from './day.js';
import { zmanimFor, currentService, hebrewDayOffset } from './zmanim.js';
import { readingFor } from './leyning.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t);
  if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

const store = {
  get(k, d) { try { const v = localStorage.getItem('siddur.' + k);
    return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('siddur.' + k, JSON.stringify(v)); }
    catch (e) {} },
};

/* Keter YG was the original default; it reads thin on a phone and its nikud
 * crowds the letters, so anyone still carrying that preference is moved over --
 * and the move is written back, so this runs once rather than every load. */
/* Keter YG read thin at phone sizes.  Stam was worse than thin: it maps every
 * nikud and ta'am to an empty glyph, so choosing it as the body face silently
 * stripped the vowels out of the siddur.  It survives as a leyning mode, where
 * unpointed is what a sefer Torah actually looks like. */
const DROPPED_FONTS = ['keter', 'hadasim', 'stam'];

function migrateFont(store) {
  let f = store.get('font', 'ezra');
  if (DROPPED_FONTS.includes(f)) {
    f = 'ezra';
    store.set('font', f);
  }
  return f;
}

const S = {
  nusach:   store.get('nusach', 'ashkenaz'),
  israel:   store.get('israel', false),
  minyan:   store.get('minyan', true),
  notes:    store.get('notes', true),
  variants: store.get('variants', false),
  tikkun:   store.get('tikkun', 'menukad'),
  wake:     store.get('wake', false),
  font:     'ezra',        // replaced below, once the store is readable
  size:     store.get('size', 21),
  loc:      store.get('loc', null),
  service:  null,
  auto:     true,
};

let DATA = null, OUTLINE = null, LEYNING = null, DAY = null, Z = null;

/* ---------- conditions ------------------------------------------------ */

const NEVER = new Set(['shabbat']);

function condActive(cond) {
  if (!cond) return true;
  return cond.split('+').every((part) => {
    if (NEVER.has(part)) return false;
    if (part === 'with_minyan') return S.minyan;
    if (part === 'eretz_yisrael') return S.israel;
    if (part === 'chutz_laaretz') return !S.israel;
    if (DAY.conds.has(part)) return true;
    return KNOWN.has(part) ? false : true;   // unknown -> show, and mark it
  });
}

const KNOWN = new Set(['rosh_chodesh', 'chol_hamoed', 'chanukah', 'purim',
  'yaaleh', 'al_hanisim', 'aneinu', 'nachem', 'aseret', 'pesach', 'sukkot',
  'shavuot', 'shmini_atzeret', 'summer_geshem', 'winter_geshem', 'summer_tal',
  'winter_tal', 'motzaei_shabbat', 'with_minyan', 'eretz_yisrael',
  'chutz_laaretz', 'shabbat']);

function sectionVisible(cond, serviceKey) {
  switch (cond) {
    case 'always': return true;
    case 'never': return false;
    case 'tachanun':
      return serviceKey === 'mincha' ? DAY.tachanun.mincha : DAY.tachanun.shacharit;
    case 'avinu_malkenu':
      return DAY.conds.has('aneinu') || DAY.conds.has('aseret');
    case 'torah_reading': return DAY.torahReading;
    case 'hallel': return DAY.hallel.kind !== 'none';
    case 'musaf': return !!DAY.musaf;
    case 'rosh_chodesh': return DAY.conds.has('rosh_chodesh');
    case 'omer': return !!DAY.omer;
    case 'kiddush_levana': return kiddushLevanaWindow();
    case 'bedtime': return false;              // its own view
    case 'motzaei_shabbat': return DAY.conds.has('motzaei_shabbat');
    default: return true;
  }
}

function kiddushLevanaWindow() {
  const d = DAY.hd.getDate();
  return d >= 3 && d <= 16;
}

/* ---------- rendering -------------------------------------------------- */

function renderItems(items) {
  const frag = document.createDocumentFragment();
  let para = null;
  const closePara = () => { if (para) { frag.appendChild(para); para = null; } };

  for (const it of items) {
    if (it.type === 'note') {
      if (!S.notes) continue;
      closePara();
      frag.appendChild(el('p', 'note', it.html));
      continue;
    }
    const active = condActive(it.cond);
    const unresolved = it.cond &&
      it.cond.split('+').some((p) => !KNOWN.has(p) && p !== 'with_minyan');

    if (it.type === 'rubric') {
      if (!active && !S.variants) continue;
      const r = el('span', 'rubric' + (active ? ' on' : ' off'), it.html);
      if (it.inline && para) { para.appendChild(r); para.append(' '); }
      else { closePara(); const p = el('p', 'rubric-line'); p.appendChild(r);
             frag.appendChild(p); }
      continue;
    }

    if (!active && !S.variants) continue;

    const cls = ['t'];
    if (it.cond) cls.push(active ? 'ins-on' : 'ins-off');
    if (unresolved) cls.push('unresolved');

    if (it.inline) {
      if (!para) para = el('p', 'flow');
      const span = el('span', cls.join(' '), it.html);
      if (it.cond) span.title = reasonFor(it.cond, active);
      para.appendChild(span); para.append(' ');
    } else {
      closePara();
      const p = el('p', cls.join(' '), it.html);
      if (it.cond) p.title = reasonFor(it.cond, active);
      frag.appendChild(p);
    }
  }
  closePara();
  return frag;
}

function reasonFor(cond, active) {
  const parts = cond.split('+').map((p) => DAY.conds.get(p) || p);
  return (active ? 'נֶאֱמָר — ' : 'לֹא הַיּוֹם — ') + parts.join(' · ');
}

function renderSection(sec) {
  const wrap = el('section', 'sec');
  wrap.id = 'sec-' + sec.id;
  wrap.appendChild(el('h2', null, sec.he || sec.en));
  wrap.appendChild(renderItems(sec.items));
  return wrap;
}

function renderLeyning() {
  const wrap = el('section', 'sec leyning');
  const reading = readingFor(DAY.hd, S.israel, LEYNING);
  if (!reading) return null;
  const main = reading.find((r) => !r.isMincha) || reading[0];
  wrap.appendChild(el('h2', null, 'קְרִיאַת הַתּוֹרָה'));
  wrap.appendChild(el('p', 'why', main.he + ' · ' + main.summary));
  for (const a of main.aliyot) {
    wrap.appendChild(el('h3', 'aliyah', aliyahName(a.n)));
    const text = a.verses.join(' ');
    const box = el('div', 'tikkun');
    if (S.tikkun === 'both') {
      box.appendChild(el('div', 'lbl', 'מְנֻקָּד'));
      box.appendChild(el('p', 't taamim', text));
      box.appendChild(el('div', 'lbl', 'כְּתָב אַשּׁוּרִי'));
      box.appendChild(el('p', 't ashurit', stripPoints(text)));
    } else if (S.tikkun === 'ashurit') {
      box.appendChild(el('p', 't ashurit', stripPoints(text)));
    } else {
      box.appendChild(el('p', 't taamim', text));
    }
    wrap.appendChild(box);
  }
  return wrap;
}

/* Ashurit renders every point as an empty glyph, so they would take no space
 * but still affect line breaking and copy/paste.  Strip them properly -- but a
 * maqaf joins two words that a sefer Torah writes apart, so it becomes a space
 * rather than nothing, and sof pasuq simply has no counterpart in the scroll. */
const POINTS = /[\u0591-\u05BD\u05BF-\u05C7]/g;
const MAQAF = /\u05BE/g;
const stripPoints = (t) =>
  t.replace(MAQAF, ' ').replace(POINTS, '').replace(/\s{2,}/g, ' ').trim();

const ALIYOT = { 1: 'כֹּהֵן', 2: 'לֵוִי', 3: 'שְׁלִישִׁי', 4: 'רְבִיעִי',
                 5: 'חֲמִישִׁי', 6: 'שִׁשִּׁי', 7: 'שְׁבִיעִי', M: 'מַפְטִיר' };
const aliyahName = (n) => ALIYOT[n] || n;

/* Re-draw the current service in place, keeping the reader where they are. */
function reRender() {
  lastSig = serviceSignature();
  renderService(S.service, { keepScroll: true });
}

function renderService(key, opts = {}) {
  const keepScroll = !!opts.keepScroll;
  const prevY = window.scrollY;
  const main = $('#doc');
  main.innerHTML = '';
  const svc = OUTLINE[S.nusach].find((s) => s.key === key);
  if (!svc) { main.appendChild(el('p', 'empty', 'אין תוכן')); return; }

  let shown = 0;
  for (const ref of svc.sections) {
    if (!sectionVisible(ref.cond, key)) continue;
    const sec = DATA.sections[ref.id];
    if (!sec) continue;
    // The Torah reading itself goes where the siddur puts the sefer.
    main.appendChild(renderSection(sec));
    shown++;
    if (/reading-from-sefer-birkat-hatorah|torah-reading$/.test(ref.id)) {
      const ley = renderLeyning();
      if (ley) main.appendChild(ley);
    }
  }
  // Hallel and Musaf are separate outlines; fold them into shacharit.
  if (key === 'shacharit') {
    if (DAY.hallel.kind !== 'none') appendOutline(main, 'hallel');
    if (DAY.musaf) appendOutline(main, 'musaf');
  }
  if (!shown) main.appendChild(el('p', 'empty', 'אין תוכן'));
  buildIndex();
  buildRail();
  if (keepScroll) window.scrollTo(0, prevY);
  else window.scrollTo(0, 0);
  syncRail();
}

/* Shacharit is long enough that scrolling to the Amidah is a chore; the index
 * lists whatever actually rendered for today, so it doubles as a check on
 * what the siddur decided to include. */
/* The rail's landmarks, in the order a service runs.  This is written out
 * rather than derived from the source's own grouping, because Sefaria groups by
 * where a text sits in its book and what you actually want to skip to is where
 * you are up to in davening -- the Shema apart from its berachot, Ashrei and
 * shir shel yom on their own at the end.  Patterns are matched against section
 * ids, so one list covers all three nusachim despite their different depth. */
const LANDMARKS = [
  ['בְּרָכוֹת',              /morning-blessings|birkot-hashachar|torah-blessings|blessings-on-torah/],
  ['קָרְבָּנוֹת',            /korbanot|offerings|incense-offering|b-raita/],
  ['פְּסוּקֵי דְזִמְרָא',      /pesukei|hodu|introductory-psalm|barukh-she-amar|yishtabach/],
  ['בִּרְכוֹת קְרִיאַת שְׁמַע', /blessings-of-the-shema-(barchu|first|second)|the-shema$|arvit-barchu|maariv-barchu/],
  ['שְׁמַע',                 /blessings-of-the-shema-shema$|-shema$/],
  ['עֲמִידָה',               /amidah-patriarchs|-amidah$|-amida$|amidah-avot/],
  ['תַּחֲנוּן',              /tachanun|nefilat|vidui$|avinu-malken/],
  ['קְרִיאַת הַתּוֹרָה',      /torah-reading|removing-the-torah|for-monday/],
  ['אַשְׁרֵי',               /concluding-prayers-ashrei|-ashrei$|uva-le/],
  ['שִׁיר שֶׁל יוֹם',        /song-of-the-day|barchi-nafshi/],
  ['עָלֵינוּ',               /alenu|aleinu/],
  ['סְפִירַת הָעֹמֶר',        /sefirat-haomer|counting-of-the-omer/],
  ['קְרִיאַת שְׁמַע עַל הַמִּטָּה', /shema-al-hamita|bedtime-shema/],
];

function railTargets() {
  const nodes = [...document.querySelectorAll('#doc .sec, #doc .divider')];
  const out = [];
  const used = new Set();
  for (const node of nodes) {
    if (node.classList.contains('divider')) {
      const label = node.textContent.split('—')[0].trim();
      out.push({ node, label });
      continue;
    }
    const id = node.id.replace(/^sec-/, '');
    // A section belongs to the FIRST landmark it matches.  If that landmark is
    // already placed, the section is simply passed over -- it must not fall
    // through to a later one, or Ashrei inside Pesukei Dezimra would be taken
    // for the Ashrei that closes the service.
    const i = LANDMARKS.findIndex(([, re]) => re.test(id));
    if (i === -1 || used.has(i)) continue;
    used.add(i);
    out.push({ node, label: LANDMARKS[i][0] });
  }
  return out.filter((t, i) => i === 0 || t.label !== out[i - 1].label);
}

let RAIL = [];

function buildRail() {
  const rail = $('#rail');
  rail.innerHTML = '';
  RAIL = railTargets();
  if (RAIL.length < 3) return;
  for (const t of RAIL) {
    const b = el('button');
    b.appendChild(el('span', 'dot'));
    b.appendChild(el('span', 'lab', t.label));
    b.title = t.label;
    b.setAttribute('aria-label', t.label);
    b.onclick = () => scrollToNode(t.node);
    const flash = () => { b.classList.add('press');
      clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('press'), 1400); };
    b.addEventListener('pointerdown', flash);
    t.btn = b;
    rail.appendChild(b);
  }
  syncRail();
}

/* Jumping inside a service this long has two traps.
 *
 * Smooth scrolling animates across every landmark in between, so the rail
 * lights each one up on the way past and the jump reads as a slow cycle
 * through the service rather than a jump.  A siddur jump should be instant.
 *
 * And `content-visibility: auto` means every off-screen section reports an
 * estimated height rather than its real one, so the target's measured position
 * moves as the jump renders the sections it lands among -- one scrollTo puts
 * you near the target, not on it.  So: jump, re-measure, correct, until the
 * position stops moving.
 *
 * The correction must not run on rAF: rAF is suspended while the page is
 * hidden, so a jump started just before the phone locks would never finish
 * correcting.  A timer still fires.  A second click can also arrive
 * mid-correction, so each jump carries a token and a superseded loop stops. */
let jumpToken = 0;

function scrollToNode(node) {
  const token = ++jumpToken;
  const targetY = () =>
    Math.max(0, node.getBoundingClientRect().top + window.scrollY
                - ($('header').offsetHeight + 8));
  let tries = 0;
  const settle = () => {
    if (token !== jumpToken) return;       // a newer jump took over
    const y = targetY();
    // Converged, or the document cannot scroll any further.
    if (Math.abs(y - window.scrollY) < 2 || ++tries > 20) {
      syncRail();
      return;
    }
    window.scrollTo(0, y);
    setTimeout(settle, 16);
  };
  settle();
}

let railTick = false;
function syncRail() {
  if (!RAIL.length) return;
  const line = $('header').offsetHeight + 40;
  let active = 0;
  for (let i = 0; i < RAIL.length; i++) {
    if (RAIL[i].node.getBoundingClientRect().top <= line) active = i;
  }
  RAIL.forEach((t, i) => t.btn && t.btn.classList.toggle('on', i === active));
  const w = $('#where');
  if (w) {
    const label = RAIL[active] && RAIL[active].label;
    w.textContent = label || '';
    w.hidden = !label || window.scrollY < 60;
  }
}

window.addEventListener('scroll', () => {
  if (railTick) return;
  railTick = true;
  requestAnimationFrame(() => { railTick = false; syncRail(); });
}, { passive: true });

/* The things you need away from a service: after a meal, before a journey.
 * Opened over the page so davening keeps its place underneath.  Patterns are
 * tried in order and the first section that exists in this nusach wins. */
const QUICK = [
  ['בִּרְכַּת הַמָּזוֹן',        /^(berachot-birkat-hamazon|birchat-hamazon-birchat-hamazon|post-meal-blessing)$/],
  ['בְּרָכָה מֵעֵין שָׁלוֹשׁ',    /al-hamichyah|me-ein-shalosh|^al-hamihya$/],
  ['בּוֹרֵא נְפָשׁוֹת',          /borei-nefashot/],
  ['בְּרָכוֹת הַנֶּהֱנִין',       /barachot-rishonot|blessing-on-foods|blessings-on-enjoyments/],
  ['תְּפִלַּת הַדֶּרֶךְ',        /tefillat-haderech|^blessings-traveler-s-prayer$|assorted-blessings-and-prayers-traveler/],
  ['אֲשֶׁר יָצַר',              /preparatory-prayers-asher-yatzar/],
  ['בִּרְכַּת הַגּוֹמֵל',        /birkat-hagomel/],
  ['בְּרָכוֹת הָרְאִיָּה',       /sights-sounds|seeing-rainbow|lightning-thunder/],
  ['סְפִירַת הָעֹמֶר',          /sefirat-haomer|counting-of-the-omer/],
  ['בִּרְכַּת הַלְּבָנָה',        /birkat-halevana|kiddush-levanah|blessing-of-the-moon/],
  ['קְרִיאַת שְׁמַע עַל הַמִּטָּה', /shema-al-hamita|^bedtime-shema$/],
];

function quickItems() {
  const ids = Object.keys(DATA.sections);
  const out = [];
  for (const [label, re] of QUICK) {
    const id = ids.find((x) => re.test(x));
    if (id) out.push({ label, id });
  }
  return out;
}

function buildQuick() {
  const list = $('#quick-list');
  list.innerHTML = '';
  for (const q of quickItems()) {
    const b = el('button', 'qitem', q.label);
    b.onclick = () => openQuick(q);
    list.appendChild(b);
  }
}

function openQuick(q) {
  const sec = DATA.sections[q.id];
  if (!sec) return;
  const body = $('#sheet-body');
  body.innerHTML = '';
  $('#sheet-title').textContent = q.label;
  body.appendChild(renderItems(sec.items));
  $('#sheet').classList.add('open');
  $('#quick').classList.remove('open');
  body.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  $('#sheet').classList.remove('open');
  document.body.style.overflow = '';
}

function buildIndex() {
  const list = $('#index');
  list.innerHTML = '';
  const heads = document.querySelectorAll('#doc .sec h2, #doc .divider');
  for (const h of heads) {
    const b = el('button', h.classList.contains('divider') ? 'ix major' : 'ix',
                 h.textContent);
    b.onclick = () => {
      $('#index-wrap').classList.remove('open');
      scrollToNode(h);
    };
    list.appendChild(b);
  }
}

function appendOutline(main, key) {
  const svc = OUTLINE[S.nusach].find((s) => s.key === key);
  if (!svc) return;
  const head = el('div', 'divider', svc.he +
    (key === 'hallel' ? ' — ' + (DAY.hallel.kind === 'full' ? 'שָׁלֵם' : 'חֲצִי')
                      : ' — ' + DAY.musaf));
  main.appendChild(head);
  for (const ref of svc.sections) {
    const sec = DATA.sections[ref.id];
    if (sec) main.appendChild(renderSection(sec));
  }
}

/* ---------- header ----------------------------------------------------- */

const fmt = (d) => d ? d.toLocaleTimeString('he-IL',
  { hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: S.loc ? S.loc.tz : undefined }) : '—';

function renderHeader() {
  $('#hdate').textContent = DAY.hebrewDate;
  $('#gdate').textContent = DAY.date.toLocaleDateString('he-IL',
    { weekday: 'long', day: 'numeric', month: 'long' });

  const tags = $('#tags'); tags.innerHTML = '';
  const add = (t, cls) => tags.appendChild(el('span', 'tag ' + (cls || ''), t));
  DAY.events.forEach((e) => add(e, 'ev'));
  if (DAY.omer) add('עֽוֹמֶר ' + DAY.omer, 'omer');
  if (DAY.hallel.kind !== 'none')
    add('הַלֵּל ' + (DAY.hallel.kind === 'full' ? 'שָׁלֵם' : 'חֲצִי'), 'ok');
  if (DAY.musaf) add('מוּסָף', 'ok');
  if (!DAY.tachanun.shacharit) add('אֵין תַּחֲנוּן', 'off');
  if (DAY.torahReading) add('קְרִיאַת הַתּוֹרָה', 'ok');

  const ch = $('#changes'); ch.innerHTML = '';
  const interesting = ['yaaleh', 'al_hanisim', 'aneinu', 'nachem', 'aseret',
    'winter_tal', 'summer_tal', 'winter_geshem', 'summer_geshem'];
  const LABEL = {
    yaaleh: 'יַעֲלֶה וְיָבֹא', al_hanisim: 'עַל הַנִּסִּים', aneinu: 'עֲנֵנוּ',
    nachem: 'נַחֵם', aseret: 'עֲשֶׂרֶת יְמֵי תְשׁוּבָה',
    winter_tal: 'וְתֵן טַל וּמָטָר', summer_tal: 'וְתֵן בְּרָכָה',
    winter_geshem: 'מַשִּׁיב הָרוּחַ', summer_geshem: 'מוֹרִיד הַטָּל',
  };
  for (const c of interesting) {
    if (!DAY.conds.has(c)) continue;
    const row = el('div', 'chg');
    row.appendChild(el('b', null, LABEL[c] || c));
    row.appendChild(el('i', null, DAY.conds.get(c)));
    ch.appendChild(row);
  }
  if (!DAY.tachanun.shacharit) {
    const row = el('div', 'chg');
    row.appendChild(el('b', null, 'אֵין תַּחֲנוּן'));
    row.appendChild(el('i', null, DAY.tachanun.why || ''));
    ch.appendChild(row);
  }
  const shir = shirShelYom(DAY)[0];
  if (shir) {
    const row = el('div', 'chg');
    row.appendChild(el('b', null, 'שִׁיר שֶׁל יוֹם — תְּהִלִּים ' + shir.psalm));
    row.appendChild(el('i', null, shir.why));
    ch.appendChild(row);
  }

  const zl = $('#zmanim'); zl.innerHTML = '';
  const rows = [['עֲלוֹת', Z.alot], ['נֵץ', Z.netz], ['סוֹף ק״ש', Z.sofShma],
    ['סוֹף תְּפִלָּה', Z.sofTfila], ['חֲצוֹת', Z.chatzot],
    ['מִנְחָה גְדוֹלָה', Z.minchaGedola], ['שְׁקִיעָה', Z.shkia],
    ['צֵאת', Z.tzeit]];
  for (const [n, v] of rows) {
    const d = el('div', 'z');
    d.appendChild(el('b', null, fmt(v)));
    d.appendChild(el('i', null, n));
    zl.appendChild(d);
  }
}

/* ---------- boot -------------------------------------------------------- */

async function loadNusach(n) {
  const r = await fetch(`data/${n}.json`);
  DATA = await r.json();
}

/* ?date=YYYY-MM-DD lets you look at another day -- useful for checking what
 * is coming, and for verifying the siddur's own rules. */
function baseNow() {
  const q = new URLSearchParams(location.search).get('date');
  if (!q) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(q);
  if (!m) return new Date();
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 9, m[5] ? +m[5] : 0);
}

/* What the rendered service depends on.  The header and zmanim are refreshed
 * every minute, but re-rendering the text on that tick would throw away the
 * reader's place -- so the text is only rebuilt when one of these changes. */
function serviceSignature() {
  return [S.nusach, S.service, S.israel, S.minyan, S.notes, S.variants, S.tikkun,
          DAY.hd.abs(), [...DAY.conds.keys()].sort().join(','),
          DAY.tachanun.shacharit, DAY.tachanun.mincha,
          DAY.hallel.kind, DAY.musaf, DAY.torahReading].join('|');
}

let lastSig = null;

async function recompute(opts = {}) {
  const now = baseNow();
  const loc = S.loc || { lat: 31.7683, lon: 35.2137, tz: 'Asia/Jerusalem',
                         name: 'יְרוּשָׁלַיִם', israel: true };
  Z = zmanimFor(now, loc);
  const offset = hebrewDayOffset(now, Z);
  const hd = new HDate(now).add(offset, 'd');
  DAY = computeDay(hd.greg(), {
    israel: S.israel, nusach: S.nusach, minyan: S.minyan,
    afterNightfall: offset === 1,
  });
  DAY.date = now;
  DAY.hebrewDate = hd.renderGematriya();
  const cur = currentService(now, Z);
  if (S.auto || !S.service) S.service = cur.key;
  renderNow(cur, now);
  renderHeader();
  renderTabs();
  const sig = serviceSignature();
  if (opts.force || sig !== lastSig) {
    const first = lastSig === null;
    lastSig = sig;
    renderService(S.service, { keepScroll: !first && !opts.force });
  }
}

const SVC_HE = { shacharit: 'שַׁחֲרִית', mincha: 'מִנְחָה', maariv: 'עַרְבִית',
                 bedtime: 'קְרִיאַת שְׁמַע עַל הַמִּטָּה' };

function renderNow(cur, now) {
  const n = $('#now');
  n.innerHTML = '';
  n.appendChild(el('b', null, SVC_HE[cur.key] || cur.key));
  n.appendChild(el('i', null, cur.why));
  const until = { shacharit: ['סוֹף זְמַן תְּפִלָּה', Z.sofTfila],
                  mincha: ['שְׁקִיעָה', Z.shkia],
                  maariv: ['חֲצוֹת הַלַּיְלָה', Z.chatzotLayla] }[cur.key];
  if (until && until[1] && until[1] > now)
    n.appendChild(el('u', null, 'עַד ' + fmt(until[1]) + ' · ' + until[0]));
  if (!S.auto) {
    const b = el('button', 'relink', 'חֲזֹר לְעַכְשָׁו');
    b.onclick = () => { S.auto = true; recompute(); };
    n.appendChild(b);
  }
}

function renderTabs() {
  const bar = $('#tabs'); bar.innerHTML = '';
  const svcs = OUTLINE[S.nusach].filter((s) =>
    ['shacharit', 'mincha', 'maariv', 'bedtime', 'extras'].includes(s.key));
  for (const s of svcs) {
    const b = el('button', 'tab' + (s.key === S.service ? ' on' : ''), s.he);
    b.onclick = () => { S.service = s.key; S.auto = false;
                        renderTabs(); renderService(s.key);
                        lastSig = serviceSignature(); };
    bar.appendChild(b);
  }
}

export async function boot() {
  S.font = migrateFont(store);
  [OUTLINE, LEYNING] = await Promise.all([
    fetch('data/outline.json').then((r) => r.json()),
    fetch('data/leyning.json').then((r) => r.json()),
  ]);
  await loadNusach(S.nusach);
  buildQuick();
  applyPrefs();
  await recompute();
  wireSettings();
  setInterval(recompute, 60000);
}

function applyPrefs() {
  document.documentElement.style.setProperty('--size', S.size + 'px');
  document.documentElement.dataset.font = S.font;
  $('#doc').classList.toggle('show-variants', S.variants);
}

function wireSettings() {
  $('#nusach').value = S.nusach;
  $('#nusach').onchange = async (e) => {
    S.nusach = e.target.value; store.set('nusach', S.nusach);
    await loadNusach(S.nusach); buildQuick(); await recompute();
  };
  $('#israel').checked = S.israel;
  $('#israel').onchange = (e) => { S.israel = e.target.checked;
    store.set('israel', S.israel); recompute(); };
  $('#minyan').checked = S.minyan;
  $('#minyan').onchange = (e) => { S.minyan = e.target.checked;
    store.set('minyan', S.minyan); reRender(); };
  $('#notes').checked = S.notes;
  $('#notes').onchange = (e) => { S.notes = e.target.checked;
    store.set('notes', S.notes); reRender(); };
  $('#variants').checked = S.variants;
  $('#variants').onchange = (e) => { S.variants = e.target.checked;
    store.set('variants', S.variants); applyPrefs(); reRender(); };
  $('#tikkun').value = S.tikkun;
  $('#tikkun').onchange = (e) => { S.tikkun = e.target.value;
    store.set('tikkun', S.tikkun); reRender(); };
  $('#font').value = S.font;
  $('#font').onchange = (e) => { S.font = e.target.value;
    store.set('font', S.font); applyPrefs(); };
  $('#size').value = S.size;
  $('#size').oninput = (e) => { S.size = +e.target.value;
    store.set('size', S.size); applyPrefs(); };
  $('#wake').checked = S.wake;
  $('#wake').onchange = (e) => { S.wake = e.target.checked;
    store.set('wake', S.wake); applyWake(); };
  applyWake();
  $('#locate').onclick = locate;
  $('#settings-toggle').onclick = () => {
    $('#quick').classList.remove('open');
    $('#index-wrap').classList.remove('open');
    $('#settings').classList.toggle('open');
  };
  $('#quick-toggle').onclick = () => {
    $('#settings').classList.remove('open');
    $('#index-wrap').classList.remove('open');
    $('#quick').classList.toggle('open');
  };
  $('#sheet-close').onclick = closeSheet;
  $('#sheet').addEventListener('click', (e) => {
    if (e.target.id === 'sheet') closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); $('#quick').classList.remove('open'); }
  });
  $('#index-toggle').onclick = () => {
    $('#quick').classList.remove('open');
    $('#settings').classList.remove('open');
    $('#index-wrap').classList.toggle('open');
  };
  if (S.loc) $('#locname').textContent = S.loc.name || 'מִקּוּם שָׁמוּר';
}

/* A screen that sleeps in the middle of the Amidah is its own small problem.
 * The lock is dropped whenever the page is hidden and re-taken on return,
 * which is what the API requires. */
let wakeLock = null;
async function applyWake() {
  if (!('wakeLock' in navigator)) {
    $('#wake').disabled = true;
    return;
  }
  try {
    if (S.wake && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!S.wake && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.wake) applyWake();
});

function locate() {
  if (!navigator.geolocation) return;
  $('#locname').textContent = '…';
  navigator.geolocation.getCurrentPosition((p) => {
    S.loc = { lat: p.coords.latitude, lon: p.coords.longitude,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      name: 'מִקּוּמְךָ' };
    store.set('loc', S.loc);
    $('#locname').textContent = S.loc.name;
    recompute();
  }, () => { $('#locname').textContent = 'לֹא זָמִין'; },
     { timeout: 8000 });
}
