/* The halachic day: which conditions hold, and why.
 *
 * Every flag this returns is paired with a human reason, because a siddur that
 * silently changes the text is worse than one that doesn't change it at all --
 * you need to be able to check its work.
 */
import { HebrewCalendar, HDate, months, flags } from '@hebcal/core';

const F = flags;

/* ---------- small helpers ------------------------------------------- */

const isLeap = (hd) => HDate.isLeapYear(hd.getFullYear());

function evFlags(events) {
  return events.reduce((a, e) => a | e.getFlags(), 0);
}

/* Tachanun is omitted on far more days than people remember.  This is the
 * Ashkenaz list; Sefard and Edot HaMizrach differ in a few places, noted
 * inline.  Returns a reason string when it is omitted, else null. */
function tachanunOmitted(hd, events, nusach) {
  const m = hd.getMonth(), d = hd.getDate();
  const ef = evFlags(events);
  const leap = isLeap(hd);

  if (ef & F.ROSH_CHODESH)          return 'ראש חודש';
  if (ef & F.CHOL_HAMOED)           return 'חול המועד';
  if (ef & F.CHAG)                  return 'יום טוב';
  if (ef & F.CHANUKAH_CANDLES)      return 'חנוכה';

  if (m === months.NISAN)           return 'חודש ניסן';
  if (m === months.IYYAR && d === 14) return 'פסח שני';
  if (m === months.IYYAR && d === 18) return 'ל״ג בעומר';
  if (m === months.SIVAN && d <= 12)  return 'עד י״ב סיון';
  if (m === months.AV && (d === 9 || d === 15)) return d === 9 ? 'תשעה באב' : 'ט״ו באב';
  if (m === months.TISHREI && d >= 9) return 'מיום כיפור ואילך';
  if (m === months.TISHREI && d <= 2) return 'ראש השנה';
  if (m === months.SHVAT && d === 15) return 'ט״ו בשבט';

  // Purim and Shushan Purim; in a leap year the 14th/15th of Adar I too.
  const adar = leap ? months.ADAR_II : months.ADAR_I;
  if (m === adar && (d === 14 || d === 15)) return 'פורים';
  if (leap && m === months.ADAR_I && (d === 14 || d === 15)) return 'פורים קטן';

  // Erev Rosh Hashana and Erev Yom Kippur.
  if (m === months.ELUL && d === 29) return 'ערב ראש השנה';
  if (m === months.TISHREI && d === 9) return 'ערב יום כיפור';

  return null;
}

/* Mincha follows the coming night: on the eve of a day without tachanun,
 * mincha already omits it. */
function tachanunOmittedMincha(hd, il, nusach) {
  const tomorrow = hd.next();
  const evs = HebrewCalendar.getHolidaysOnDate(tomorrow, il) || [];
  const r = tachanunOmitted(tomorrow, evs, nusach);
  // Erev Rosh Chodesh is the exception: tachanun IS said at mincha.
  if (r === 'ראש חודש') return null;
  return r ? 'ערב ' + r : null;
}

/* ---------- Hallel ---------------------------------------------------- */

function hallelFor(hd, events, il) {
  const ef = evFlags(events);
  const m = hd.getMonth(), d = hd.getDate();
  if (ef & F.CHANUKAH_CANDLES) return { kind: 'full', why: 'חנוכה' };
  if (m === months.NISAN && (d === 15 || (!il && d === 16)))
    return { kind: 'full', why: 'פסח' };
  if (m === months.SIVAN && (d === 6 || (!il && d === 7)))
    return { kind: 'full', why: 'שבועות' };
  if (m === months.TISHREI && d >= 15 && d <= (il ? 22 : 23))
    return { kind: 'full', why: 'סוכות' };
  if (ef & F.CHOL_HAMOED) {
    if (m === months.NISAN) return { kind: 'half', why: 'חול המועד פסח' };
    return { kind: 'full', why: 'חול המועד סוכות' };
  }
  if (m === months.NISAN && d >= 17 && d <= 22)
    return { kind: 'half', why: 'אחרון של פסח' };
  if (ef & F.ROSH_CHODESH) return { kind: 'half', why: 'ראש חודש' };
  return { kind: 'none', why: null };
}

