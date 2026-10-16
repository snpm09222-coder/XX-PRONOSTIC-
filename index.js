import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

function poisson(k, lam){
  let f=1;
  for(let i=2;i<=k;i++) f*=i;
  return Math.exp(-lam) * Math.pow(lam,k) / f;
}

function getTeamData(nom){
  const n = (nom||'').toLowerCase();
  const db = {
    'atletico': { recent: 2.0, h2h: 1.333 },
    'espanyol': { recent: 1.733, h2h: 1.266 },
    'bayern': { recent: 2.4, h2h: 1.9 },
    'real': { recent: 2.2, h2h: 1.8 },
    'city': { recent: 2.3, h2h: 1.85 },
    'chelsea': { recent: 1.9, h2h: 1.6 },
    'barca': { recent: 2.1, h2h: 1.7 },
    'arsenal': { recent: 2.0, h2h: 1.6 },
    'liverpool': { recent: 2.1, h2h: 1.65 },
    'everton': { recent: 1.15, h2h: 0.95 },
    'dortmund': { recent: 1.8, h2h: 1.4 },
    'osasuna': { recent: 1.2, h2h: 1.0 },
    'inter': { recent: 1.9, h2h: 1.5 },
    'milan': { recent: 1.8, h2h: 1.4 }
  };
  for(let k in db){ if(n.includes(k)) return db[k]; }
  return { recent: 1.35, h2h: 1.15 };
}

function analyseMatch(v1, v2){
  const d1 = getTeamData(v1);
  const d2 = getTeamData(v2);
  const l1 = d1.recent*0.6 + d1.h2h*0.4;
  const l2 = d2.recent*0.6 + d2.h2h*0.4;
  let p1x2 = { H:0, D:0, A:0 };
  let over = 0, gg = 0;
  let scores = [];
  for(let i=0;i<=5;i++){
    for(let j=0;j<=5;j++){
      let p = poisson(i,l1) * poisson(j,l2);
      scores.push({ s: i+':'+j, p: p });
      if(i>j) p1x2.H += p;
      else if(i===j) p1x2.D += p;
      else p1x2.A += p;
      if(i+j > 2.5) over += p;
      if(i>0 && j>0) gg += p;
    }
  }
  const sum = p1x2.H + p1x2.D + p1x2.A;
  const pPrime = { H: p1x2.H/sum, D: p1x2.D/sum, A: p1x2.A/sum };
  const cote = { H: 1/pPrime.H, D: 1/pPrime.D, A: 1/pPrime.A, OVER: 1/over, GG: 1/gg };
  scores.sort((a,b)=> b.p - a.p);
  return { v1, v2, l1, l2, pPrime, cote, over, gg, top: scores.slice(0,3) };
}

async function deploy(){
  const cmd = new SlashCommandBuilder().setName('xx').setDescription('Formule Poisson finale').addStringOption(o=> o.setName('v1').setDescription('Equipe1').setRequired(true)).addStringOption(o=> o.setName('v2').setDescription('Equipe2').setRequired(true)).toJSON();
  const rest = new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {body:[cmd]});
  console.log('Deploy OK');
}

const FIXTURES = [
  ['Atletico','Espanyol'], ['Everton','Chelsea'], ['Bayern','Dortmund'],
  ['Real Madrid','Osasuna'], ['Man City','Arsenal'], ['Inter','Milan'],
  ['Liverpool','Tottenham'], ['Barca','Villarreal']
];

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once('ready', async()=>{
  console.log('FINAL POISSON + COUPON LIVE');
  await deploy();
});

client.on('messageCreate', async msg=>{
  if(msg.author.bot) return;
  const low = msg.content.toLowerCase();

  if(low.startsWith('!analyse')){
    let raw = msg.content.slice(8).trim();
    if(!raw){ await msg.reply('Usage:!analyse Everton vs Chelsea'); return; }
    let v1, v2;
    if(raw.toLowerCase().includes('vs')){
      const p = raw.split(/vs/i); v1 = p[0].trim(); v2 = p[1].trim();
    } else {
      const p = raw.split(' '); v1 = p[0].trim(); v2 = (p[1]||'Adversaire').trim();
    }
    const r = analyseMatch(v1, v2);
    const txt = 'POISSON FINAL - ' + v1.toUpperCase() + ' vs ' + v2.toUpperCase() + '\n'
      + 'Lambda: ' + v1 + '=' + r.l1.toFixed(4) + ' | ' + v2 + '=' + r.l2.toFixed(4) + '\n'
      + 'Formule: P(X=n)=e^-L * L^n / n!\n\n'
      + 'Top Scores: 1.' + r.top[0].s + ' ' + (r.top[0].p*100).toFixed(2) + '% | 2.' + r.top[1].s + ' ' + (r.top[1].p*100).toFixed(2) + '% | 3.' + r.top[2].s + ' ' + (r.top[2].p*100).toFixed(2) + '%\n\n'
      + '1X2 Normalise p_prime=p/somme: ' + v1 + ' ' + (r.pPrime.H*100).toFixed(1) + '% Cote ' + r.cote.H.toFixed(2) + ' | Nul ' + (r.pPrime.D*100).toFixed(1) + '% Cote ' + r.cote.D.toFixed(2) + ' | ' + v2 + ' ' + (r.pPrime.A*100).toFixed(1) + '% Cote ' + r.cote.A.toFixed(2) + '\n'
      + 'Plus2.5: ' + (r.over*100).toFixed(1) + '% Cote ' + r.cote.OVER.toFixed(2) + ' | GG: ' + (r.gg*100).toFixed(1) + '% Cote ' + r.cote.GG.toFixed(2);
    await msg.reply(txt);
  }

  if(low.startsWith('!coupon')){
    let nb = parseInt(msg.content.split(' ')[1]) || 5;
    if(nb<4) nb=4; if(nb>6) nb=6;
    let selections = [];
    let total = 1;
    let used = new Set();
    while(selections.length < nb){
      const f = FIXTURES[Math.floor(Math.random()*FIXTURES.length)];
      const key = f[0]+'-'+f[1];
      if(used.has(key)) continue;
      used.add(key);
      const r = analyseMatch(f[0], f[1]);
      const opts = [
        { choix: f[0]+' gagne', cote: r.cote.H },
        { choix: f[1]+' gagne', cote: r.cote.A },
        { choix: 'Plus 2.5', cote: r.cote.OVER },
        { choix: 'GG OUI', cote: r.cote.GG }
      ];
      const good = opts.filter(o=> o.cote>=1.55 && o.cote<=2.6).sort((a,b)=> b.cote-a.cote)[0] || opts[0];
      selections.push({ match: f[0]+' vs '+f[1], choix: good.choix, cote: good.cote, score: r.top[0].s });
      total *= good.cote;
    }
    let txt = 'COUPON COMBINE COTE 25 - ' + selections.length + ' MATCHS\nCible 25 | Formule: Cote=1/Proba, Combine=Produit\n\n';
    selections.forEach((s,i)=>{
      txt += (i+1)+'. '+s.match+' -> '+s.choix+' | Cote '+s.cote.toFixed(2)+' | Score '+s.score+'\n';
    });
    txt += '\nCOTE TOTALE: '+total.toFixed(2)+' = '+selections.map(s=>s.cote.toFixed(2)).join(' x ')+'\n';
    txt += 'Proba combine: '+(1/total*100).toFixed(2)+'%\n';
    txt += (total>=20 && total<=32)? 'COMBO VALIDE COTE 25' : 'Ajuste avec!coupon '+(nb+1);
    await msg.reply(txt);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
