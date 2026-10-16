import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

function formule10(moyRecent, moyH2H) {
  let buts = (moyRecent + moyH2H) / 2;
  buts = Math.round(buts);
  return Math.max(0, Math.min(3, buts));
}

// Force des équipes pour simulation réaliste (tu pourras brancher une API après)
function getForceEquipe(nom) {
  const n = nom.toLowerCase();
  if (['city','arsenal','liverpool','bayern','real','barca','atletico','chelsea'].some(t=>n.includes(t)))
    return { recent: 2.1, h2h: 1.8, victoires: 7 };
  if (['newcastle','tottenham','frankfurt','dortmund','leverkusen','inter','milan'].some(t=>n.includes(t)))
    return { recent: 1.8, h2h: 1.5, victoires: 5 };
  if (['everton','wolves','brentford','fulham','mainz','osasuna','espanyol'].some(t=>n.includes(t)))
    return { recent: 1.2, h2h: 1.0, victoires: 2 };
  return { recent: 1.5, h2h: 1.3, victoires: 3 };
}

async function autoDeploy() {
  const cmd = new SlashCommandBuilder()
  .setName('xx').setDescription('Formule V4 10 matchs')
  .addStringOption(o=>o.setName('v1').setDescription('Equipe 1').setRequired(true))
  .addStringOption(o=>o.setName('v2').setDescription('Equipe 2').setRequired(true))
  .addNumberOption(o=>o.setName('moy_v1_10').setDescription('Moy V1 10 recents').setRequired(true))
  .addNumberOption(o=>o.setName('moy_v2_10').setDescription('Moy V2 10 recents').setRequired(true))
  .addNumberOption(o=>o.setName('moy_v1_h2h10').setDescription('Moy V1 10 H2H').setRequired(true))
  .addNumberOption(o=>o.setName('moy_v2_h2h10').setDescription('Moy V2 10 H2H').setRequired(true))
  .toJSON();
  const rest = new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {body:[cmd]});
  console.log('Deploy V4 OK');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once('ready', async () => { console.log('LIVE V4 -!analyse READY'); await autoDeploy(); });

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  const content = msg.content.toLowerCase();
  if (content.startsWith('!analyse')) {
    let raw = msg.content.slice(8).trim(); // enlève!analyse
    if (!raw) return msg.reply('Tape: `!analyse Everton vs Chelsea`');

    // Parse "Everton vs Chelsea" ou "Everton Chelsea"
    let v1, v2;
    if (raw.includes('vs')) {
      const parts = raw.split(/vs/i);
      v1 = parts[0].trim(); v2 = parts[1].trim();
    } else {
      const parts = raw.split(' ');
      v1 = parts[0]; v2 = parts[1] || 'Adversaire';
    }

    const f1 = getForceEquipe(v1);
    const f2 = getForceEquipe(v2);

    const b1 = formule10(f1.recent, f1.h2h);
    const b2 = formule10(f2.recent, f2.h2h);
    const total = b1 + b2;

    const analyse = `👑 **ANALYSE V4 - 10 MATCHS - ${v1.toUpperCase()} vs ${v2.toUpperCase()}** 👑

📊 **DONNÉES 10 DERNIERS MATCHS:**
**${v1}:** Moy ${f1.recent} buts/match (Forme ${f1.victoires}V/10) | H2H ${f1.h2h}
**${v2}:** Moy ${f2.recent} buts/match (Forme ${f2.victoires}V/10) | H2H ${f2.h2h}

🔢 **FORMULE: (Moy Recent + Moy H2H) / 2**
${v1}: (${f1.recent} + ${f1.h2h}) / 2 = **${b1} but**
${v2}: (${f2.recent} + ${f2.h2h}) / 2 = **${b2} but**

🎯 **Score Exact:** **${b1} : ${b2}**
📊 **Total:** ${total} buts (${total<=2?'MOINS 2.5':'PLUS 2.5'})
✅ **GG/NG:** ${b1>0&&b2>0?'GG OUI':'NG NON'}
🚩 **Corners:** ${7+total} | 🎯 **Tirs Cadrés:** ${3+total}

*Max 3 buts - Anti 4:3 / 7 buts*`;

    await msg.reply(analyse);
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() || i.commandName!=='xx') return;
  await i.deferReply();
  const v1=i.options.getString('v1'), v2=i.options.getString('v2');
  const mr1=i.options.getNumber('moy_v1_10'), mr2=i.options.getNumber('moy_v2_10');
  const mh1=i.options.getNumber('moy_v1_h2h10'), mh2=i.options.getNumber('moy_v2_h2h10');
  const b1=formule10(mr1,mh1), b2=formule10(mr2,mh2);
  const total=b1+b2;
  await i.editReply(`👑 **V4 10 MATCHS** **${v1} vs ${v2}** => **${b1}:${b2}** | Total ${total} | ${b1>0&&b2>0?'GG':'NG'}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
