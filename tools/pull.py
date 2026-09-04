import sys,json,os,time
sys.path.insert(0,'tools')
from fetch import leaves, text, flat

WANT={
 'Siddur_Ashkenaz': lambda p: p[1] in ('Weekday','Kaddish','Berachot') or (p[1]=='Festivals' and p[2] in ('Rosh Chodesh','Chanukah','Sukkot')),
 'Siddur_Sefard': lambda p: p[1].strip() in ('Upon Arising','Weekday Shacharit','Additional Prayers','Weekday Mincha','Weekday Maariv','Kiddush Levanah','Bedtime Shema','Rosh Chodesh','Chanukah','Torah Readings','Birchat HaMazon','Blessings','Priestly Blessing','Mealtime Blessings','Sukkot'),
 'Siddur_Edot_HaMizrach': lambda p: p[1].strip() in ('Preparatory Prayers','Weekday Shacharit','Additions for Shacharit','Weekday Mincha','Weekday Arvit','Counting of the Omer','Blessing of the Moon','Bedtime Shema','Rosh Hodesh','Hanukkah','Post Meal Blessing','Al Hamihya','Blessings on Enjoyments','Fast Days and Mourning'),
}
os.makedirs('raw',exist_ok=True)
for title,pred in WANT.items():
    ls=[l for l in leaves(title) if len(l['path'])>1 and pred(l['path'])]
    print(title,'->',len(ls),'leaves',flush=True)
    out=[]
    for i,l in enumerate(ls):
        try:
            d=text(l['ref']); v=d['versions'][0]
            segs=flat(v['text'],[])
            out.append({'ref':l['ref'],'path':l['path'],'he':l['he'],
                        'version':v.get('versionTitle'),'license':v.get('license'),
                        'source':v.get('versionSource'),'segs':segs})
        except Exception as e:
            print('  MISS',l['ref'],e,flush=True)
            out.append({'ref':l['ref'],'path':l['path'],'he':l['he'],'segs':[],'error':str(e)})
        if i%25==0: print('   ',i,'/',len(ls),flush=True)
        time.sleep(0.12)
    json.dump(out,open(f'raw/{title}.json','w'),ensure_ascii=False)
    print(' wrote raw/%s.json  %d leaves, %d segs'%(title,len(out),sum(len(x['segs']) for x in out)),flush=True)
