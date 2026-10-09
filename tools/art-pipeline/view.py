import sys
from PIL import Image
for f in sys.argv[1:]:
    im=Image.open(f).convert('RGBA'); s=min(1,1600/im.width)
    bg=Image.new('RGBA',im.size,(60,60,70,255)); bg.alpha_composite(im); bg=bg.convert('RGB')
    bg.resize((int(im.width*s),int(im.height*s))).save(f.rsplit('.',1)[0]+'_v.jpg'); print(f,im.size)
