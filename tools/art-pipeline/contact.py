import sys
from PIL import Image, ImageDraw
def sheet(files,out,cols=3,w=576):
    ims=[Image.open(f).convert('RGB') for f in files]; h=int(w*672/1152)
    rows=(len(ims)+cols-1)//cols; c=Image.new('RGB',(cols*w,rows*(h+18)),(20,20,30)); d=ImageDraw.Draw(c)
    for i,(f,im) in enumerate(zip(files,ims)):
        x,y=(i%cols)*w,(i//cols)*(h+18); c.paste(im.resize((w,h)),(x,y+18)); d.text((x+4,y+3),f.split('/')[-2]+'/'+f.split('/')[-1],fill=(255,230,120))
    c.save(out,quality=88); print(out,c.size)
if __name__=='__main__':
    sheet(sys.argv[3:],sys.argv[1],int(sys.argv[2]))
