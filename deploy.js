import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const command = new SlashCommandBuilder()
  .setName('xx')
  .setDescription('XX PRONOSTIC PRO - Empereur')
  .addStringOption(o => o.setName('v1').setDescription('Equipe domicile').setRequired(true))
  .addStringOption(o => o.setName('v2').setDescription('Equipe exterieur').setRequired(true));

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

console.log('Deploiement de /xx...');
await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: [command.toJSON()] });
console.log('✅ /xx deployée sur Discord');
