# -*- coding: utf-8 -*-
"""Turn Sefaria segment lists into renderable items.

Sefaria's siddur segments interleave three things:
  * prayer text
  * short rubrics  -- <small>בקיץ:</small>, which govern what follows
  * long halachic notes -- <small>אם שכח לומר...</small>, which are commentary

A rubric names a condition; the text it governs is shown only when that
condition holds today.  Where the governed text continues a sentence begun in
the previous segment (the previous segment has no terminator), it must flow
inline or the beracha breaks apart mid-phrase.
"""
import re

SMALL = re.compile(r'<small>(.*?)</small>', re.S)
TAG   = re.compile(r'<[^>]+>')
TERMINATORS = ('׃', ':', '.', '!', '?')

# Short rubric -> condition id.  Ordered; first match wins.
RUBRIC = [
    ('winter',        [r'בימות הגשמים', r'בחורף']),
    ('summer',        [r'בימות החמה', r'בקיץ']),
    ('aseret',        [r'עשי["״]ת', r'עשרת ימי תשובה']),
    ('yaaleh',        [r'ראש ח(ו)?דש.*חול המועד', r'ר["״]ח.*חוה?["״]?מ',
                       r'יעלה ויב(ו)?א']),
    ('pesach',        [r'^[בל]?פסח', r'חג המצות']),
    ('sukkot',        [r'^[בל]?ס[וכ]כ?ות', r'חג הסכות', r'חג הסוכות']),
    ('shavuot',       [r'^[בל]?שבועות', r'חג השבועות']),
    ('shmini_atzeret',[r'שמיני עצרת']),
    ('al_hanisim',    [r'חנוכה.*פורים', r'על הנסים']),
    ('aneinu',        [r'תענית', r'עננו']),
    ('nachem',        [r'תשעה באב', r'ט["״]ב']),
    ('rosh_chodesh',  [r'[בל]ראש ח(ו)?דש', r'[בל]ר["״]ח']),
    ('chol_hamoed',   [r'חול המועד', r'חוה?["״]מ', r'חולו של מועד']),
    ('chanukah',      [r'[בל]חנוכה']),
    ('chanukah',      [r'בחנוכה']),
    ('purim',         [r'בפורים']),
    ('motzaei_shabbat',[r'מוצאי שבת', r'מוצ["״]ש']),
    ('eretz_yisrael', [r'בארץ ישראל', r'בא["״]י']),
    ('chutz_laaretz', [r'בחוץ לארץ', r'בחו["״]ל']),
    ('shabbat',       [r'בשבת']),
    ('with_minyan',   [r'בצבור', r'בציבור', r'עם מנין', r'הש["״]ץ']),
]
RUBRIC_C = [(c, [re.compile(p) for p in ps]) for c, ps in RUBRIC]

def _cond(label):
    for cid, pats in RUBRIC_C:
        for p in pats:
            if p.search(label):
                return cid
    return None

def _plain(html):
    return TAG.sub('', html).strip()

def _is_rubric(label):
    """Short and directive -- as opposed to a paragraph of halacha."""
    t = label.strip()
    return len(t) <= 60 and (t.endswith(':') or t.endswith('׃'))

def _join(outer, inner):
    """A nested rubric narrows its parent: 'on Rosh Chodesh' + 'for Pesach'."""
    if outer and inner and outer != inner:
        return outer + '+' + inner
    return inner or outer


def parse(segs):
    """-> list of items {type, html, cond?, inline?}

    type: 'text' | 'note' | 'heading'
    """
    items = []
    pending_cond = None      # rubric awaiting the text it governs
    for raw in segs:
        raw = (raw or '').strip()
        if not raw:
            continue
        smalls = SMALL.findall(raw)
        stripped = SMALL.sub('', raw).strip()

        # A segment that is nothing but <small>: either rubric or note.
        if smalls and not _plain(stripped):
            label = _plain(smalls[0])
            if _is_rubric(label):
                c = _cond(label)
                items.append({'type': 'rubric', 'html': label, 'cond': c})
                pending_cond = c
            else:
                for s in smalls:
                    p = _plain(s)
                    if p:
                        items.append({'type': 'note', 'html': p})
            continue

        # Inline rubric(s) inside a text segment: <small>בקיץ:</small> טל...
        if smalls and _plain(stripped):
            parts = _split_inline(raw, pending_cond)
            if parts:
                items.extend(parts)
                pending_cond = None
                continue

        prev_open = _continues(items)
        items.append({'type': 'text', 'html': raw,
                      'cond': pending_cond,
                      'inline': bool(pending_cond) and prev_open})
        pending_cond = None
    return _unify_groups(items)


