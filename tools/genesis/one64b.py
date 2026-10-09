from PIL import Image, ImageDraw, ImageFont
import numpy as np
exec(open('native4.py').read().split('Ln,lc=')[0])
def pipe2(path,H,anch,F=48,n=12):
    im=ref(path); a=np.array(im); m=a[:,:,3]>128
    f=Image.fromarray(a[:,:,:3]).quantize(F,method=Image.MEDIANCUT,dither=Image.NONE)
    idx=np.array(f).astype(int); idx[~m]=F; pf=np.array(f.getpalette()[:3*F]).reshape(-1,3)
    DARK=np.append((pf.max(1)<45).astype(int),0)
    h,w=idx.shape; W=round(w*H/h); out=np.full((H,W),F)
    ys=np.linspace(0,h,H+1).astype(int); xs=np.linspace(0,w,W+1).astype(int)
    for y in range(H):
        for x in range(W):
            b=idx[ys[y]:ys[y+1],xs[x]:xs[x+1]].ravel(); c=np.bincount(b,minlength=F+1)
            if c[F]<b.size*0.5:
                c[F]=0; tot=c.sum(); dk=c*DARK; 
                if dk.sum()<tot*0.92: c=c*(1-DARK)
                out[y,x]=c.argmax()
    sm=out<F; s=np.zeros((H,W,3),int); s[sm]=pf[out[sm]]
    base=Image.fromarray(s.astype(np.uint8)).quantize(n,method=Image.MEDIANCUT,dither=Image.NONE)
    pal=G(np.vstack([np.array(base.getpalette()[:3*n]).reshape(-1,3),anch]))
    d=((s[:,:,None,:]-pal[None,None])**2).sum(3); o=pal[d.argmin(2)]
    res=np.zeros((H,W,4),np.uint8); res[sm,:3]=o[sm]; res[sm,3]=255
    al=res[:,:,3]>0; pad=np.pad(al,1); nb=pad[:-2,1:-1]|pad[2:,1:-1]|pad[1:-1,:-2]|pad[1:-1,2:]
    edge=al&~(pad[:-2,1:-1]&pad[2:,1:-1]&pad[1:-1,:-2]&pad[1:-1,2:]); res[edge,:3]=0
    return Image.fromarray(res), len(np.unique(o[sm],axis=0))
im,nc=pipe2('lenny_64_raw.png',64,[(36,73,219),(219,219,255),(0,0,0)])
w,h=im.size; W=-(-w//8)*8; cv=Image.new('RGBA',(W,64),(0,0,0,0)); cv.alpha_composite(im,((W-w)//2,0))
cv.save('lenny64_final.png')
a=np.array(cv); m=a[:,:,3]>0; cols=[tuple(c) for c in np.unique(a[m][:,:3],axis=0)]
idx=np.zeros(m.shape,np.uint8)
for i,c in enumerate(cols,1): idx[m&(a[:,:,:3]==c).all(2)]=i
p=Image.fromarray(idx,'P'); p.putpalette([255,0,255]+[v for c in cols for v in c]+[0]*(765-3*len(cols))); p.save('lenny_genesis_indexed.png',transparency=0)
leo=ref('tmnt-arc_leo_stand.png'); raw=ref('lenny_64_raw.png')
S=6; ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
rh=64*S; rawv=raw.resize((round(raw.size[0]*rh/raw.size[1]),rh),Image.LANCZOS)
ims=[(rawv,"Redraw (before shrink)"),(cv.resize((W*S,64*S),Image.NEAREST),f"Genesis-ready {W}x64, {len(cols)} colors"),(leo.resize((leo.size[0]*S,leo.size[1]*S),Image.NEAREST),"Konami arcade")]
cw=[i.size[0]+40 for i,_ in ims]; cw=[max(c,330) for c in cw]
c=Image.new('RGBA',(sum(cw)+20,rh+70),(26,14,44,255)); d=ImageDraw.Draw(c); x=20
for (i,t),wd in zip(ims,cw):
    c.alpha_composite(i,(x,50+rh-i.size[1])); d.text((x,12),t,fill=(90,224,255),font=ft); x+=wd
c.convert('RGB').save('lenny64_compare.png'); print(W,len(cols),c.size)
