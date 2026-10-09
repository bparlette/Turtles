const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');const re=/<script>([\s\S]*?)<\/script>/g;let m,i=0;
for(;(m=re.exec(h));i++){fs.writeFileSync('/tmp/chk_'+i+'.js',m[1]);require('child_process').execSync('node --check /tmp/chk_'+i+'.js',{stdio:'inherit'});}console.log('scripts ok',i);
