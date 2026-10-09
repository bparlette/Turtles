from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import numpy as np
exec(open('cmp.py').read().split('ref=lambda')[0])
ref=lambda n:(lambda i:i.crop(i.getbbox()))(Image.open(n).convert('RGBA'))
def g9(a): return (np.round(a/255*7)*255/7).astype(np.uint8)
ANCH=[]
def native(path,H,n=15):
    im=ref(path); a=np.array(im); m=a[:,:,3]>128
    rgb=ImageEnhance.Color(Image.fromarray(a[:,:,:3])).enhance(1.25)
    rgb=ImageEnhance.Brightness(rgb).enhance(1.15)
    base=rgb.quantize(n-len(ANCH),method=Image.MEDIANCUT,dither=Image.NONE)
    pal=np.vstack([np.array(base.getpalette()[:3*(n-len(ANCH))]).reshape(-1,3)]+[np.array(ANCH)]) if ANCH else np.array(base.getpalette()[:3*n]).reshape(-1,3)
    pi=Image.new('P',(1,1)); pi.putpalette(list(pal.ravel())+[0]*(768-pal.size))
    q=rgb.quantize(palette=pi,dither=Image.NONE); idx=np.array(q).astype(int); idx[~m]=n
    h,w=idx.shape; W=round(w*H/h); out=np.zeros((H,W),int)
    ys=np.linspace(0,h,H+1).astype(int); xs=np.linspace(0,w,W+1).astype(int)
    for y in range(H):
        for x in range(W):
            b=idx[ys[y]:ys[y+1],xs[x]:xs[x+1]].ravel(); cnt=np.bincount(b,minlength=n+1)
            if cnt[n]>b.size*0.55: out[y,x]=n
            else: cnt[n]=0; out[y,x]=cnt.argmax()
    res=np.zeros((H,W,4),np.uint8); vis=out<n
    res[vis,:3]=g9(pal[out[vis]].astype(float)); res[vis,3]=255
    return Image.fromarray(res), len(np.unique(res[vis][:,:3],axis=0))
def scaled(im,H,m=Image.LANCZOS): w,h=im.size; return im.resize((round(w*H/h),H),m)
leo=ref('tmnt-arc_leo_stand.png'); rock=ref('tmnt-arc_rocksteady_stand.png'); LH,RH=leo.size[1],rock.size[1]
ANCH=[(40,90,220),(80,150,255),(200,210,225)]
Ln,lc=native('lenny_16bit_raw.png',int(LH*1.5))
ANCH=[]; Rn,rc=native('ramrod_16bit_raw.png',int(RH*1.5))
Ln.save('lenny_16bit_native.png'); Rn.save('ramrod_16bit_native.png')
o=np.array(Image.open('/workspace/uploads/IMG_8838.png').convert('RGBA')); bgc=o[0,0,:3]
o[(np.abs(o[:,:,:3].astype(int)-bgc).sum(2)<12)]=0; O=Image.fromarray(o); O=O.crop(O.getbbox()); O=scaled(O,LH,Image.NEAREST)
blank=Image.new('RGBA',(1,1),(0,0,0,0))
rows=[[scaled(frame0('atlas_lenny.png'),LH),O,Ln,leo,f"{lc} colors"],[scaled(frame0('atlas_ramrod.png'),RH),blank,Rn,rock,f"{rc} colors"]]
S=4; ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
heads=["Painted, shrunk","Other AI convert","My redraw (1.5x size)","Konami arcade"]
colw=max(max(i.size[0] for i in r[:4]) for r in rows)*S+30
H=sum(max(i.size[1] for i in r[:4])*S+50 for r in rows)+50
c=Image.new('RGBA',(colw*4+20,H),(26,14,44,255)); d=ImageDraw.Draw(c)
for j,t in enumerate(heads): d.text((20+j*colw,12),t,fill=[(255,224,64),(255,150,150),(90,224,255),(255,255,255)][j],font=ft)
y=50
for r in rows:
    ims=r[:4]; rh=max(i.size[1] for i in ims)*S
    for j,i in enumerate(ims):
        big=i.resize((i.size[0]*S,i.size[1]*S),Image.NEAREST); c.alpha_composite(big,(20+j*colw,y+rh-big.size[1]))
    d.text((20+2*colw,y+rh+8),r[4],fill=(90,224,255),font=ft); y+=rh+50
c.convert('RGB').save('char_remake.png'); print(lc,rc,Ln.size,Rn.size)