/* ---------- seasonal insertions --------------------------------------- */

/* משיב הרוח ומוריד הגשם: from Musaf of Shemini Atzeret until Musaf of the
 * first day of Pesach.  Everywhere, same dates. */
function geshemSeason(hd) {
  const y = hd.getFullYear();
  const start = new HDate(22, months.TISHREI, y);      // Shemini Atzeret
  const end = new HDate(15, months.NISAN, y);          // first day of Pesach
  const abs = hd.abs();
  return abs >= start.abs() && abs <= end.abs() ? 'winter' : 'summer';
}

/* ותן טל ומטר: in Israel from 7 Cheshvan; in the diaspora from the 60th day
 * after the autumnal equinox -- 4 or 5 December.  Ends at Pesach either way. */
function talUmatarSeason(hd, il) {
  const abs = hd.abs();
  if (il) {
    const y = hd.getFullYear();
    const start = new HDate(7, months.CHESHVAN, y).abs();
    const end = new HDate(15, months.NISAN, y).abs();
    return abs >= start && abs < end ? 'winter' : 'summer';
  }
  // Diaspora: reason in civil years.  Within any civil year the season runs
  // from the December start to the end of the year, and from January until
  // Pesach falls that spring.
  const greg = hd.greg();
  const g = greg.getFullYear();
  const start = new HDate(new Date(g, 11, decemberStart(g), 12)).abs();
  const pesachThisSpring = pesachInCivilYear(g);
  if (abs >= start) return 'winter';
  if (abs < pesachThisSpring) return 'winter';
  return 'summer';
}

/* 15 Nisan lands in a single civil year; find which Hebrew year supplies it. */
function pesachInCivilYear(civilYear) {
  const hy = new HDate(new Date(civilYear, 3, 1, 12)).getFullYear();
  return new HDate(15, months.NISAN, hy).abs();
}

/* Dec 4, or Dec 5 in the civil year before a Gregorian leap year.  The whole
 * count slides a day each time a century is skipped in the leap cycle, which
 * is why this is not simply hard-coded. */
function decemberStart(civilYear) {
  const next = civilYear + 1;
  const nextIsLeap = (next % 4 === 0 && next % 100 !== 0) || next % 400 === 0;
  const gap = Math.floor(civilYear / 100) - Math.floor(civilYear / 400) - 2;
  return 4 + (gap - 13) + (nextIsLeap ? 1 : 0);
}

/* ---------- the day --------------------------------------------------- */

