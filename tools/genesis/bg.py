from PIL import Image, ImageDraw, ImageFont
import numpy as np
im=Image.open('/workspace/work/deploy/shell-shock-live-action/levels/level6_park.jpg').convert('RGB'); print(im.size)
w,h=im.size
# Genesis screen: 320x224. Scale bg to 224 tall, crop 320 wide from left-middle
s=224/h; g=im.resize((round(w*s),224),Image.LANCZOS); x0=min(200,g.size[0]-320); g=g.crop((x0,0,x0+320,224))
orig=im.crop((round(x0/s),0,round((x0+320)/s),h)).resize((640,448),Image.LANCZOS)
def g9(a): return (np.round(np.asarray(a)/255*7)*255/7).astype(np.uint8)
# 2 palettes x 15 colors ~ 30 colors, ordered dither-free
q=g.quantize(30,method=Image.FASTOCTREE,kmeans=6,dither=Image.FLOYDSTEINBERG).convert('RGB')
q=Image.fromarray(g9(np.array(q)))
# tile count
a=np.array(q); tiles=set()
for ty in range(0,224,8):
  for tx in range(0,320,8): tiles.add(a[ty:ty+8,tx:tx+8].tobytes())
print('unique tiles one screen', len(tiles))
# full level unique tiles at genesis res
G=im.resize((round(w*s),224),Image.LANCZOS).quantize(30,method=Image.FASTOCTREE,dither=Image.NONE)
A=np.array(G); T=set()
for ty in range(0,224-7,8):
  for tx in range(0,A.shape[1]-7,8): T.add(A[ty:ty+8,tx:tx+8].tobytes())
print('level width', A.shape[1], 'unique tiles', len(T))
qq=q.resize((640,448),Image.NEAREST)
pad=16; ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
c=Image.new('RGB',(640*2+pad*3,448+pad*2+30),(26,14,44)); d=ImageDraw.Draw(c)
d.text((pad,pad),"Ours, painted",fill=(255,224,64),font=ft); d.text((640+pad*2,pad),"Genesis: 320x224, 30 colors",fill=(90,224,255),font=ft)
c.paste(orig,(pad,pad+30)); c.paste(qq,(640+pad*2,pad+30)); c.save('bg_compare.png')
