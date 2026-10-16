import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

function poisson(k, lam){
  let f=1; for(let i=2;i<=k;i++) f*=i;
  return Math.exp(-lam)*Math.pow(lam,k)/f;
}
function getTeamData(nom){
  const n=(nom||'').toLowerCase();
  const db={
    'atletico':{recent:2.0,h2h:1.333},'espanyol':{recent:1.733,h2h:1.266},
    'bayern':{recent:2.4,h2h:1.9},'real':{recent:2.2,h2h:1.8},
    'city':{recent:2.3,h2h:1.85},'chelsea':{recent:1.9,h2h:1.6},
    'everton':{recent:1.15,h2h:0.95},'dortmund':{recent:1.8,h2h:1.4}
  };
  for(let k in db) if(n.includes(k)) return db[k];
  return {recent:1.35,h2h:1.15};
}
function analyseMatch(v1,v2){
  const d1=getTeamData(v1), d2=getTeamData(v2);
  const l1=d1.recent*0.6+d1.h2h*0.4, l2=d2.recent*0.6+d2.h2h*0.4;
  let p1x2={H:0,D:0,A:0}, over=0, gg=0, scores=[];
  for(let i=0;i<=5;i++) for(let j=0;j<=5;j++){
    let p=poisson(i,l1)*poisson(j,l2);
    scores.push({s:i+':'+j,p}); if(i>j) p1x2.H+=p; else if(i==j) p1x2.D+=p; else p1x2.A+=p;
    if(i+j>2.5) over+=p; if(i>0&&j>0) gg+=p;
  }
  const sum=p1x2.H+p1x2.D+p1x2.A;
  const pPrime={H:p1x2.H/sum,D:p1x2.D/sum,A:p1x2.A/sum};
  const cote={H:1/pPrime.H,D:1/pPrime.D,A:1/pPrime.A,OVER:1/over,GG:1/gg};
  scores.sort((a,b)=>b.p-a.p);
  return {v1,v2,l1,l2,pPrime,cote,over,gg,top:scores.slice(0,3)};
}

async function getBeSoccerLive(){
  try{
    const today=new Date().toISOString().slice(0,10);
    const res=await fetch('https://www.besoccer.com/calendar/'+today,{headers:{'User-Agent':'Mozilla/5.0'}});
    const html=await res.text();
    let matches=[];
    const regex = /team-name[^>]*>([^<]+)</g;
    let m; let teams=[];
    while((m=regex.exec(html))!==null){ teams.push(m[1].trim()); }
    for(let i=0;i<teams.length-1;i+=2){
      if(teams[i] && teams[i+1] && teams[i].length>2 && teams[i+1].length>2) matches.push([teams[i],teams[i+1]]);
    }
    if(matches.length<4) return [['Atletico','Espanyol'],['Everton','Chelsea'],['Bayern','Dortmund'],['Real Madrid','Osasuna'],['Man City','Arsenal']];
    return matches.slice(0,10);
  }catch(e){
    return [['Atletico','Espanyol'],['Everton','Chelsea'],['Bayern','Dortmund'],['Real Madrid','Osasuna']];
  }
}

async function deploy(){
  const cmd=new SlashCommandBuilder().setName('xx').setDescription('Poisson finale').addStringOption(o=>o.setName('v1').setDescription('Eq1').setRequired(true)).addStringOption(o=>o.setName('v2').setDescription('Eq2').setRequired(true)).toJSON();
  const rest=new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),{body:[cmd]});
  console.log('Deploy OK');
}

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
client.once('ready',async()=>{ console.log('BE SOCCER LIVE READY'); await deploy(); });

client.on('messageCreate',async msg=>{
  if(msg.author.bot) return;
  const low=msg.content.toLowerCase();

  if(low.startsWith('!analyse')){
    let raw=msg.content.slice(8).trim();
    if(!raw){ await msg.reply('Usage:!analyse Everton vs Chelsea'); return; }
    let v1,v2;
    if(raw.toLowerCase().includes('vs')){ const p=raw.split(/vs/i); v1=p[0].trim(); v2=p[1].trim(); }
    else{ const p=raw.split(' '); v1=p[0].trim(); v2=(p[1]||'Adversaire').trim(); }
    const r=analyseMatch(v1,v2);
    await msg.reply('POISSON BE SOCCER - '+v1.toUpperCase()+' vs '+v2.toUpperCase()+'\nLambda '+r.l1.toFixed(4)+' vs '+r.l2.toFixed(4)+'\nScore '+r.top[0].s+' '+(r.top[0].p*100).toFixed(1)+'%\n1X2: Cote '+r.cote.H.toFixed(2)+'/'+r.cote.D.toFixed(2)+'/'+r.cote.A.toFixed(2)+' | Over Cote '+r.cote.OVER.toFixed(2)+' GG '+r.cote.GG.toFixed(2));
  }

  if(low.startsWith('!coupon')){
    let nb=parseInt(msg.content.split(' ')[1])||5;
    if(nb<4) nb=4; if(nb>6) nb=6;
    await msg.reply('Recuperation calendrier BeSoccer du jour...');
    const fixtures=await getBeSoccerLive();
    let sel=[], total=1;
    for(let i=0;i<nb && i<fixtures.length;i++){
      const f=fixtures[i];
      const r=analyseMatch(f[0],f[1]);
      const best=r.cote.OVER;
      sel.push({match:f[0]+' vs '+f[1], choix:'Plus 2.5', cote:best, score:r.top[0].s});
      total*=best;
    }
    let txt='COUPON BE SOCCER LIVE COTE 25 - '+sel.length+' MATCHS\nSource: besoccer.com/calendar\n\n';
    sel.forEach((s,i)=>{ txt+=(i+1)+'. '+s.match+' -> '+s.choix+' Cote '+s.cote.toFixed(2)+' Score '+s.score+'\n'; });
    txt+='\nCOTE TOTALE: '+total.toFixed(2)+' | Formule: e^-L*L^n/n! | Cote=1/Proba';
    await msg.reply(txt);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
