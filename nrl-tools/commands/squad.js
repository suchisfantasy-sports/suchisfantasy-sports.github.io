const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { buildSquad } = require('../calculators/squadBuilder');
const sampleData = require('../data/sample-players.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('squad')
    .setDescription('Build an optimal NRL Fantasy or SuperCoach squad within salary cap')
    .addStringOption(o => o
      .setName('game')
      .setDescription('Which game?')
      .setRequired(true)
      .addChoices(
        { name: 'NRL Fantasy ($6M cap)', value: 'nrl' },
        { name: 'SuperCoach ($6.5M cap)', value: 'supercoach' },
      ))
    .addStringOption(o => o
      .setName('must_include')
      .setDescription('Players to force into the squad (comma-separated names)')
      .setRequired(false))
    .addStringOption(o => o
      .setName('exclude')
      .setDescription('Players to exclude (comma-separated names)')
      .setRequired(false))
    .addIntegerOption(o => o
      .setName('max_per_team')
      .setDescription('Max players from one team (default: 5)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(17))
    .addStringOption(o => o
      .setName('players')
      .setDescription('Player list: "Name:Pos:Price:AvgPts|..." (uses sample data if omitted)')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const game          = interaction.options.getString('game');
    const mustInclude   = (interaction.options.getString('must_include') ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const exclude       = (interaction.options.getString('exclude') ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const maxPerTeam    = interaction.options.getInteger('max_per_team') ?? 5;
    const playersRaw    = interaction.options.getString('players');

    let players;
    if (playersRaw) {
      players = playersRaw.split('|').map(raw => {
        const [name, position, price, avg] = raw.trim().split(':');
        return {
          name: name?.trim(),
          position: position?.trim()?.toUpperCase(),
          price: parseInt(price, 10),
          projectedAvg: parseFloat(avg),
          team: 'Unknown',
        };
      }).filter(p => p.name && p.position && !isNaN(p.price) && !isNaN(p.projectedAvg));
    } else {
      players = sampleData.players;
    }

    let result;
    try {
      result = buildSquad(players, { game, mustInclude, exclude, maxPerTeam });
    } catch (err) {
      return interaction.editReply(`❌ ${err.message}`);
    }

    const cap = game === 'supercoach' ? 6500000 : 6000000;
    const capUsed = result.totalPrice;
    const capPct  = Math.round((capUsed / cap) * 100);

    // Group by position for display
    const positions = [...new Set(result.squad.map(p => p.position))];
    const embed = new EmbedBuilder()
      .setColor(0x00F0FF)
      .setTitle(`🏉 ${game === 'supercoach' ? 'SuperCoach' : 'NRL Fantasy'} — Optimal Squad`)
      .setDescription(result.complete ? '✅ Full squad built' : `⚠️ Incomplete squad (${result.squad.length} players)`);

    for (const pos of positions) {
      const posPlayers = result.squad.filter(p => p.position === pos);
      embed.addFields({
        name: `${pos} (${posPlayers.length})`,
        value: posPlayers.map(p =>
          `**${p.name}** · $${p.price.toLocaleString()} · avg ${p.projectedAvg} · ${p.team}`
        ).join('\n'),
      });
    }

    embed.addFields(
      { name: '💰 Salary Used', value: `$${capUsed.toLocaleString()} / $${cap.toLocaleString()} (${capPct}%)`, inline: true },
      { name: '🏦 Bank',        value: `$${result.remaining.toLocaleString()}`, inline: true },
      { name: '📊 Squad Avg',   value: `${result.avgProjected} pts`, inline: true },
    );

    // Position coverage breakdown
    const shortPositions = Object.entries(result.breakdown)
      .filter(([, d]) => d.short > 0)
      .map(([pos, d]) => `${pos}: short ${d.short}`);
    if (shortPositions.length > 0) {
      embed.addFields({ name: '⚠️ Positions Short', value: shortPositions.join(', ') });
    }

    if (!playersRaw) {
      embed.addFields({ name: '⚠️ Note', value: 'Using sample player data. Provide real data for accurate squads.' });
    }

    embed.setFooter({ text: 'Such Is Fantasy Tools · /squad' });
    return interaction.editReply({ embeds: [embed] });
  },
};
