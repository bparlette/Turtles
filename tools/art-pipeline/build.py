from PIL import Image
import numpy as np, json, os
from scipy import ndimage as ndi
from segutil import load, comps, cut, clean
OUT='out'; os.makedirs(OUT,exist_ok=True)
def white_key(a):
    a=a.astype(np.float32); rgb=a[...,:3]; mn=rgb.min(-1); mx=rgb.max(-1)
    cand=(mn>215)&((mx-mn)<22)
    lab,n=ndi.label(cand); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border))
    fg=~bg; dist=ndi.distance_transform_edt(fg)
    whit=np.clip((255-mn)/50.0,0,1)
    al=np.where(dist<=2,whit,1.0)*fg
    A=al[...,None]; rgb2=np.where(A>0.02,(rgb-(1-A)*255)/np.maximum(A,1e-3),0)
    return np.dstack([np.clip(rgb2,0,255),al*255]).astype(np.uint8)
def magenta_key(a):
    a=a.astype(np.float32); r,g,b=a[...,0],a[...,1],a[...,2]
    d=np.sqrt((r-255)**2+(g-0)**2*1.5+(b-255)**2)
    al=np.clip((d-60)/80,0,1)
    # unmix magenta
    A=al[...,None]; bgc=np.array([255,0,255.]); rgb2=np.where(A>0.02,(a[...,:3]-(1-A)*bgc)/np.maximum(A,1e-3),0)
    return np.dstack([np.clip(rgb2,0,255),al*255]).astype(np.uint8)
def lightgreen_fix(a):
    a=a.copy(); r,g,b=[a[...,i].astype(int) for i in range(3)]
    bad=(g>r+18)&(g>b+18)&(np.minimum(r,b)>120)
    bad=ndi.binary_opening(bad,iterations=1)
    a[bad,3]=0; return a
def trim(f):
    ys,xs=np.nonzero(f[...,3]>8); return f[ys.min():ys.max()+1,xs.min():xs.max()+1]
def rs(f,k):
    im=Image.fromarray(f,'RGBA'); return np.array(im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS))
def pack(frames,out,pad=4):
    W=sum(f.shape[1]+pad for _,f in frames); H=max(f.shape[0] for _,f in frames)
    sh=np.zeros((H,W,4),np.uint8); x=0; meta={}
    for nm,f in frames:
        h,w=f.shape[:2]; sh[H-h:,x:x+w]=f; meta[nm]=[x,H-h,w,h]; x+=w+pad
    Image.fromarray(sh,'RGBA').save(out,optimize=True); print(out,sh.shape,os.path.getsize(out)); return meta
SC=4  # stored px per world px
meta={}
# ---- props: target world heights match old code-drawn props (PROP_K=1.7 grid)
a=load('props_raw.png'); lab,cs=comps(a)
P=[cut(a,lab,c) for c in cs]
tgt={'barrel':19*1.7,'drum_side':None,'crate':15*1.7,'trash':20*1.7,'cone':12*1.7}
k_b=tgt['barrel']*SC/P[0].shape[0]
fr=[('barrel',rs(P[0],k_b)),('barrel_side',rs(P[1],k_b)),('crate',rs(P[2],tgt['crate']*SC/P[2].shape[0])),('trash',rs(P[3],tgt['trash']*SC/P[3].shape[0])),('cone',rs(P[4],tgt['cone']*SC/P[4].shape[0]))]
# ---- items
a=load('items_raw.png'); lab,cs=comps(a); I=[cut(a,lab,c) for c in cs]
rb=I[3]; r,g,b=[rb[...,i].astype(int) for i in range(3)]
red=(r>g+25)&(rb[...,3]>40); red=ndi.binary_opening(red,iterations=2); l,n=ndi.label(red); sz=ndi.sum(red,l,range(1,n+1)); brickm=ndi.binary_fill_holes(ndi.binary_closing(l==np.argmax(sz)+1,iterations=3))
brick=rb.copy(); brick[~brickm,3]=0; rock=rb.copy(); rock[ndi.binary_dilation(brickm,iterations=2),3]=0
l,n=ndi.label(rock[...,3]>40); sz=ndi.sum(rock[...,3]>40,l,range(1,n+1)); rock[l!=np.argmax(sz)+1,3]=0
brick,rock=trim(brick),trim(rock)
sl=magenta_key(np.array(Image.open('sludge_raw.png').convert('RGB'))); l,n=ndi.label(sl[...,3]>40); sz=ndi.sum(sl[...,3]>40,l,range(1,n+1)); sl[l!=np.argmax(sz)+1,3]=0; sl=trim(sl)
W_=lambda f,w: rs(f,w*SC/f.shape[1])
fr+=[('pizza',W_(I[0],34)),('slice',rs(I[1],15*1.4*SC/I[1].shape[0])),('tire',W_(I[2],13)),('rock',W_(rock,10)),('brick',W_(brick,11)),('snowball',W_(I[4],9)),('sludge',W_(sl,10)),('star',W_(I[6],9))]
meta['shared']=pack(fr,f'{OUT}/shared_sprites.png')
json.dump(meta,open(f'{OUT}/meta.json','w'))
print(json.dumps(meta))
