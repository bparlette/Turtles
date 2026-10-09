from PIL import Image
import numpy as np
from scipy import ndimage as nd
im=Image.open('lenny_64_raw.png').convert('RGBA'); a=np.array(im).astype(int); al=a[:,:,3]>128
rgb=a[:,:,:3]; blk=(rgb.max(2)<60)&al
inner=nd.binary_erosion(al,iterations=12)          # keep outer outline
fill=blk&inner
src=~fill & al & ~blk
_,(iy,ix)=nd.distance_transform_edt(~src,return_indices=True)
rgb2=rgb.copy(); rgb2[fill]=rgb[iy[fill],ix[fill]]
# brighten green skin toward lime
g=(rgb2[:,:,1]>rgb2[:,:,0]+25)&(rgb2[:,:,1]>rgb2[:,:,2]+25)&al
hsv=np.array(Image.fromarray(rgb2.astype(np.uint8)).convert('HSV')).astype(int)
hsv[g,2]=np.clip(hsv[g,2]*1.35+30,0,255); hsv[g,0]=np.clip(hsv[g,0]-6,0,255)
rgb3=np.array(Image.fromarray(hsv.astype(np.uint8),'HSV').convert('RGB'))
out=np.dstack([rgb3,a[:,:,3]]).astype(np.uint8); Image.fromarray(out).save('lenny_64_flat.png')
