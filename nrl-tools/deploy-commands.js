// Deploy slash commands to Discord
// Run once after any command changes: node deploy-commands.js
//
// Set GUILD_ID in .env for instant guild-level deployment (dev).
// Remove GUILD_ID for global deployment (takes up to 1 hour to propagate).

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const token    = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId  = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('ERROR: DISCORD_TOKEN and CLIENT_ID must be set in .env');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command) {
    commands.push(command.data.toJSON());
    console.log(`Loaded: /${command.data.name}`);
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`\nDeploying ${commands.length} slash commands...`);

    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);

    const data = await rest.put(route, { body: commands });
    console.log(`\n✅ Successfully deployed ${data.length} commands`);
    console.log(`Scope: ${guildId ? `Guild ${guildId}` : 'Global (up to 1hr propagation)'}`);
    console.log(`Commands: ${commands.map(c => `/${c.name}`).join(', ')}`);
  } catch (err) {
    console.error('Deployment failed:', err);
  }
})();
