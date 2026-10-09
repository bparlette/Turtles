from PIL import Image
import numpy as np, json
from scipy import ndimage as ndi
from segutil import clean
T=72
SPEC=[('port_turtles_raw.png','row',['lenny','rafe','miko','donny']),('port_b1_raw.png','row',['ramrod','zap','scorcher','brickjaw']),
('port_b2_raw.png','row',['gulch','jetwash','grimwale','coldfront']),('port_b3b_raw.png','grid',['rustmaul','razorback','karai','armaggon']),
('port_b4b_raw.png','grid',['leatherhead','viral','traag','granitor']),('port_b5_raw.png','row',['krang','shredder','super'])]
tiles=[]
OVR={'zap':(290,140,260),'coldfront':(835,60,238),'krang':(70,400,340)}
for f,mode,names in SPEC:
    a=np.array(Image.open(f).convert('RGBA')); H,W=a.shape[:2]; n=len(names)
    cells=[(i*W//n,0,(i+1)*W//n,H) for i in range(n)] if mode=='row' else [(0,0,W//2,H//2),(W//2,0,W,H//2),(0,H//2,W//2,H),(W//2,H//2,W,H)]
    for nm,(x0,y0,x1,y1) in zip(names,cells):
        if nm in OVR:
            X,Y,S=OVR[nm]; tiles.append((nm,Image.fromarray(clean(a[Y:Y+S,X:X+S].copy()),'RGBA').resize((T,T),Image.LANCZOS))); continue
        c=a[y0:y1,x0:x1].copy(); m=c[...,3]>60
        lab,k=ndi.label(m); 
        if k>1: sz=ndi.sum(m,lab,range(1,k+1)); m=lab==np.argmax(sz)+1; c[~ndi.binary_dilation(m,iterations=2),3]=0
        ys,xs=np.nonzero(m); bx0,bx1,by0,by1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        bw=bx1-bx0; side=int(min(bw,by1-by0)*(0.82 if mode=='row' and bw>(x1-x0)*0.6 and nm not in('lenny','rafe','miko','donny') else 1.0))
        # centre horizontally on head (top 25% of figure)
        top=m[by0:by0+max(4,side//3)]; hx=int(np.nonzero(top)[1].mean())
        cx0=int(np.clip(hx-side//2,0,c.shape[1]-side)); cy0=max(0,by0-int(side*0.04))
        sq=c[cy0:cy0+side,cx0:cx0+side]
        im=Image.fromarray(clean(sq),'RGBA').resize((T,T),Image.LANCZOS); tiles.append((nm,im))
sheet=Image.new('RGBA',(T*len(tiles),T)); meta={}
for i,(nm,im) in enumerate(tiles): sheet.paste(im,(i*T,0)); meta[nm]=i
sheet.save('out/portraits.png',optimize=True); json.dump(meta,open('out/meta_port.json','w')); print(meta, sheet.size)
v=Image.new('RGB',sheet.size,(16,16,28)); v.paste(sheet,mask=sheet.split()[3]); v.resize((sheet.width*2//2,T)).save('view_port.jpg')
