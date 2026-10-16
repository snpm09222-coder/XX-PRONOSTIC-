import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

// Fonction qui bloque à 3 buts MAX
function formuleEmpereur(v_recent, v_h2h) {
  let buts = v_recent - v_h2h + 2;
  if (buts < 0) buts = 0;
  if (buts > 3) buts = 3;
  return buts;
}

async function autoDeploy() {
  try {
    const cmd = new SlashCommandBuilder()
     .setName('xx')
     .setDescription('XX Formule Empereur - max 3 buts')
     .addStringOption(o => o.setName('v1').setDescription('Equipe 1').setRequired(true))
     .addStringOption(o => o.setName('v2').setDescription('Equipe 2').setRequired(true))
     .addIntegerOption(o => o.setName('v1_recent').setDescription('Victoires V1 sur 4 recents 0-4').setRequired(true))
     .addIntegerOption(o => o.setName('v2_recent').setDescription('Victoires V2 sur 4 recents 0-4').setRequired(true))
     .addIntegerOption(o => o.setName('v1_h2h').setDescription('Victoires V1 sur 4 H2H 0-4').setRequired(true))
     .addIntegerOption(o => o.setName('v2_h2h').setDescription('Victoires V2 sur 4 H2H 0-4').setRequired(true))
     .toJSON();
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: [cmd] });
    console.log('✅ Deploy OK');
  } catch (e) { console.log(e.message); }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`✅ LIVE - ${client.user.tag}`);
  await autoDeploy();
});

// COMMANDE!analyse Bayern
client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  const content = msg.content.toLowerCase();
  if (content.startsWith('!analyse')) {
    const team = msg.content.split(' ')[1] || 'Bayern';
    const isTop = ['bayern','real','city','barca','frankfurt','atletico'].some(t => team.toLowerCase().includes(t));
    const vR = isTop? 4 : 2;
    const vH = isTop? 2 : 1;
    const buts = formuleEmpereur(vR, vH);
    await msg.reply(`👑 **ANALYSE ${team.toUpperCase()}**
📊 Forme: ${vR}V/4 | H2H: ${vH}V/4
🔢 Formule: ${vR}-${vH}+2 = **${buts} but**
🎯 Score type: **${buts}:1** | Total: **${buts+1} buts MAX**
✅ Jamais plus de 3 buts`);
  }
});

// COMMANDE /xx
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() || i.commandName!== 'xx') return;
  await i.deferReply();
  const v1 = i.options.getString('v1');
  const v2 = i.options.getString('v2');
  const v1_r = i.options.getInteger('v1_recent');
  const v2_r = i.options.getInteger('v2_recent');
  const v1_h = i.options.getInteger('v1_h2h');
  const v2_h = i.options.getInteger('v2_h2h');

  const b1 = formuleEmpereur(v1_r, v1_h);
  const b2 = formuleEmpereur(v2_r, v2_h);
  const total = b1 + b2;

  await i.editReply(`👑 **${v1} vs ${v2} - FORMULE EMPEREUR**
📊 ${v1}: ${v1_r}V recent - ${v1_h}V H2H +2 = **${b1}**
📊 ${v2}: ${v2_r}V recent - ${v2_h}V H2H +2 = **${b2}**

🎯 **Score Exact: ${b1}:${b2}**
📊 **Total: ${total} buts** (${total <= 2? 'MOINS 2.5' : 'PLUS 2.5'})
✅ **GG/NG:** ${b1>0&&b2>0?'GG OUI':'NG NON'}
🚩 **Corners: ${7+total}** | 🎯 **Tirs: ${3+total}**`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
