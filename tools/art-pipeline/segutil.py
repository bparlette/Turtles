from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def load(p): return np.array(Image.open(p).convert('RGBA'))
def comps(a,minpix=1500,thr=40):
    m=a[...,3]>thr; lab,n=ndi.label(m,structure=np.ones((3,3)))
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=(lab[sl]==i).sum()
        if cnt>=minpix: out.append(dict(i=i,n=int(cnt),x0=sl[1].start,y0=sl[0].start,x1=sl[1].stop,y1=sl[0].stop))
    return lab,sorted(out,key=lambda c:(c['x0']))
def cut(a,lab,c,extra=None,keep_small_inside=True):
    m=lab==c['i']
    if keep_small_inside:
        sl=(slice(c['y0'],c['y1']),slice(c['x0'],c['x1']))
        sub=lab[sl]; ids=set(np.unique(sub))-{0,c['i']}
        for j in ids:
            mj=lab==j
            ys,xs=np.nonzero(mj)
            if xs.min()>=c['x0'] and xs.max()<c['x1'] and ys.min()>=c['y0'] and ys.max()<c['y1'] and mj.sum()<c['n']*0.2: m|=mj
    if extra is not None: m&=extra
    ys,xs=np.nonzero(m); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    sub=a[y0:y1,x0:x1].copy(); sub[...,3]=np.where(m[y0:y1,x0:x1],sub[...,3],0)
    return clean(sub)
def clean(sub):
    s=sub.astype(np.float32); r,g,b,al=s[...,0],s[...,1],s[...,2],s[...,3]
    mx=np.maximum(r,b)
    edge=al<250
    # despill green on semi-transparent edge and strong spill everywhere
    g2=np.where(g>mx+8, mx+(g-mx)*np.where(edge,0.1,0.6), g)
    al2=np.minimum(al, ndi.grey_erosion(al,size=(3,3))*0.4+al*0.6)
    return np.dstack([r,g2,b,al2]).clip(0,255).astype(np.uint8)
