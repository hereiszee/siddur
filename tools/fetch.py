import json,os,re,sys,time,urllib.request,urllib.parse
CACHE='.cache'
os.makedirs(CACHE,exist_ok=True)
def api(path):
    key=re.sub(r'[^A-Za-z0-9]+','_',path)[:180]+'.json'
    fp=os.path.join(CACHE,key)
    if os.path.exists(fp): return json.load(open(fp))
    u='https://www.sefaria.org/api/'+path
    for attempt in range(4):
        try:
            d=json.load(urllib.request.urlopen(u,timeout=60)); break
        except Exception as e:
            if attempt==3: raise
            time.sleep(2*(attempt+1))
    json.dump(d,open(fp,'w'))
    return d
def text(ref):
    return api('v3/texts/'+urllib.parse.quote(ref)+'?version=hebrew')
def flat(x,out):
    if isinstance(x,str): out.append(x)
    elif isinstance(x,list):
        for i in x: flat(i,out)
    return out
if __name__=='__main__':
    ref=' '.join(sys.argv[1:])
    d=text(ref); v=d['versions'][0]
    segs=flat(v['text'],[])
    print(v.get('versionTitle'),'|',v.get('license'),'|',len(segs),'segs')

def leaves(index_title):
    d=api('v2/raw/index/'+index_title)
    out=[]
    def nm(n,lang='en'):
        for t in n.get('titles',[]):
            if t.get('lang')==lang and t.get('primary'): return t['text']
        return n.get('key') or '?'
    def walk(n,path,depth=0):
        p=(path+[nm(n)]) if depth else [nm(n)]
        if 'nodes' in n:
            for c in n['nodes']: walk(c,p,depth+1)
        else: out.append({'ref':', '.join(p),'he':nm(n,'he'),'path':p})
    walk(d['schema'],[])
    return out
