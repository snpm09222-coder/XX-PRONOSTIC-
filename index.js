import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

async function autoDeploy() {
  try {
    const command = new SlashCommandBuilder()
     .setName('xx')
     .setDescription('XX PRONOSTIC PRO - Formule Empereur')
     .addStringOption(o => o.setName('v1').setDescription('Equipe domicile').setRequired(true))
     .addStringOption(o => o.setName('v2').setDescription('Equipe exterieur').setRequired(true))
     .addIntegerOption(o => o.setName('v1_recent').setDescription('Victoires V1 sur 4 derniers recents (0-4)').setRequired(true))
     .addIntegerOption(o => o.setName('v2_recent').setDescription('Victoires V2 sur 4 derniers recents (0-4)').setRequired(true))
     .addIntegerOption(o => o.setName('v1_h2h').setDescription('Victoires V1 sur 4 H2H (0-4)').setRequired(true))
     .addIntegerOption(o => o.setName('v2_h2h').setDescription('Victoires V2 sur 4 H2H (0-4)').setRequired(true))
     .toJSON();

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: [command] });
    console.log('✅ Formule Empereur +2 deployée');
  } catch (e) {
    console.log('Deploy erreur:', e.message);
  }
}

// FORMULE FINALE VALIDÉE: Recent - H2H + 2 (max 3 buts)
function formuleEmpereur(v_recent, v_h2h) {
  let buts = v_recent - v_h2h + 2;
  buts = Math.max(0, Math.min(3, buts)); // Jamais plus de 3, jamais 7
  return buts;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ XX PRONOSTIC PRO LIVE - ${client.user.tag}`);
  await autoDeploy();
});

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

  const message = `👑 **XX EMPEREUR - FORMULE +2** 👑
**${v1} vs ${v2}**

📊 **STATS:**
${v1}: Recent ${v1_r}V/4 | H2H ${v1_h}V/4
${v2}: Recent ${v2_r}V/4 | H2H ${v2_h}V/4

🔢 **FORMULE: Recent - H2H + 2**
${v1}: ${v1_r} - ${v1_h} + 2 = **${buts_V1} but**
${v2}: ${v2_r} - ${v2_h} + 2 = **${buts_V2} but**

🎯 **Score Exact:** ${buts_V1} : ${buts_V2}
📊 **Total:** ${total} buts (${total <= 2? 'MOINS de 2.5' : 'PLUS de 2.5'})
✅ **GG/NG:** ${buts_V1 > 0 && buts_V2 > 0? 'GG OUI' : 'NG NON'}
🚩 **Corners:** ${7 + total}
🎯 **Tirs Cadrés:** ${3 + total}`;

  await interaction.editReply(message);
});

client.login(process.env.DISCORD_BOT_TOKEN);
