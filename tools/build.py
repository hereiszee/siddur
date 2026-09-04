# -*- coding: utf-8 -*-
"""raw/*.json  ->  data/<nusach>.json  (sections keyed by stable id)"""
import sys, json, re, os, unicodedata
sys.path.insert(0, 'tools')
from parse import parse

NUSACH = {
    'ashkenaz':  'Siddur_Ashkenaz',
    'sefard':    'Siddur_Sefard',
    'edot':      'Siddur_Edot_HaMizrach',
}

def slug(parts):
    s = '/'.join(parts)
    s = unicodedata.normalize('NFKD', s)
    s = re.sub(r"[^A-Za-z0-9]+", '-', s).strip('-').lower()
    return s

# Both the Gevurot and Birkat HaShanim insertions are printed as
# "בחורף" / "בימות הגשמים", but they start on different days: משיב הרוח from
# Musaf of Shemini Atzeret, ותן טל ומטר only from 7 Cheshvan (Israel) or the
# 4th/5th of December (diaspora).  Tell them apart by what they actually say.
#
# Match on consonants alone -- the sources differ in nikud and cantillation,
# and in how combining marks are ordered.
POINTS = re.compile(r'[\u0591-\u05C7]')

def consonants(html):
    return POINTS.sub('', re.sub(r'<[^>]+>', '', html))

def _season_of(text):
    c = consonants(text)
    if 'מטר' in c:                       # ותן טל ומטר לברכה
        return 'tal'
    if 'הגשם' in c or 'הטל' in c:        # משיב הרוח / מוריד הטל
        return 'geshem'
    if 'ברכה' in c or 'ברכנו' in c:      # ותן ברכה  /  ברכנו ה׳ אלהינו
        return 'tal'
    return None

def _refine_seasonal(items):
    for it in items:
        c = it.get('cond')
        if c not in ('summer', 'winter') or it['type'] != 'text':
            continue
        kind = _season_of(it['html'])
        if kind:
            it['cond'] = c + '_' + kind
    # a rubric inherits the classification of the text it governs
    for i, it in enumerate(items):
        if it['type'] != 'rubric' or it.get('cond') not in ('summer', 'winter'):
            continue
        for nxt in items[i + 1:]:
            if nxt['type'] == 'text':
                if (nxt.get('cond') or '').startswith(it['cond'] + '_'):
                    it['cond'] = nxt['cond']
                break


def build(nusach, src):
    raw = json.load(open(f'raw/{src}.json'))
    sections, order, licenses = {}, [], {}
    for leaf in raw:
        if not leaf.get('segs'):
            continue
        path = leaf['path'][1:]          # drop the book title
        sid = slug(path)
        items = parse(leaf['segs'])
        _refine_seasonal(items)
        if not any(i['type'] == 'text' for i in items):
            continue
        sections[sid] = {
            'id': sid,
            'path': path,
            'he': leaf.get('he') or path[-1],
            'en': path[-1],
            'items': items,
        }
        order.append(sid)
        lic = (leaf.get('license'), leaf.get('version'))
        licenses[lic] = licenses.get(lic, 0) + 1
    out = {
        'nusach': nusach,
        'order': order,
        'sections': sections,
        'sources': [{'license': k[0], 'version': k[1], 'sections': v}
                    for k, v in sorted(licenses.items(), key=lambda x: -x[1])],
    }
    os.makedirs('data', exist_ok=True)
    with open(f'data/{nusach}.json', 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    conds = {}
    for s in sections.values():
        for i in s['items']:
            if i.get('cond'):
                conds[i['cond']] = conds.get(i['cond'], 0) + 1
    return len(sections), sum(len(s['items']) for s in sections.values()), conds

if __name__ == '__main__':
    allc = {}
    for n, src in NUSACH.items():
        ns, ni, conds = build(n, src)
        print(f'{n:10s} {ns:4d} sections {ni:5d} items')
        for k, v in conds.items():
            allc[k] = allc.get(k, 0) + v
    print('\nconditions in use:')
    for k, v in sorted(allc.items(), key=lambda x: -x[1]):
        print(f'  {v:4d}  {k}')
