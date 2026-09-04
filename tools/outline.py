# -*- coding: utf-8 -*-
"""Ordered service outlines, one per nusach.

Sefaria's own ordering inside a service is already the siddur's order, so the
outline follows it.  What this adds is which sections are conditional: Hallel
only when there is Hallel, Tachanun only when it is said, and so on.
"""
import json, re

SERVICES = {
    'ashkenaz': [
        ('shacharit', 'שַׁחֲרִית',  r'^weekday-shacharit-'),
        ('mincha',    'מִנְחָה',    r'^weekday-minchah-'),
        ('maariv',    'עַרְבִית',   r'^weekday-maariv-'),
        ('hallel',    'הַלֵּל',     r'^festivals-rosh-chodesh-hallel-'),
        ('musaf',     'מוּסָף',     r'^festivals-rosh-chodesh-musaf-'),
        ('bedtime',   'קְרִיאַת שְׁמַע עַל הַמִּטָּה', r'^weekday-maariv-keri-at-shema'),
        ('extras',    'נוֹסָפוֹת',  r'^(kaddish-|berachot-|weekday-shacharit-post-service)'),
    ],
    'sefard': [
        ('shacharit', 'שַׁחֲרִית',  r'^(upon-arising-|weekday-shacharit-)'),
        ('mincha',    'מִנְחָה',    r'^weekday-mincha-'),
        ('maariv',    'עַרְבִית',   r'^weekday-maariv-'),
        ('hallel',    'הַלֵּל',     r'^rosh-chodesh-hallel'),
        ('musaf',     'מוּסָף',     r'^rosh-chodesh-mussaf'),
        ('bedtime',   'קְרִיאַת שְׁמַע עַל הַמִּטָּה', r'^bedtime-shema'),
        ('extras',    'נוֹסָפוֹת',  r'^(additional-prayers|blessings-|birchat-hamazon|priestly-blessing|kiddush-levanah)'),
    ],
    'edot': [
        ('shacharit', 'שַׁחֲרִית',  r'^(preparatory-prayers-|weekday-shacharit-|additions-for-shacharit-)'),
        ('mincha',    'מִנְחָה',    r'^weekday-mincha-'),
        ('maariv',    'עַרְבִית',   r'^weekday-arvit-'),
        ('hallel',    'הַלֵּל',     r'^rosh-hodesh-hallel'),
        ('musaf',     'מוּסָף',     r'^rosh-hodesh-mussaf'),
        ('bedtime',   'קְרִיאַת שְׁמַע עַל הַמִּטָּה', r'^bedtime-shema'),
        ('extras',    'נוֹסָפוֹת',  r'^(post-meal-blessing|al-hamihya|blessings-on-enjoyments|counting-of-the-omer|blessing-of-the-moon)'),
    ],
}

# Section-level conditions.  First matching pattern wins.
SECTION_COND = [
    (r'shabbat|kabbalat|magen-avot|shabbat-chatan',        'never'),
    (r'motza|viyehi-noam|veyiten-lekha|vayechulu',          'motzaei_shabbat'),
    (r'tachanun|nefilat|shomer-yisrael|vidui|god-of-israel|for-monday-and-thursday|and-he-is-merciful',
                                                             'tachanun'),
    (r'avinu-malken',                                        'avinu_malkenu'),
    (r'torah-reading|removing-the-torah|reading-from-sefer|returning-sefer|birkat-hatorah|hagbahah|raising-the-torah',
                                                             'torah_reading'),
    (r'hallel',                                              'hallel'),
    (r'mussaf|musaf',                                        'musaf'),
    (r'barchi-nafshi',                                       'rosh_chodesh'),
    (r'sefirat-haomer|counting-of-the-omer',                 'omer'),
    (r'birkat-halevana|blessing-of-the-moon|kiddush-levanah','kiddush_levana'),
    (r'lamenatze|lamnatze',                                  'tachanun'),
    (r'keri-at-shema-al-hamita|bedtime-shema',               'bedtime'),
    (r'the-midnight-rite|tikkun-rachel|tikkun-leah',         'never'),
    (r'song-of-the-day|shir-shel-yom',                       'always'),
]
SECTION_COND_C = [(re.compile(p), c) for p, c in SECTION_COND]

def cond_for(sid):
    for p, c in SECTION_COND_C:
        if p.search(sid):
            return c
    return 'always'

def build_outline(nusach):
    data = json.load(open(f'data/{nusach}.json'))
    order = data['order']
    used = set()
    services = []
    for key, he, pat in SERVICES[nusach]:
        rx = re.compile(pat)
        sids = [s for s in order if rx.search(s)]
        if key == 'bedtime':
            pass                       # bedtime may repeat out of maariv
        else:
            sids = [s for s in sids if s not in used]
        used.update(sids)
        if not sids:
            continue
        services.append({
            'key': key, 'he': he,
            'sections': [{'id': s, 'cond': cond_for(s)} for s in sids],
        })
    return services

if __name__ == '__main__':
    out = {}
    for n in SERVICES:
        out[n] = build_outline(n)
        print(f'\n### {n}')
        for svc in out[n]:
            conds = {}
            for s in svc['sections']:
                conds[s['cond']] = conds.get(s['cond'], 0) + 1
            print(f"  {svc['key']:10s} {len(svc['sections']):3d} sections  {conds}")
    json.dump(out, open('data/outline.json', 'w'), ensure_ascii=False)
