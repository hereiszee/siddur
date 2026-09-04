import { computeDay, shirShelYom } from '../app/day.js';
const d = (s) => new Date(s + 'T09:00:00');
const cases = [
  // date        il     expect
  ['2026-12-11', false, { conds:['rosh_chodesh','chanukah','yaaleh','al_hanisim','winter_geshem','winter_tal'], hallel:'full', musaf:'ראש חודש', tach:false, leyn:true }],
  ['2027-03-23', false, { conds:['purim','al_hanisim'], hallel:'none', musaf:null, tach:false, leyn:false }],
  ['2026-09-14', false, { conds:['aseret','aneinu','summer_geshem','summer_tal'], hallel:'none', musaf:null, tach:true, leyn:true }],
  ['2026-10-06', false, { conds:['winter_geshem','summer_tal'], hallel:'none', musaf:null, tach:false, leyn:false }],
  ['2027-04-27', false, { conds:['chol_hamoed','yaaleh','pesach'], hallel:'half', musaf:'חול המועד', tach:false, leyn:true }],
  ['2026-11-11', false, { conds:['rosh_chodesh','yaaleh','winter_geshem','summer_tal'], hallel:'half', musaf:'ראש חודש', tach:false, leyn:true }],
  ['2026-11-11', true,  { conds:['rosh_chodesh','yaaleh','winter_geshem','winter_tal'], hallel:'half', musaf:'ראש חודש', tach:false, leyn:true }],
  ['2027-07-22', false, { conds:['aneinu'], hallel:'none', musaf:null, tach:true, leyn:true }],   // 17 Tammuz -- tachanun is said
  ['2027-08-12', false, { conds:['aneinu','nachem'], hallel:'none', musaf:null, tach:false, leyn:true }], // 9 Av
  ['2027-05-25', false, { conds:['summer_geshem','summer_tal'], hallel:'none', musaf:null, tach:false, leyn:false }], // 18 Iyar Lag BaOmer
];
let bad = 0;
for (const [ds, il, exp] of cases) {
  const r = computeDay(d(ds), { israel: il });
  const got = [...r.conds.keys()];
  const missing = exp.conds.filter((c) => !got.includes(c));
  const probs = [];
  if (missing.length) probs.push('missing ' + missing.join(','));
  if (r.hallel.kind !== exp.hallel) probs.push(`hallel ${r.hallel.kind} != ${exp.hallel}`);
  if ((r.musaf || null) !== exp.musaf) probs.push(`musaf ${r.musaf} != ${exp.musaf}`);
  if (r.tachanun.shacharit !== exp.tach) probs.push(`tachanun ${r.tachanun.shacharit} != ${exp.tach}`);
  if (r.torahReading !== exp.leyn) probs.push(`leyning ${r.torahReading} != ${exp.leyn}`);
  const ok = !probs.length;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${ds} ${il ? 'IL ' : 'chu'} ${r.hebrewDate.padEnd(20)} ${r.events.join(',')||'-'}`);
  if (!ok) console.log('       ' + probs.join(' | ') + '\n       got: ' + got.join(' '));
}
console.log(bad ? `\n${bad} failing` : '\nall pass');
