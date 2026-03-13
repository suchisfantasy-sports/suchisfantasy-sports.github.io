const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { planByes, teamsOnBye, teamByeRound } = require('../calculators/byePlanner');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('byeplanner')
    .setDescription('Plan your squad around bye rounds')
    .addSubcommand(sub => sub
      .setName('squad')
      .setDescription('Analyse bye coverage for your full squad')
      .addStringOption(o => o
        .setName('players')
        .setDescription('Comma-separated: Name:Team:Position (e.g. "Yeo:Panthers:MID,Grant:Storm:HOK")')
        .setRequired(true))
      .addStringOption(o => o
        .setName('game')
        .setDescription('NRL Fantasy or SuperCoach?')
        .addChoices({ name: 'NRL Fantasy', value: 'nrl' }, { name: 'SuperCoach', value: 'supercoach' })))
    .addSubcommand(sub => sub
      .setName('team')
      .setDescription('Check which round a team has their bye')
      .addStringOption(o => o
        .setName('team')
        .setDescription('Team name (e.g. Panthers, Storm)')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('round')
      .setDescription('Show all teams on bye in a given round')
      .addIntegerOption(o => o
        .setName('round')
        .setDescription('Round number')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(27))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'team') {
      const team = interaction.options.getString('team');
      const round = teamByeRound(team);
      if (round === null) {
        return interaction.reply({ content: `❌ Could not find bye for "${team}". Check the team name.`, ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0x00F0FF)
        .setTitle(`🏉 Bye Round — ${team}`)
        .setDescription(`**${team}** have their bye in **Round ${round}**.`)
        .setFooter({ text: 'Such Is Fantasy Tools · /byeplanner' });
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'round') {
      const round = interaction.options.getInteger('round');
      const teams = teamsOnBye(round);
      const embed = new EmbedBuilder()
        .setColor(0x00F0FF)
        .setTitle(`🏈 Round ${round} Byes`)
        .setDescription(teams.length > 0
          ? teams.map(t => `• ${t}`).join('\n')
          : 'No bye teams recorded for this round.')
        .setFooter({ text: 'Such Is Fantasy Tools · /byeplanner' });
      return interaction.reply({ embeds: [embed] });
    }

    // sub === 'squad'
    const rawPlayers = interaction.options.getString('players');
    const game = interaction.options.getString('game') ?? 'nrl';

    const squad = rawPlayers.split(',').map(p => {
      const [name, team, position] = p.trim().split(':');
      return { name: name?.trim(), team: team?.trim(), position: position?.trim() ?? '?' };
    }).filter(p => p.name && p.team);

    if (squad.length === 0) {
      return interaction.reply({ content: '❌ No valid players parsed. Format: `Name:Team:Position`', ephemeral: true });
    }

    let result;
    try {
      result = planByes(squad, game);
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(result.riskRounds.length > 0 ? 0xff9800 : 0x00e676)
      .setTitle(`📅 Bye Round Planner — ${squad.length} Players`)
      .setDescription(result.riskRounds.length > 0
        ? `⚠️ High-risk bye rounds: **${result.riskRounds.join(', ')}**`
        : '✅ No problematic bye clashes detected');

    for (const round of result.summary) {
      const riskEmoji = round.risk === 'HIGH' ? '🔴' : round.risk === 'MEDIUM' ? '🟡' : '🟢';
      embed.addFields({
        name: `${riskEmoji} Round ${round.round} (${round.count} on bye)`,
        value: round.players.map(p => `${p.name} (${p.team} · ${p.position})`).join('\n') || '—',
      });
    }

    if (result.recommendations.length > 0) {
      embed.addFields({
        name: '💡 Recommendations',
        value: result.recommendations.join('\n').slice(0, 1024),
      });
    }

    embed.setFooter({ text: 'Such Is Fantasy Tools · /byeplanner squad' });
    return interaction.reply({ embeds: [embed] });
  },
};