export function computeDay(date, opts = {}) {
  const il = !!opts.israel;
  const nusach = opts.nusach || 'ashkenaz';
  const hd = new HDate(date);
  const events = HebrewCalendar.getHolidaysOnDate(hd, il) || [];
  const ef = evFlags(events);
  const dow = hd.getDay();                    // 0 = Sunday, 6 = Shabbat

  const conds = new Map();                    // condition id -> reason
  const on = (id, why) => { if (id) conds.set(id, why); };

  const names = events.map((e) => e.render('he')).filter(Boolean);

  /* days */
  if (ef & F.ROSH_CHODESH) on('rosh_chodesh', 'ראש חודש');
  if (ef & F.CHOL_HAMOED) on('chol_hamoed', 'חול המועד');
  if (ef & F.CHANUKAH_CANDLES) on('chanukah', 'חנוכה');
  if (conds.has('rosh_chodesh') || conds.has('chol_hamoed'))
    on('yaaleh', conds.get('rosh_chodesh') || conds.get('chol_hamoed'));
  if (conds.has('chanukah')) on('al_hanisim', 'חנוכה');

  const m = hd.getMonth(), dd = hd.getDate();
  const leap = isLeap(hd);
  const adar = leap ? months.ADAR_II : months.ADAR_I;
  if (m === adar && (dd === 14 || dd === 15)) {
    on('purim', 'פורים');
    on('al_hanisim', 'פורים');
  }
  if (m === months.NISAN) on('pesach', 'ניסן');
  if (m === months.TISHREI && dd >= 15 && dd <= 21) on('sukkot', 'סוכות');
  if (m === months.TISHREI && dd === 22) on('shmini_atzeret', 'שמיני עצרת');
  if (m === months.SIVAN && dd >= 6 && dd <= 7) on('shavuot', 'שבועות');

  /* the Ten Days of Repentance */
  if (m === months.TISHREI && dd >= 1 && dd <= 10)
    on('aseret', 'עשרת ימי תשובה');

  /* fasts */
  const fast = (ef & F.MINOR_FAST) || (ef & F.MAJOR_FAST);
  if (fast) on('aneinu', names[0] || 'תענית ציבור');
  if (m === months.AV && dd === 9) on('nachem', 'תשעה באב');

  /* seasons */
  const g = geshemSeason(hd);
  on(g + '_geshem', g === 'winter'
      ? 'מִשְּׁמִינִי עֲצֶרֶת עַד פֶּסַח'
      : 'מִפֶּסַח עַד שְׁמִינִי עֲצֶרֶת');
  const t = talUmatarSeason(hd, il);
  on(t + '_tal', t === 'winter'
      ? (il ? 'מז׳ בְּחֶשְׁוָן' : 'מד׳/ה׳ בְּדֶצֶמְבֶּר')
      : 'מִפֶּסַח');

  /* place and company */
  on(il ? 'eretz_yisrael' : 'chutz_laaretz', il ? 'ארץ ישראל' : 'חוץ לארץ');
  if (opts.minyan) on('with_minyan', 'במניין');
  if (dow === 6 && opts.afterNightfall) on('motzaei_shabbat', 'מוצאי שבת');

  /* omer */
  const omerEv = events.find((e) => e.getFlags() & F.OMER_COUNT);
  const omer = omerEv ? omerEv.omer : omerCount(hd);

  /* tachanun */
  const tachOmit = tachanunOmitted(hd, events, nusach);
  const tachOmitMincha = tachOmit || tachanunOmittedMincha(hd, il, nusach);

  return {
    hd,
    date,
    israel: il,
    dow,
    isShabbat: dow === 6,
    hebrewDate: hd.renderGematriya(),
    events: names,
    conds,
    omer,
    hallel: hallelFor(hd, events, il),
    musaf: (ef & F.ROSH_CHODESH) ? 'ראש חודש'
         : (ef & F.CHOL_HAMOED) ? 'חול המועד'
         : (ef & F.CHAG) ? 'יום טוב' : null,
    tachanun: { shacharit: !tachOmit, mincha: !tachOmitMincha,
                why: tachOmit || tachOmitMincha },
    torahReading: !!(dow === 1 || dow === 4 || fast
                   || (ef & (F.ROSH_CHODESH | F.CHOL_HAMOED | F.CHANUKAH_CANDLES))),
  };
}

function omerCount(hd) {
  const y = hd.getFullYear();
  const start = new HDate(16, months.NISAN, y).abs();
  const n = hd.abs() - start + 1;
  return n >= 1 && n <= 49 ? n : null;
}

/* Shir shel yom.  Barchi Nafshi replaces it on Rosh Chodesh; Chanukah has
 * its own psalm before it. */
const DAILY_PSALM = ['כד', 'מח', 'פב', 'צד', 'פא', 'צג'];
export function shirShelYom(day) {
  const out = [];
  if (day.conds.has('chanukah')) out.push({ psalm: 'ל', why: 'חנוכה' });
  if (day.conds.has('rosh_chodesh'))
    out.push({ psalm: 'קד', why: 'ברכי נפשי — ראש חודש' });
  out.push({ psalm: DAILY_PSALM[day.dow] || 'כד',
             why: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי',
                   'יום חמישי', 'יום שישי', 'שבת'][day.dow] });
  return out;
}
