const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { optimizeLineup, SALARY_CAP } = require('../calculators/optimizer');
const sampleData = require('../data/sample-players.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('optimize')
    .setDescription('Generate an optimal Draftstars NRL lineup')
    .addStringOption(o => o
      .setName('lock')
      .setDescription('Players to lock in (comma-separated names from your player list)')
      .setRequired(false))
    .addStringOption(o => o
      .setName('exclude')
      .setDescription('Players to exclude (comma-separated names)')
      .setRequired(false))
    .addIntegerOption(o => o
      .setName('max_per_team')
      .setDescription('Max players from one team (default: 4)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(9))
    .addStringOption(o => o
      .setName('players')
      .setDescription('Custom player list: "Name,Pos,Salary,Pts|Name,Pos,Salary,Pts|..." (uses sample data if omitted)')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const lockRaw     = interaction.options.getString('lock') ?? '';
    const excludeRaw  = interaction.options.getString('exclude') ?? '';
    const maxPerTeam  = interaction.options.getInteger('max_per_team') ?? 4;
    const playersRaw  = interaction.options.getString('players');

    const lock    = lockRaw    ? lockRaw.split(',').map(s => s.trim())    : [];
    const exclude = excludeRaw ? excludeRaw.split(',').map(s => s.trim()) : [];

    let players;
    if (playersRaw) {
      // Parse inline: "Name,Pos,Salary,Pts|Name,Pos,Salary,Pts"
      players = playersRaw.split('|').map(raw => {
        const [name, position, salary, pts] = raw.trim().split(',');
        return {
          name: name?.trim(),
          position: position?.trim()?.toUpperCase(),
          salary: parseInt(salary, 10),
          projectedPoints: parseFloat(pts),
          team: 'Unknown',
        };
      }).filter(p => p.name && p.position && !isNaN(p.salary) && !isNaN(p.projectedPoints));
    } else {
      players = sampleData.players.map(p => ({
        ...p,
        // Normalize positions for Draftstars (HFB → HB/FE split handled by sample data)
        position: normDraftstars(p.position),
      }));
    }

    let result;
    try {
      result = optimizeLineup(players, { lock, exclude, maxPerTeam });
    } catch (err) {
      return interaction.editReply(`❌ ${err.message}`);
    }

    const salaryCap = SALARY_CAP;
    const capUsed   = result.totalSalary;
    const capPct    = Math.round((capUsed / salaryCap) * 100);

    const lineupText = result.lineup.map((p, i) =>
      `\`${String(i + 1).padStart(2)}.\` **${p.name}** (${p.position}) · ${p.team} · $${p.salary.toLocaleString()} · ${p.projectedPoints} pts`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x00F0FF)
      .setTitle('🏉 Draftstars NRL Optimal Lineup')
      .setDescription(lineupText)
      .addFields(
        { name: '📊 Projected Total', value: `**${result.projectedPoints} pts**`, inline: true },
        { name: '💰 Salary Used', value: `$${capUsed.toLocaleString()} / $${salaryCap.toLocaleString()} (${capPct}%)`, inline: true },
        { name: '🏦 Cap Remaining', value: `$${result.salarySaved.toLocaleString()}`, inline: true },
      );

    if (lock.length > 0)    embed.addFields({ name: '🔒 Locked', value: lock.join(', '), inline: true });
    if (exclude.length > 0) embed.addFields({ name: '🚫 Excluded', value: exclude.join(', '), inline: true });
    if (!playersRaw) embed.addFields({ name: '⚠️ Note', value: 'Using sample player data. Pass real projections for accurate lineups.' });

    embed.setFooter({ text: `Such Is Fantasy Tools · /optimize · Draftstars $50k cap` });
    return interaction.editReply({ embeds: [embed] });
  },
};

// Expand HFB into alternating HB/FE for Draftstars slots
function normDraftstars(pos) {
  const map = { HFB: 'HB', CTW: 'CTR', FRF: 'PROP', MID: '2RF' };
  return map[pos] ?? pos;
}
