from PIL import Image, ImageDraw, ImageFont
import numpy as np
exec(open('native4.py').read().split('Ln,lc=')[0])
out=[]
for name,H,anch in [('lenny',64,[(36,72,219),(182,182,219),(0,0,0)]),('ramrod',72,[(146,146,182),(182,146,73),(0,0,0)])]:
    im,nc=pipe(f'{name}_16bit_raw.png',H,anch,64)
    w,h=im.size; W=-(-w//8)*8; Hh=-(-h//8)*8
    cv=Image.new('RGBA',(W,Hh),(0,0,0,0)); cv.alpha_composite(im,((W-w)//2,Hh-h))
    a=np.array(cv); m=a[:,:,3]>0; cols=[tuple(c) for c in np.unique(a[m][:,:3],axis=0)]
    pal=[(255,0,255)]+cols; idx=np.zeros(m.shape,np.uint8)
    for i,c in enumerate(cols,1): idx[m&(a[:,:,:3]==c).all(2)]=i
    p=Image.fromarray(idx,'P'); p.putpalette([v for c in pal for v in c]+[0]*(768-3*len(pal))); p.info['transparency']=0
    p.save(f'{name}_genesis_indexed.png',transparency=0)
    tiles=(W//8)*(Hh//8); out.append((name,cv,len(cols),W,Hh,tiles)); print(name,W,Hh,len(cols),tiles)
leo=ref('tmnt-arc_leo_stand.png'); rock=ref('tmnt-arc_rocksteady_stand.png')
S=5; ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
ims=[(out[0][1],f"Lenny {out[0][3]}x{out[0][4]}, {out[0][2]} colors"),(leo,"Konami Leo"),(out[1][1],f"Ramrod {out[1][3]}x{out[1][4]}, {out[1][2]} colors"),(rock,"Konami Rocksteady")]
colw=max(max(i.size[0]*S for i,_ in ims),260)+30; rh=max(i.size[1] for i,_ in ims)*S
c=Image.new('RGBA',(colw*4+20,rh+90),(26,14,44,255)); d=ImageDraw.Draw(c)
for j,(i,t) in enumerate(ims):
    b=i.resize((i.size[0]*S,i.size[1]*S),Image.NEAREST); c.alpha_composite(b,(20+j*colw,50+rh-b.size[1]))
    d.text((20+j*colw,12),t,fill=(90,224,255) if j%2==0 else (255,255,255),font=ft)
c.convert('RGB').save('char64.png')
