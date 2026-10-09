from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np
D='/workspace/work/deploy/shell-shock-live-action/'
def frame0(f):
    im=Image.open(D+f).convert('RGBA'); a=np.array(im)[:,:,3]; w=im.size[0]
    cols=(a>20).any(0); s=None
    for x in range(w+1):
        c=cols[x] if x<w else False
        if c and s is None: s=x
        if not c and s is not None:
            if x-s>15: fr=im.crop((s,0,x,im.size[1])); return fr.crop(fr.getbbox())
            s=None
def g9(arr): return (np.round(np.asarray(arr)/255*7)*255/7).astype(np.uint8)
def auto(fr,H):
    w,h=fr.size; fr=fr.resize((max(1,round(w*H/h)),H),Image.LANCZOS)
    a=np.array(fr)[:,:,3]>110
    rgb=Image.new('RGB',fr.size); rgb.paste(fr,mask=Image.fromarray((a*255).astype(np.uint8)))
    q=np.array(rgb.quantize(16,method=Image.FASTOCTREE,kmeans=4,dither=Image.NONE).convert('RGB'))
    out=np.zeros((*a.shape,4),np.uint8); out[:,:,:3]=g9(q); out[:,:,3]=a*255; return Image.fromarray(out)
def clean(fr,H):
    w,h=fr.size; tw=max(1,round(w*H/h))
    rgb=fr.convert('RGB').point(lambda v:int(255*(v/255)**0.6)); rgb=ImageEnhance.Color(rgb).enhance(1.8); rgb=ImageEnhance.Contrast(rgb).enhance(1.1)
    sm=rgb.resize((tw,H),Image.BOX); a=np.array(fr.split()[3].resize((tw,H),Image.BOX))>120
    rgbm=Image.new('RGB',sm.size); rgbm.paste(sm,mask=Image.fromarray((a*255).astype(np.uint8)))
    q=rgbm.quantize(10,method=Image.FASTOCTREE,kmeans=8,dither=Image.NONE)
    idx=np.array(q.filter(ImageFilter.ModeFilter(3))); pal=np.array(q.getpalette()[:10*3]).reshape(-1,3)
    rgbq=g9(pal[np.clip(idx,0,9)])
    o=np.array(sm).astype(int); blue=(o[:,:,2]>o[:,:,0]+25)&(o[:,:,2]>o[:,:,1]+5)&a
    rgbq[blue]=g9(np.array([[60,140,255]]*int(blue.sum())).reshape(-1,3)) if blue.any() else rgbq[blue]
    pad=np.pad(a,1); edge=a & ~(pad[:-2,1:-1]&pad[2:,1:-1]&pad[1:-1,:-2]&pad[1:-1,2:])
    out=np.zeros((*a.shape,4),np.uint8); out[:,:,:3]=rgbq; out[:,:,3]=a*255
    out[edge,:3]=g9(rgbq[edge].astype(int)*0.25)
    return Image.fromarray(out)
ref=lambda n: (lambda i: i.crop(i.getbbox()))(Image.open(n+'.png').convert('RGBA'))
L=frame0('atlas_lenny.png'); R=frame0('atlas_ramrod.png')
la,ls,ra=ref('tmnt-arc_leo_stand'),ref('tmnt4-snes_leo_stand'),ref('tmnt-arc_rocksteady_stand')
HL,HR=la.size[1],ra.size[1]
rows=[(L,[("Ours, painted",None),("Auto 16-bit",auto(L,HL)),("Cleaned 16-bit",clean(L,HL)),("Arcade 1989",la),("SNES 1992",ls)]),
      (R,[("Ours, painted",None),("Auto 16-bit",auto(R,HR)),("Cleaned 16-bit",clean(R,HR)),("Arcade 1989",ra)])]
S=4; pad=16; colw=78*S; bg=(26,14,44)
ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
W=pad+5*(colw+pad); hs=[max(HL,HR)*S for _ in rows]
hs=[HL*S,HR*S]; Ht=pad+sum(h+40+pad for h in hs)
c=Image.new('RGB',(W,Ht),bg); d=ImageDraw.Draw(c); y=pad
for (fr,cs),h in zip(rows,hs):
    for k,(lab,im) in enumerate(cs):
        x=pad+k*(colw+pad); d.text((x,y),lab,fill=(255,224,64) if k<3 else (90,224,255),font=ft)
        z=fr.resize((round(fr.size[0]*h/fr.size[1]),h),Image.LANCZOS) if im is None else im.resize((im.size[0]*S,im.size[1]*S),Image.NEAREST)
        c.paste(z,(x+(colw-z.size[0])//2,y+32+(h-z.size[1])),z)
    y+=h+40+pad
c.save('sprite_compare.png'); print(c.size)
