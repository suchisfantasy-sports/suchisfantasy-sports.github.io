// Such Is Fantasy — NRL Fantasy Tools Bot
// Slash command Discord bot with 7 calculators:
//   /breakeven  /pricechange  /trade  /byeplanner  /optimize  /matchup  /squad
//
// Separate from the RSS injury alert bot (rss-bot/bot.js).
// Node.js 18+ required.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ── Client setup ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ── Load commands ─────────────────────────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`[Commands] Loaded: /${command.data.name}`);
  } else {
    console.warn(`[Commands] Skipped ${file} — missing data or execute`);
  }
}

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, c => {
  console.log(`\n✅ Such Is Fantasy Tools Bot ready as ${c.user.tag}`);
  console.log(`📋 Commands loaded: ${[...client.commands.keys()].map(k => `/${k}`).join(', ')}\n`);
  c.user.setActivity('NRL Fantasy Tools | /breakeven /trade /optimize', { type: 0 });
});

// ── Interaction handler ───────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`[Commands] Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Commands] Error in /${interaction.commandName}:`, err);
    const msg = { content: '❌ Something went wrong running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('ERROR: DISCORD_TOKEN not set. Copy .env.example → .env and add your token.');
  process.exit(1);
}

client.login(token);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT',  () => { client.destroy(); console.log('\nBot stopped.'); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); console.log('\nBot stopped.'); process.exit(0); });
