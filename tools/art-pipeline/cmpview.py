from PIL import Image
import json
ATL={'lenny':[0,7,122,150],'rafe':[0,2,99,150],'miko':[0,23,97,150],'donny':[0,32,154,150]}
rows=[]
for n in ATL:
    at=Image.open(f'site/atlas_{n}.png').convert('RGBA'); x,y,w,h=ATL[n]; idle=at.crop((x,y,x+w,y+h))
    sp=Image.open(f'out/atlas_sp_{n}.png').convert('RGBA')
    W=idle.width+sp.width+20; H=max(150,sp.height)+10
    c=Image.new('RGBA',(W,H),(60,60,70,255)); c.alpha_composite(idle,(0,H-idle.height)); c.alpha_composite(sp,(idle.width+20,H-sp.height)); rows.append(c)
W=max(r.width for r in rows); H=sum(r.height for r in rows); o=Image.new('RGB',(W,H),(60,60,70)); yy=0
for r in rows: o.paste(r.convert('RGB'),(0,yy)); yy+=r.height
o.save('view_spcmp.jpg')
