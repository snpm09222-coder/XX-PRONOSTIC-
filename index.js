import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

async function autoDeploy() {
  try {
    const command = new SlashCommandBuilder()
    .setName('xx')
    .setDescription('XX PRONOSTIC PRO - Formule Empereur')
    .addStringOption(o => o.setName('v1').setDescription('Equipe domicile').setRequired(true))
    .addStringOption(o => o.setName('v2').setDescription('Equipe exterieur').setRequired(true))
    .addIntegerOption(o => o.setName('v1_recent').setDescription('Victoires V1 sur 4 recents (0-4)').setRequired(true))
    .addIntegerOption(o => o.setName('v2_recent').setDescription('Victoires V2 sur 4 recents (0-4)').setRequired(true))
    .addIntegerOption(o => o.setName('v1_h2h').setDescription('Victoires V1 sur 4 H2H (0-4)').setRequired(true))
    .addIntegerOption(o => o.setName('v2_h2h').setDescription('Victoires V2 sur 4 H2H (0-4)').setRequired(true))
    .toJSON();
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: [command] });
    console.log('✅ /xx deployé');
  } catch (e) { console.log(e.message); }
}

function formuleEmpereur(v_recent, v_h2h) {
  let buts = v_recent - v_h2h + 2; // TA FORMULE FINALE
  return Math.max(0, Math.min(3, buts));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`✅ XX PRONOSTIC PRO LIVE - ${client.user.tag}`);
  await autoDeploy();
});

// COMMANDE!analyse Bayern
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase().startsWith('!analyse')) {
    const args = message.content.split(' ');
    const team = args[1] || 'Bayern';

    // Analyse auto de l'équipe
    const recentForm = 3 + Math.floor(Math.random()*2); // Simule 3-4 victoires pour Bayern (équipe forte)
    const h2hForm = 2 + Math.floor(Math.random()*2); // 2-3 victoires H2H

    // Si c'est Bayern, on le met fort
    const isTopTeam = ['bayern','real','city','barca','atletico'].some(t => team.toLowerCase().includes(t));
    const v_recent = isTopTeam? 4 : recentForm;
    const v_h2h = isTopTeam? 3 : h2hForm;

    const buts = formuleEmpereur(v_recent, v_h2h);
    const total = buts + 1;

    const analyse = `👑 **ANALYSE RAPIDE: ${team.toUpperCase()}** 👑

📊 **FORME RÉCENTE (4 derniers):** ${v_recent}V / 4
⚔️ **CONFRONTATIONS (4 dernières):** ${v_h2h}V / 4

🔢 **FORMULE EMPEREUR: Recent - H2H + 2**
${v_recent} - ${v_h2h} + 2 = **${buts} but estimé**

🎯 **PRONOSTIC POUR ${team}:**
• Score probable: **${buts}:1** ou **${buts}:0**
• Total: **${total} buts**
• Tendance: **${v_recent >=3? '🔥 EN FEU - Grosse forme' : '⚠️ Forme moyenne'}**
• Conseil: **${isTopTeam? 'Victoire + PLUS 1.5 buts' : 'Double chance'}**

💡 Pour match complet:
\`/xx v1:${team} v2:Adversaire v1_recent:${v_recent} v2_recent:2 v1_h2h:${v_h2h} v2_h2h:1\``;

    await message.reply(analyse);
  }
});

// Garde /xx pour match complet
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName!== 'xx') return;
  await interaction.deferReply();
  const v1 = interaction.options.getString('v1');
  const v2 = interaction.options.getString('v2');
  const v1_r = interaction.options.getInteger('v1_recent');
  const v2_r = interaction.options.getInteger('v2_recent');
  const v1_h = interaction.options.getInteger('v1_h2h');
  const v2_h = interaction.options.getInteger('v2_h2h');
  const buts_V1 = formuleEmpereur(v1_r, v1_h);
  const buts_V2 = formuleEmpereur(v2_r, v2_h);
  const total = buts_V1 + buts_V2;
  await interaction.editReply(`👑 **XX EMPEREUR** 👑 **${v1} vs ${v2}**
🔢 ${v1}: ${v1_r}-${v1_h}+2=${buts_V1} | ${v2}: ${v2_r}-${v2_h}+2=${buts_V2}
🎯 **Score: ${buts_V1}:${buts_V2}** | Total ${total} | ${(buts_V1>0&&buts_V2>0)?'GG':'NG'} | Corners ${7+total}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
