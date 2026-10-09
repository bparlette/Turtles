from PIL import Image
import numpy as np, json, os, colorsys
from scipy import ndimage as ndi
from segutil import load, comps, cut
from build import white_key, lightgreen_fix, trim, rs, pack
ATL={'lenny':{'idle':[0,7,122,150],'walk':[124,8,85,149],'attack':[328,17,173,140],'hurt':[669,0,95,157]},
 'rafe':{'idle':[0,2,99,150],'walk':[101,0,110,152],'attack':[213,15,169,137]},
 'miko':{'idle':[0,23,97,150],'walk':[99,17,99,156],'attack':[200,0,125,173]},
 'donny':{'idle':[0,32,154,150],'walk':[156,12,94,170],'attack':[252,33,150,149]}}
HUE={'lenny':(0.55,0.70),'rafe':(-0.04,0.03),'miko':(0.03,0.10),'donny':(0.72,0.85)}
def maskpx(f,n):
    a=f.astype(np.float32)/255; r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
    mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b); s=(mx-mn)/np.maximum(mx,1e-3)
    import numpy as _n
    h=_n.zeros_like(mx); d=_n.maximum(mx-mn,1e-6)
    h=_n.where(mx==r,((g-b)/d)%6,_n.where(mx==g,(b-r)/d+2,(r-g)/d+4))/6
    lo,hi=HUE[n]
    hm=((h>=lo%1)&(h<=hi)) if lo>=0 else ((h>=lo%1)|(h<=hi))
    return int((hm&(s>0.45)&(mx>0.25)&(al>0.8)).sum())
# per-brother: raw sheet -> frames (left to right)
FR={'lenny':['spin1','spin2','land'],'miko':['copter1','copter2','land'],'donny':['vault','flip','slam'],'rafe':['dive1','dive2','land']}
meta={}
for n in FR:
    a=load(f'spec_{n}_raw.png')
    if n=='lenny': a=white_key(a)
    if n=='donny': a=lightgreen_fix(a)
    lab,cs=comps(a,minpix=8000); cs=sorted(cs,key=lambda c:-c['n'])[:3]; cs.sort(key=lambda c:c['x0'])
    fr=[cut(a,lab,c) for c in cs]
    at=np.array(Image.open(f'site/atlas_{n}.png').convert('RGBA'))
    ref=np.median([maskpx(at[y:y+h,x:x+w],n) for x,y,w,h in ATL[n].values()])
    gen=np.median([maskpx(f,n) for f in fr])
    k=np.sqrt(ref/gen)*(1.12 if n=='miko' else 1); print(n,'ref',ref,'gen',gen,'k',k,[f.shape for f in fr])
    fr=[(nm,rs(f,k)) for nm,f in zip(FR[n],fr)]
    m=pack(fr,f'out/atlas_sp_{n}.png')
    meta[n]=m
json.dump(meta,open('out/meta_sp.json','w')); print(json.dumps(meta))
