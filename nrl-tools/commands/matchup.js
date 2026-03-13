const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { rateMatchup, bestMatchupsForPosition, teamMatchupReport } = require('../calculators/matchup');

// Sample defence stats — replace with real data each round
// Format: { team, position, avgConceded } — avg pts conceded to that position per game
const SAMPLE_DEFENCE_STATS = [
  // HOK (Hooker) — points conceded
  { team: 'Tigers',    position: 'HOK', avgConceded: 72 },
  { team: 'Bulldogs',  position: 'HOK', avgConceded: 68 },
  { team: 'Knights',   position: 'HOK', avgConceded: 65 },
  { team: 'Raiders',   position: 'HOK', avgConceded: 63 },
  { team: 'Warriors',  position: 'HOK', avgConceded: 61 },
  { team: 'Dolphins',  position: 'HOK', avgConceded: 59 },
  { team: 'Dragons',   position: 'HOK', avgConceded: 57 },
  { team: 'Eels',      position: 'HOK', avgConceded: 55 },
  { team: 'Roosters',  position: 'HOK', avgConceded: 54 },
  { team: 'Cowboys',   position: 'HOK', avgConceded: 52 },
  { team: 'Sea Eagles', position: 'HOK', avgConceded: 50 },
  { team: 'Titans',    position: 'HOK', avgConceded: 49 },
  { team: 'Sharks',    position: 'HOK', avgConceded: 48 },
  { team: 'Broncos',   position: 'HOK', avgConceded: 47 },
  { team: 'Storm',     position: 'HOK', avgConceded: 45 },
  { team: 'Panthers',  position: 'HOK', avgConceded: 43 },
  { team: 'Rabbitohs', position: 'HOK', avgConceded: 41 },

  // HFB (Halfback / Five-Eighth) — points conceded
  { team: 'Bulldogs',  position: 'HFB', avgConceded: 78 },
  { team: 'Tigers',    position: 'HFB', avgConceded: 74 },
  { team: 'Dragons',   position: 'HFB', avgConceded: 70 },
  { team: 'Knights',   position: 'HFB', avgConceded: 67 },
  { team: 'Raiders',   position: 'HFB', avgConceded: 64 },
  { team: 'Warriors',  position: 'HFB', avgConceded: 62 },
  { team: 'Dolphins',  position: 'HFB', avgConceded: 60 },
  { team: 'Cowboys',   position: 'HFB', avgConceded: 58 },
  { team: 'Eels',      position: 'HFB', avgConceded: 56 },
  { team: 'Titans',    position: 'HFB', avgConceded: 54 },
  { team: 'Sea Eagles', position: 'HFB', avgConceded: 52 },
  { team: 'Roosters',  position: 'HFB', avgConceded: 51 },
  { team: 'Sharks',    position: 'HFB', avgConceded: 49 },
  { team: 'Broncos',   position: 'HFB', avgConceded: 47 },
  { team: 'Storm',     position: 'HFB', avgConceded: 45 },
  { team: 'Rabbitohs', position: 'HFB', avgConceded: 43 },
  { team: 'Panthers',  position: 'HFB', avgConceded: 41 },

  // FB (Fullback)
  { team: 'Bulldogs',  position: 'FB',  avgConceded: 71 },
  { team: 'Tigers',    position: 'FB',  avgConceded: 68 },
  { team: 'Dragons',   position: 'FB',  avgConceded: 64 },
  { team: 'Knights',   position: 'FB',  avgConceded: 61 },
  { team: 'Warriors',  position: 'FB',  avgConceded: 58 },
  { team: 'Dolphins',  position: 'FB',  avgConceded: 56 },
  { team: 'Cowboys',   position: 'FB',  avgConceded: 54 },
  { team: 'Raiders',   position: 'FB',  avgConceded: 52 },
  { team: 'Eels',      position: 'FB',  avgConceded: 50 },
  { team: 'Titans',    position: 'FB',  avgConceded: 48 },
  { team: 'Sea Eagles', position: 'FB', avgConceded: 47 },
  { team: 'Roosters',  position: 'FB',  avgConceded: 45 },
  { team: 'Sharks',    position: 'FB',  avgConceded: 44 },
  { team: 'Broncos',   position: 'FB',  avgConceded: 42 },
  { team: 'Storm',     position: 'FB',  avgConceded: 41 },
  { team: 'Rabbitohs', position: 'FB',  avgConceded: 39 },
  { team: 'Panthers',  position: 'FB',  avgConceded: 37 },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('matchup')
    .setDescription('Rate fantasy matchups by position vs opponent')
    .addSubcommand(sub => sub
      .setName('rate')
      .setDescription('Rate one position vs one opponent team')
      .addStringOption(o => o
        .setName('position')
        .setDescription('Position (HOK, HFB, FB, CTW, FRF, MID)')
        .setRequired(true))
      .addStringOption(o => o
        .setName('opponent')
        .setDescription('Opponent team name')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('best')
      .setDescription('Top matchups for a position this round')
      .addStringOption(o => o
        .setName('position')
        .setDescription('Position (HOK, HFB, FB, CTW, FRF, MID)')
        .setRequired(true))
      .addIntegerOption(o => o
        .setName('top')
        .setDescription('How many to show (default 5)')
        .setMinValue(1).setMaxValue(10)))
    .addSubcommand(sub => sub
      .setName('team')
      .setDescription('Full matchup report for a team (all positions)')
      .addStringOption(o => o
        .setName('opponent')
        .setDescription('Team name to analyse')
        .setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'rate') {
      const position = interaction.options.getString('position').toUpperCase();
      const opponent = interaction.options.getString('opponent');
      try {
        const r = rateMatchup({ position, opponent, defenceStats: SAMPLE_DEFENCE_STATS });
        const embed = new EmbedBuilder()
          .setColor(r.rating >= 4 ? 0x00e676 : r.rating >= 3 ? 0xffd740 : 0xff5252)
          .setTitle(`${r.stars} ${position} vs ${opponent}`)
          .setDescription(`**${r.label}** matchup — ranked **#${r.rank}** of ${r.totalTeams} teams`)
          .addFields(
            { name: 'Avg Pts Conceded', value: `${r.avgConceded} pts`, inline: true },
            { name: 'Percentile',       value: `Top ${100 - r.percentile}%`, inline: true },
          )
          .setFooter({ text: 'Such Is Fantasy Tools · /matchup rate · ⚠️ Sample data — update each round' });
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
      }
    }

    if (sub === 'best') {
      const position = interaction.options.getString('position').toUpperCase();
      const topN = interaction.options.getInteger('top') ?? 5;
      try {
        const results = bestMatchupsForPosition({ position, defenceStats: SAMPLE_DEFENCE_STATS, topN });
        const embed = new EmbedBuilder()
          .setColor(0x00F0FF)
          .setTitle(`🏆 Best ${position} Matchups This Round`)
          .setDescription(results.map((r, i) =>
            `${i + 1}. **${r.team}** ${r.stars} — ${r.avgConceded} avg pts conceded`
          ).join('\n'))
          .setFooter({ text: 'Such Is Fantasy Tools · /matchup best · ⚠️ Sample data — update each round' });
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
      }
    }

    // sub === 'team'
    const opponent = interaction.options.getString('opponent');
    try {
      const results = teamMatchupReport(opponent, SAMPLE_DEFENCE_STATS);
      const embed = new EmbedBuilder()
        .setColor(0x00F0FF)
        .setTitle(`📊 ${opponent} — Full Matchup Report`)
        .setDescription(results.map(r =>
          `**${r.position}** ${r.stars} ${r.label} — ${r.avgConceded} pts conceded avg`
        ).join('\n') || 'No data available for this team.')
        .setFooter({ text: 'Such Is Fantasy Tools · /matchup team · ⚠️ Sample data — update each round' });
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
