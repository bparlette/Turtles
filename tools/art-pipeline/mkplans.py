import json,sys
tag=sys.argv[1]  # before/after
D=f'/workspace/work/shared_art/shots/{tag}'
setup="(()=>{const S=__SS.STATE;S.enemies.length=0;S.queue=[];const p=S.player;p.hp=16;p.inv=99999;p.x=S.camX+70;p.y=190;p.facing=1;})()"
scene="""(()=>{const S=__SS.STATE,c=S.camX;S.props=[];S.items=[];S.stars=[];
['barrel','crate','trash','cone'].forEach((k,i)=>__SS.spawnProp({kind:k,x:c+130+i*34,y:178}));
const r=__SS.spawnProp({kind:'barrel',x:c+300,y:178});r.state='roll';r.vx=0.0001;r.rot=0.6;r.hit=new Set();r.rollT=1;
__SS.spawnItem({kind:'pizza',x:c+140,y:206});__SS.spawnItem({kind:'slice',x:c+175,y:206});
['brick','snowball','sludge','tire','rock'].forEach((k,i)=>S.stars.push({x:c+215+i*26,y:206,vx:0,kind:k,z:20}));
S.stars.push({x:c+345,y:206,vx:0});S.stars.push({x:c+365,y:206,vx:0,ray:true});
})()"""
def bro(i):
    st=[{"until":"__SS.STATE.scene==='stage'&&!!__SS.STATE.player","wait":400,"js":setup},{"wait":300}]
    if i==0:
        st+=[{"js":scene,"wait":60,"shot":f"{D}/scene.png"},{"js":"(()=>{const S=__SS.STATE;S.stars=[];S.props=[];S.items=[]})()"}]
    st+=[{"js":setup+";(()=>{const S=__SS.STATE;S.player.attackT=0;S.player.atk=null;S.player.z=0;S.player.inv=0})()","wait":500},{"js":"__SS.startSpecial(__SS.STATE.player)"}]
    for k,th in enumerate([0.12,0.5,0.9]):
        st+=[{"until":f"(()=>{{const p=__SS.STATE.player;return !p.atk||1-p.attackT/p.atkDur>={th}}})()","shot":f"{D}/spec{i}_{k}.png"}]
    return {"level":1,"bro":i,"steps":st}
for i in range(4): json.dump(bro(i),open(f'plans/{tag}_bro{i}.json','w'))
# title + map + pizza + boss HUD
json.dump({"level":1,"stage":False,"title":[{"wait":1500,"shot":f"{D}/title.png"}]},open(f'plans/{tag}_title.json','w'))
json.dump({"level":1,"steps":[{"until":"__SS.STATE.scene==='stage'","wait":300,"js":setup},
 {"js":"__SS.startMap(0,5,false)","wait":2500,"shot":f"{D}/map.png"}]},open(f'plans/{tag}_map.json','w'))
json.dump({"level":1,"steps":[{"until":"__SS.STATE.scene==='stage'","wait":300,"js":setup},
 {"js":"__SS.startPizza()","wait":1200,"shot":f"{D}/pizza.png"}]},open(f'plans/{tag}_pizza.json','w'))