def _unify_groups(items):
    """Consecutive rubric/text alternates are one choice; they flow together."""
    i = 0
    while i < len(items):
        if items[i]['type'] != 'rubric' or not items[i].get('cond'):
            i += 1
            continue
        j = i
        group = []
        while j < len(items) and items[j]['type'] in ('rubric', 'text'):
            if items[j]['type'] == 'rubric' and not items[j].get('cond'):
                break
            if items[j]['type'] == 'text' and not items[j].get('cond'):
                break
            group.append(j)
            j += 1
        if len(group) > 1:
            flow = any(items[k].get('inline') for k in group
                       if items[k]['type'] == 'text')
            for k in group:
                items[k]['inline'] = flow
            j = _split_shared_tail(items, group, j)
        i = max(j, i + 1)
    return items


def _split_shared_tail(items, group, end):
    """Sefaria sometimes glues a beracha's shared continuation onto the last
    alternate, so choosing any other alternate would drop it.  If the final
    alternate runs far longer than its siblings, split it at the first
    terminator and give the remainder back to everyone."""
    texts = [k for k in group if items[k]['type'] == 'text']
    if len(texts) < 2:
        return end
    last = texts[-1]
    lens = sorted(len(_plain(items[k]['html'])) for k in texts[:-1])
    typical = lens[len(lens) // 2]
    body = items[last]['html']
    plain = _plain(body)
    if len(plain) < max(2 * typical, typical + 40):
        return end
    m = re.search(r'[׃:]', plain)
    if not m or m.end() >= len(plain) - 10:
        return end
    cut = _cut_html(body, m.end())
    if cut is None:
        return end
    head, tail = cut
    # The tail belongs to every alternate, so it keeps whatever condition they
    # all share -- Ya'aleh v'Yavo's זכרנו is still only said when it applies.
    outers = {(items[k].get('cond') or '').split('+')[0] for k in texts}
    shared = outers.pop() if len(outers) == 1 else None
    items[last]['html'] = head
    items.insert(last + 1, {'type': 'text', 'html': tail,
                            'cond': shared or None, 'inline': True})
    return end + 1


def _cut_html(html, plain_index):
    """Split an HTML fragment at a position measured in tag-free characters."""
    seen, i = 0, 0
    while i < len(html):
        if html[i] == '<':
            close = html.find('>', i)
            if close == -1:
                return None
            i = close + 1
            continue
        seen += 1
        i += 1
        if seen >= plain_index:
            head, tail = html[:i].strip(), html[i:].strip()
            if not _plain(tail):
                return None
            return head, tail
    return None

def _continues(items):
    """True if the last text item left a sentence unfinished."""
    for it in reversed(items):
        if it['type'] == 'text':
            return not _plain(it['html']).rstrip().endswith(TERMINATORS)
        if it['type'] == 'rubric':
            continue
        if it['type'] == 'note':
            continue
    return False

def _split_inline(raw, outer_cond=None):
    """<small>A:</small> textA <small>B:</small> textB  ->  conditional spans."""
    pieces = re.split(r'(<small>.*?</small>)', raw, flags=re.S)
    out, cur_cond, buf = [], outer_cond, []
    saw_rubric = False
    def flush():
        if buf:
            t = ''.join(buf).strip()
            if _plain(t):
                out.append({'type': 'text', 'html': t,
                            'cond': cur_cond, 'inline': True})
        buf.clear()
    for p in pieces:
        if not p:
            continue
        m = SMALL.fullmatch(p.strip())
        if m:
            label = _plain(m.group(1))
            if _is_rubric(label):
                flush()
                inner = _cond(label)
                cur_cond = _join(outer_cond, inner)
                saw_rubric = True
                out.append({'type': 'rubric', 'html': label,
                            'cond': cur_cond, 'inline': True})
                continue
            flush()
            cur_cond = outer_cond
            out.append({'type': 'note', 'html': label})
            continue
        buf.append(p)
    flush()
    return out if saw_rubric else None
