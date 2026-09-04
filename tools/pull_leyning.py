import sys,json,time,urllib.parse
sys.path.insert(0,'tools')
from fetch import api, flat
idx=json.load(open('data/leyning-index.json'))
VER="Tanach with Ta'amei Hamikra"
cache={}
def verses(k,b,e):
    ref=f"{k} {b}-{e}"
    if ref in cache: return cache[ref]
    q='v3/texts/'+urllib.parse.quote(ref)+'?version='+urllib.parse.quote('hebrew|'+VER)
    d=api(q); v=d['versions'][0]
    assert v['versionTitle']==VER, (ref,v['versionTitle'])
    cache[ref]=flat(v['text'],[])
    return cache[ref]
out={}
rs=idx['readings']
for i,(name,aliyot) in enumerate(rs.items()):
    o={}
    for al,a in aliyot.items():
        try:
            o[al]={'ref':f"{a['k']} {a['b']}-{a['e']}",'v':verses(a['k'],a['b'],a['e']),'reason':a.get('reason')}
        except Exception as ex:
            print('MISS',name,al,ex,flush=True)
    out[name]=o
    if i%20==0: print(i,'/',len(rs),flush=True)
    time.sleep(0.1)
json.dump(out,open('data/leyning.json','w'),ensure_ascii=False)
tot=sum(len(x['v']) for r in out.values() for x in r.values())
print('done:',len(out),'readings,',tot,'verses')
