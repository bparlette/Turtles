import sys,glob
from PIL import Image
fs=sorted(glob.glob(sys.argv[1]+'/*.png')); cols=3
ims=[Image.open(f).convert('RGB') for f in fs]; w=576; hh=int(w*224/384)
out=Image.new('RGB',(cols*w,((len(ims)+cols-1)//cols)*hh),'white')
for i,im in enumerate(ims): out.paste(im.resize((w,hh)),((i%cols)*w,(i//cols)*hh))
out.save(sys.argv[2],quality=85)
