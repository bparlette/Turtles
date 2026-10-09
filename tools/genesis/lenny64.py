from PIL import Image, ImageDraw, ImageFont
import numpy as np
from collections import Counter
G=lambda a:(np.round(np.asarray(a,float)/255*7)*255/7).astype(int)
im=Image.open('lenny_64_fixed.png').convert('RGBA'); im=im.crop(im.getbbox()); a=np.array(im).astype(int)
al=a[:,:,3]>128; rgb=a[:,:,:3]; blk=rgb.max(2)<50; coarse=(rgb//24)
H=64; h,w=al.shape; W=round(w*H/h)
ys=np.linspace(0,h,H+1).astype(int); xs=np.linspace(0,w,W+1).astype(int)
s=np.zeros((H,W,3),int); sm=np.zeros((H,W),bool)
for y in range(H):
  for x in range(W):
    sl=(slice(ys[y],ys[y+1]),slice(xs[x],xs[x+1])); A=al[sl]
    if A.mean()<0.45: continue
    sm[y,x]=True; B=blk[sl]&A; nb=A&~B
    if B.sum()>0.8*A.sum() or nb.sum()==0: s[y,x]=0; continue
    cc=Counter(map(tuple,coarse[sl][nb])).most_common(1)[0][0]
    sel=nb&(coarse[sl]==cc).all(2); s[y,x]=rgb[sl][sel].mean(0)
base=Image.fromarray(s.astype(np.uint8)).quantize(12,method=Image.MEDIANCUT,dither=Image.NONE)
pal=G(np.vstack([np.array(base.getpalette()[:36]).reshape(-1,3),[(36,73,219),(219,219,255),(0,0,0)]]))
o=pal[((s[:,:,None,:]-pal[None,None])**2).sum(3).argmin(2)]
p=np.pad(sm,1); edge=sm&~(p[:-2,1:-1]&p[2:,1:-1]&p[1:-1,:-2]&p[1:-1,2:]); o[edge]=0
Wp=-(-W//8)*8; res=np.zeros((H,Wp,4),np.uint8); off=(Wp-W)//2
res[:,off:off+W,:3][sm]=o[sm]; res[:,off:off+W,3][sm]=255
cv=Image.fromarray(res); cv.save('lenny64_final.png')
m=res[:,:,3]>0; cols=[tuple(c) for c in np.unique(res[m][:,:3],axis=0)]; idx=np.zeros(m.shape,np.uint8)
for i,c in enumerate(cols,1): idx[m&(res[:,:,:3]==c).all(2)]=i
P=Image.fromarray(idx,'P'); P.putpalette([255,0,255]+[v for c in cols for v in c]+[0]*(765-3*len(cols))); P.save('lenny_genesis_indexed.png',transparency=0)
leo=Image.open('tmnt-arc_leo_stand.png').convert('RGBA'); leo=leo.crop(leo.getbbox())
S=6; rh=64*S; ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
rawv=im.resize((round(w*rh/h),rh),Image.LANCZOS)
ims=[(rawv,"Redraw (before shrink)"),(cv.resize((Wp*S,H*S),Image.NEAREST),f"Genesis-ready {Wp}x64, {len(cols)} colors"),(leo.resize((leo.size[0]*S,leo.size[1]*S),Image.NEAREST),"Konami arcade")]
cw=[max(i.size[0]+40,330) for i,_ in ims]
c=Image.new('RGBA',(sum(cw)+20,rh+70),(26,14,44,255)); d=ImageDraw.Draw(c); x=20
for (i,t),wd in zip(ims,cw): c.alpha_composite(i,(x,50+rh-i.size[1])); d.text((x,12),t,fill=(90,224,255),font=ft); x+=wd
c.convert('RGB').save('lenny64_compare.png'); print(Wp,len(cols))
