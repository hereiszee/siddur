import json,sys,urllib.request
def get(u):
    return json.load(urllib.request.urlopen(u))
def nm(n):
    for t in n.get('titles',[]):
        if t.get('lang')=='en' and t.get('primary'): return t['text']
    return n.get('key') or n.get('title') or '?'
def he(n):
    for t in n.get('titles',[]):
        if t.get('lang')=='he' and t.get('primary'): return t['text']
    return ''
def walk(n,path,out,depth=0):
    name=nm(n)
    p=path+[name] if depth else [name]
    if 'nodes' in n:
        for c in n['nodes']: walk(c,p,out,depth+1)
    else:
        out.append((', '.join(p), he(n)))
for t in sys.argv[1:]:
    d=get(f"https://www.sefaria.org/api/v2/raw/index/{t}")
    out=[]
    walk(d['schema'],[],out)
    print(f"##### {t}  ({len(out)} leaves)")
    for r,h in out: print(f"{r}\t{h}")
