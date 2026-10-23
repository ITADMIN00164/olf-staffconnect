const fs=require('fs');
const dec=s=>s.split('&lt;').join('<').split('&gt;').join('>').split('&quot;').join('"').split('&apos;').join("'").split('&amp;').join('&');
function load(dir){
  const ss=fs.existsSync(dir+'/x/xl/sharedStrings.xml')?fs.readFileSync(dir+'/x/xl/sharedStrings.xml','utf8'):'';
  const strs=[...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')));
  const out={};
  for(const f of fs.readdirSync(dir+'/x/xl/worksheets').filter(f=>f.endsWith('.xml'))){
    const x=fs.readFileSync(dir+'/x/xl/worksheets/'+f,'utf8');const rows=[];
    for(const rm of x.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){const r=[];
      for(const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
        const col=cm[1].split('').reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1;const t=/t="([a-z]+)"/.exec(cm[2]);const v=/<v>([\s\S]*?)<\/v>/.exec(cm[3]||'');const is=/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(cm[3]||'');
        let val=v?v[1]:(is?is[1]:'');if(t&&t[1]==='s')val=strs[+val];r[col]=dec(String(val??''));}
      rows.push(r);}
    out[f]=rows;}
  return out;
}
module.exports=load;
if(require.main===module){const d=process.argv[2];const o=load(d);for(const f in o){const r=o[f];console.log('---',f,'rows',r.length);console.log(JSON.stringify(r[0]));console.log(JSON.stringify(r[1]));}}
