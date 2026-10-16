import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

function poisson(k, lam){ let f=1; for(let i=2;i<=k;i++) f*=i; return Math.exp(-lam)*Math.pow(lam,k)/f; }

function getTeamData(nom){
  const n = nom.toLowerCase();
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
    'milan': { recent: 1.8, h2h: 1.4 },
    'frankfurt': { recent: 1.6, h2h: 1.3 },
  };
  for(let k in db) if(n.includes(k)) return db[k];
  return { recent: 1.35, h2h: 1.15 };
}

function analyseMatch(v1, v2){
  const d1=getTeamData(v1), d2=getTeamData(v2);
  const l1=d1.recent*0.6+d1.h2h*0.4, l2=d2.recent*0.6+d2.h2h*0.4;
  let p1x2={H:0,D:0,A:0}, over=0, gg=0, scores=[];
  for(let i=0;i<=5;i++) for(let j=0;j<=5;j++){
    let p=poisson(i,l1)*poisson(j,l2);
    scores.push({s:`${i}:${j}`,p});
    if(i>j) p1x2.H+=p; else if(i==j) p1x2.D+=p; else p1x2.A+=p;
    if(i+j>2.5) over+=p; if(i>0&&j>0) gg+=p;
  }
  const sum=p1x2.H+p1x2.D+p1x2.A;
  const pPrime={H:p1x2.H/sum, D:p1x2.D/sum, A:p1x2.A/sum};
  const cote={ H:1/pPrime.H, D:1/pPrime.D, A:1/pPrime.A, OVER:1/over, GG:1/gg };
  scores.sort((a,b)=>b.p-a.p);
  return { v1,v2,l1,l2,pPrime,cote,over,gg, top:scores[0], all:scores };
}

async function deploy(){
  const cmd = new SlashCommandBuilder().setName('xx').setDescription('Poisson finale').addStringOption(o=>o.setName('v1').setDescription('Eq1').setRequired(true)).addStringOption(o=>o.setName('v2').setDescription('Eq2').setRequired(true)).toJSON();
  const rest = new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {body:[cmd]});
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once('ready', async()=>{ console.log('FINAL POISSON + COUPON LIVE'); await deploy(); });

// LISTE DE MATCHS POUR COUPON COTE 25
const FIXTURES = [
  ["Atletico","Espanyol"], ["Everton","Chelsea"], ["Bayern","Dortmund"],
  ["Real Madrid","Osasuna"], ["Man City","Arsenal"], ["Inter","Milan"],
  ["Liverpool","Tottenham"], ["Barca","Villarreal"], ["Leverkusen","Frankfurt"],
  ["Sevilla","Betis"]
];

client.on('messageCreate', async msg=>{
  if(msg.author.bot) return;
  const low = msg.content.toLowerCase();

  // COMMANDE!analyse
  if(low.startsWith('!analyse')){
    let raw = msg.content.slice(8).trim();
    let v1, v2;
    if(raw.toLowerCase().includes('vs')){ const p=raw.split(/vs/i); v1=p[0].trim(); v2=p[1].trim(); }
    else{ const p=raw.split(' '); v1=p[0].trim(); v2=p[1]?.trim()||'Adversaire'; }
    const r = analyseMatch(v1,v2);
    await msg.reply(`👑 **POISSON FINAL - ${v1.toUpperCase()} vs ${v2.toUpperCase()}** 👑
λ ${v1}=${r.l1.toFixed(4)} | λ ${v2}=${r.l2.toFixed(4)}
Top Score: **${r.top.s} ${(r.top.p*100).toFixed(1)}%**
1X2: ${v1} ${(r.pPrime.H*100).toFixed(1)}% Cote ${r.cote.H.toFixed(2)} | N ${ (r.pPrime.D*100).toFixed(1)}% Cote ${r.cote.D.toFixed(2)} | ${v2} ${(r.pPrime.A*100).toFixed(1)}% Cote ${r.cote.A.toFixed(2)}
Over 2.5: ${(r.over*100).toFixed(1)}% Cote ${r.cote.OVER.toFixed(2)} | GG: ${(r.gg*100).toFixed(1)}% Cote ${r.cote.GG.toFixed(2)}`);
  }

  // COMMANDE!coupon - COTE 25
  if(low.startsWith('!coupon')){
    let nb = parseInt(msg.content.split(' ')[1])||5; //!coupon 4 ou 5
    if(nb<4) nb=4; if(nb>7) nb=7;

    let selections=[], totalCote=1, tries=0;
    // On pioche des paris qui font ~1.8-2.2 chacun pour atteindre 25
    // Formule: cote finale = 1/proba | combiné = produit des cotes
    while(selections.length < nb && tries < 50){
      tries++;
      const fixture = FIXTURES[Math.floor(Math.random()*FIXTURES.length)];
      const r = analyseMatch(fixture[0], fixture[1]);
      // Choisir le marché le plus safe avec cote 1.6-2.4 pour monter à 25
      const options = [
        { choix: `${fixture[0]} gagne`, cote: r.cote.H, proba: r.pPrime.H },
        { choix: `${fixture[1]} gagne`, cote: r.cote.A, proba: r.pPrime.A },
        { choix: `Plus 2.5 buts`, cote: r.cote.OVER, proba: r.over },
        { choix: `GG OUI`, cote: r.cote.GG, proba: r.gg },
      ];
      // Filtre cote 1.6 à 2.5 idéal pour combiné 25
      const good = options.filter(o=>o.cote>=1.55 && o.cote<=2.6).sort((a,b)=>b.proba-a.proba)[0];
      if(!good) continue;
      if(selections.find(s=>s.match===`${fixture[0]} vs ${fixture[1]}`)) continue;
      selections.push({ match: `${fixture[0]} vs ${fixture[1]}`,...good, score: r.top.s });
      totalCote *= good.cote;
    }

    // Si cote trop basse (<18) ou trop haute (>35), on ajuste en ajoutant/retirant
    let text = `🎟️ **COUPON COMBINÉ COTE 25 - ${selections.length} MATCHS** 🎟️\nFormule: Cote Totale = Produit des cotes | Cible 25\n\n`;
    selections.forEach((s,i)=>{
      text+=`${i+1}. **${s.match}**\n → ${s.choix} | Cote ${s.cote.toFixed(2)} | Score Poisson ${s.score}\n`;
    });
    text+=`\n💰 **COTE TOTALE: ${totalCote.toFixed(2)}**\nFormule: ${selections.map(s=>s.cote.toFixed(2)).join(' x ')} = ${totalCote.toFixed(2)}\n`;
    text+= totalCote>=22 && totalCote<=32? `✅ **COMBO VALIDÉ COTE 25 (22-32)**` : `⚠️ Cote ${totalCote.toFixed(2)} - Tape!coupon ${nb+1} pour ajuster`;
    text+=`\n\n📊 Proba combinée = 1/Cote = ${(1/totalCote*100).toFixed(2)}%`;

    await msg.reply(text);
  }
});

client.login(process.env.D
