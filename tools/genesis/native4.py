from PIL import Image, ImageDraw, ImageFont
import numpy as np
exec(open('cmp.py').read().split('ref=lambda')[0])
ref=lambda n:(lambda i:i.crop(i.getbbox()))(Image.open(n).convert('RGBA'))
G=lambda a:(np.round(np.asarray(a,float)/255*7)*255/7).astype(int)
def pipe(path,H,anch,F=24):
    im=ref(path); a=np.array(im); m=a[:,:,3]>128
    f=Image.fromarray(a[:,:,:3]).quantize(F,method=Image.MEDIANCUT,dither=Image.NONE).convert('RGB')  # flatten first
    w,h=im.size; W=round(w*H/h)
    s=np.array(f.resize((W,H),Image.NEAREST)); sm=np.array(Image.fromarray(m.astype(np.uint8)*255).resize((W,H),Image.NEAREST))>128
    base=Image.fromarray(s.astype(np.uint8)).quantize(12,method=Image.MEDIANCUT,dither=Image.NONE)
    pal=G(np.vstack([np.array(base.getpalette()[:36]).reshape(-1,3),anch]))
    d=((s[:,:,None,:].astype(int)-pal[None,None])**2).sum(3); out=pal[d.argmin(2)]
    res=np.zeros((H,W,4),np.uint8); res[sm,:3]=out[sm]; res[sm,3]=255
    return Image.fromarray(res), len(np.unique(out[sm],axis=0))
def scaled(im,H,m=Image.LANCZOS): w,h=im.size; return im.resize((round(w*H/h),H),m)
Ln,lc=pipe('lenny_16bit_raw.png',96,[(36,72,218),(182,182,218),(0,0,0)],64)
Rn,rc=pipe('ramrod_16bit_raw.png',112,[(145,145,182),(182,145,72),(0,0,0)],64)
Ln.save('lenny_16bit_native.png'); Rn.save('ramrod_16bit_native.png')
def other(p):
    o=np.array(Image.open(p).convert('RGBA')); bgc=o[0,0,:3]; o[(np.abs(o[:,:,:3].astype(int)-bgc).sum(2)<12)]=0
    O=Image.fromarray(o); O=O.resize((136,96),Image.NEAREST); return O.crop(O.getbbox())
O1=other('/workspace/uploads/IMG_8838.png'); O2=other('/workspace/uploads/IMG_8839.png')
leo=ref('tmnt-arc_leo_stand.png')
ims=[O1,O2,Ln,leo]; S=4
ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
heads=["Other AI: bright","Other AI: faithful",f"Mine: redraw ({lc} colors)","Konami arcade"]
colw=max(i.size[0] for i in ims)*S+30; rh=max(i.size[1] for i in ims)*S
c=Image.new('RGBA',(colw*4+20,rh+80),(26,14,44,255)); d=ImageDraw.Draw(c)
for j,(t,i) in enumerate(zip(heads,ims)):
    d.text((20+j*colw,12),t,fill=[(255,150,150),(255,150,150),(90,224,255),(255,255,255)][j],font=ft)
    b=i.resize((i.size[0]*S,i.size[1]*S),Image.NEAREST); c.alpha_composite(b,(20+j*colw,50+rh-b.size[1]))
c.convert('RGB').save('char_final.png')
R=Rn.resize((Rn.size[0]*S,Rn.size[1]*S),Image.NEAREST); r=Image.new('RGBA',(R.size[0]+40,R.size[1]+40),(26,14,44,255)); r.alpha_composite(R,(20,20)); r.convert('RGB').save('ramrod_final.png')
print(lc,rc,Ln.size,Rn.size,[i.size for i in ims])
