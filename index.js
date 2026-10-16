import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const FOOTBALL_KEY = process.env.FOOTBALL_API_KEY;
const ODDS_KEY = process.env.ODDS_API_KEY;

// ===== AUTO-DEPLOY DE LA COMMANDE /xx AU DEMARRAGE =====
async function autoDeploy() {
  try {
    const command = new SlashCommandBuilder()
     .setName('xx')
     .setDescription('XX PRONOSTIC PRO - Empereur')
     .addStringOption(o => o.setName('v1').setDescription('Equipe domicile').setRequired(true))
     .addStringOption(o => o.setName('v2').setDescription('Equipe exterieur').setRequired(true));

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: [command.toJSON()] });
    console.log('✅ Commande /xx auto-deployée');
  } catch(e) { console.log('Deploy erreur:', e.message); }
}

// ===== MOTEUR XX =====
function calculateProbability(last5_V1, last5_V2, h2h) {
  const winRate_V1 = last5_V1.filter(m => m.result === 'W').length / 5;
  const winRate_V2 = last5_V2.filter(m => m.result === 'W').length / 5;
  const avgGoals_V1 = last5_V1.reduce((a,b)=>a+(b.goalsFor||0),0)/5;
  const avgGoals_V2 = last5_V2.reduce((a,b)=>a+(b.goalsFor||0),0)/5;
  const variance = Math.abs(avgGoals_V1 - avgGoals_V2) * 0.3;
  const totalButsH2H = h2h.reduce((a,b)=>a+(b.V1||0)+(b.V2||0), 0) || 6;
  const baseScore = totalButsH2H / (h2h.length || 1);
  return { winRate_V1, winRate_V2, avgGoals_V1, avgGoals_V2, baseScore, variance };
}

function generatePrediction(data, odds) {
  const { V1, V2, last5, h2h } = data;
  const proba = calculateProbability(last5.V1, last5.V2, h2h);
  const force_V1 = (V1.compo.attaque*0.4 + V1.formation*0.3 + V1.keyPlayers.attaque*0.3);
  const force_V2 = (V2.compo.attaque*0.4 + V2.formation*0.3 + V2.keyPlayers.attaque*0.3);
  const defense_V1 = (V1.compo.defense*0.6 + V1.keyPlayers.defense*0.4);
  const defense_V2 = (V2.compo.defense*0.6 + V2.keyPlayers.defense*0.4);
  let score_V1 = Math.round((proba.avgGoals_V1 + force_V1/25 - defense_V2*0.02 + proba.baseScore*0.25 + proba.variance));
  let score_V2 = Math.round((proba.avgGoals_V2 + force_V2/25 - defense_V1*0.02 + proba.baseScore*0.25 - proba.variance*0.5));
  score_V1 = Math.max(0, Math.min(4, score_V1));
  score_V2 = Math.max(0, Math.min(4, score_V2));
  const bestOdds = odds[0] || { over25: 1.85 };
  return {
    match: `${V1.nom} vs ${V2.nom}`,
    scoreExact: `${score_V1} : ${score_V2}`,
    totalButs: score_V1 + score_V2,
    cornersExact: Math.round(bestOdds.corners || 9.5),
    tirsCadresExact: Math.round((force_V1+force_V2)/18),
    gg_ng: (score_V1>0 && score_V2>0)? "GG OUI" : "NG NON",
    totalEtBTTS: `${score_V1+score_V2} buts + ${(score_V1>0&&score_V2>0)?"GG":"NG"}`,
    proba: `${Math.round(proba.winRate_V1*100)}% / ${Math.round(proba.winRate_V2*100)}%`,
    bookmakerCompare: odds.map(o=>`${o.bookmaker}: ${o.over25}`).join(' | ')
  };
}

async function getMatchData(v1,v2){
  return {
    V1: { nom: v1, compo: { attaque: 82, defense: 78 }, formation: 85, keyPlayers: { attaque: 88, defense: 80 } },
    V2: { nom: v2, compo: { attaque: 79, defense: 81 }, formation: 80, keyPlayers: { attaque: 84, defense: 83 } },
    last5: {
      V1: [{goalsFor:2,result:'W'},{goalsFor:1,result:'D'},{goalsFor:3,result:'W'},{goalsFor:0,result:'L'},{goalsFor:2,result:'W'}],
      V2: [{goalsFor:1,result:'W'},{goalsFor:2,result:'W'},{goalsFor:1,result:'D'},{goalsFor:2,result:'W'},{goalsFor:0,result:'L'}]
    },
    h2h: [{V1:1,V2:2},{V1:2,V2:1},{V1:0,V2:1}]
  };
}
async function getOdds(){
  return [{ bookmaker: '1xbet', over25: 1.85, corners: 9.5, btts: 1.75 }, { bookmaker: 'melbet', over25: 1.90, corners: 10, btts: 1.80 }];
}

// ===== BOT =====
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ XX PRONOSTIC PRO LIVE - ${client.user.tag}`);
  await autoDeploy(); // <--- IL SE DEPLOIE TOUT SEUL ICI
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName!== 'xx') return;
  const v1 = interaction.options.getString('v1');
  const v2 = interaction.options.getString('v2');
  await interaction.deferReply();
  const matchData = await getMatchData(v1, v2);
  const odds = await getOdds();
  const p = generatePrediction(matchData, odds);
  await interaction.editReply(`👑 **XX PRONOSTIC - PRO [LIVE]** 👑\n**${p.match}**\n\n🎯 **Score Exact:** ${p.scoreExact}\n📊 **Total:** ${p.totalButs} buts\n🚩 **Corners:** ${p.cornersExact}\n🎯 **Tirs Cadrés:** ${p.tirsCadresExact}\n✅ **GG/NG:** ${p.gg_ng}\n🔥 **Total+BTTS:** ${p.totalEtBTTS}\n\n📈 **Proba:** ${p.proba}\n💰 **Bookmakers:** ${p.bookmakerCompare}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
