/* Zmanim, and which tefillah the clock is currently in. */
import { GeoLocation, ComplexZmanimCalendar } from 'kosher-zmanim';

export function zmanimFor(date, loc) {
  const geo = new GeoLocation(loc.name || '', loc.lat, loc.lon,
                              loc.elevation || 0, loc.tz);
  const cal = new ComplexZmanimCalendar(geo);
  cal.setDate(date);
  const g = (fn) => { try { const v = cal[fn](); return v ? v.toJSDate() : null; }
                      catch (e) { return null; } };
  return {
    alot:        g('getAlos72'),
    misheyakir:  g('getMisheyakir11Point5Degrees'),
    netz:        g('getSunrise'),
    sofShma:     g('getSofZmanShmaGRA'),
    sofShmaMA:   g('getSofZmanShmaMGA'),
    sofTfila:    g('getSofZmanTfilaGRA'),
    chatzot:     g('getChatzos'),
    minchaGedola:g('getMinchaGedola'),
    minchaKetana:g('getMinchaKetana'),
    plag:        g('getPlagHamincha'),
    shkia:       g('getSunset'),
    tzeit:       g('getTzais'),
    tzeit72:     g('getTzais72'),
    chatzotLayla:g('getSolarMidnight'),
  };
}

/* Which service is "now".  Windows overlap in real life -- someone davening
 * mincha at 13:20 is not wrong -- so this picks the most likely one and the
 * UI still lets you go anywhere. */
export function currentService(now, z) {
  const t = now.getTime();
  const at = (d) => (d ? d.getTime() : null);
  const alot = at(z.alot), netz = at(z.netz), sofTfila = at(z.sofTfila),
        chatzot = at(z.chatzot), mg = at(z.minchaGedola),
        shkia = at(z.shkia), tzeit = at(z.tzeit);

  if (alot && t < alot)  return { key: 'bedtime', why: 'לִפְנֵי עֲלוֹת הַשַּׁחַר' };
  if (sofTfila && t <= sofTfila) return { key: 'shacharit', why: 'זְמַן שַׁחֲרִית' };
  if (chatzot && t < chatzot)    return { key: 'shacharit', why: 'אַחַר סוֹף זְמַן תְּפִלָּה' };
  if (mg && t < mg)              return { key: 'mincha', why: 'לִפְנֵי מִנְחָה גְדוֹלָה' };
  if (shkia && t < shkia)        return { key: 'mincha', why: 'זְמַן מִנְחָה' };
  if (tzeit && t < tzeit)        return { key: 'mincha', why: 'בֵּין הַשְּׁמָשׁוֹת' };
  return { key: 'maariv', why: 'זְמַן עַרְבִית' };
}

/* After nightfall the Hebrew date has already turned over. */
export function hebrewDayOffset(now, z) {
  return z.tzeit && now.getTime() >= z.tzeit.getTime() ? 1 : 0;
}
