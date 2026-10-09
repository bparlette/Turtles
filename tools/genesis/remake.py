from PIL import Image, ImageFilter, ImageDraw, ImageFont
import numpy as np
im=Image.open('/workspace/work/deploy/shell-shock-live-action/levels/level6_park.jpg').convert('RGB'); w,h=im.size
s=224/h; g=im.resize((round(w*s),224),Image.LANCZOS); x0=min(200,g.size[0]-320); g=g.crop((x0,0,x0+320,224))
orig=im.crop((round(x0/s),0,round((x0+320)/s),h)).resize((640,448),Image.LANCZOS)
def g9(a): return (np.round(np.asarray(a)/255*7)*255/7).astype(np.uint8)
f=g.filter(ImageFilter.ModeFilter(3)).filter(ImageFilter.MedianFilter(3))
q=f.quantize(22,method=Image.FASTOCTREE,kmeans=8,dither=Image.NONE).convert('RGB')
A=g9(np.array(q)).astype(int); O=np.array(g).astype(int)
# sky: rows where original is dark-blue & smooth -> banded gradient
sky=(O[:,:,2]>O[:,:,0]+15)&(O.sum(2)<330)
bands=[(24,32,64),(32,44,84),(40,56,100),(48,68,116),(56,80,128)]
for y in range(224):
    b=g9(np.array(bands[min(4,y*5//110)]))
    m=sky[y]&(y<120); A[y][m]=b
# keep stars: bright pixels in sky region
st=(O.sum(2)>560)&(np.arange(224)[:,None]<110)&sky
A[st]=[255,255,255]
# ground snow: flatten to 3 bands of light blue using luminance
gy=np.arange(224)[:,None]>=172
lum=O.mean(2); pal=[g9(np.array(c)) for c in [(120,150,200),(160,190,230),(210,226,250)]]
for i,(lo,hi) in enumerate([(0,140),(140,185),(185,999)]):
    m=gy&(lum>=lo)&(lum<hi); A[m]=pal[i]
# lamp glow: hard 2-step halos where warm
warm=(O[:,:,0]>O[:,:,2]+20)&(lum>150); A[warm]=g9(np.array([255,220,130]))
R=Image.fromarray(A.astype(np.uint8))
a=np.array(R); T=set((a[y:y+8,x:x+8].tobytes()) for y in range(0,224,8) for x in range(0,320,8))
cols=len(np.unique(a.reshape(-1,3),axis=0))
print('tiles',len(T),'colors',cols)
pad=16; ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
c=Image.new('RGB',(640*2+pad*3,448+pad*2+30),(26,14,44)); d=ImageDraw.Draw(c)
d.text((pad,pad),"Ours, painted",fill=(255,224,64),font=ft); d.text((640+pad*2,pad),f"16-bit remake: {cols} colors, {len(T)} tiles",fill=(90,224,255),font=ft)
c.paste(orig,(pad,pad+30)); c.paste(R.resize((640,448),Image.NEAREST),(640+pad*2,pad+30)); c.save('bg_remake.png')
