const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { calculateBreakEven, baseAvgFromPrice } = require('../calculators/breakeven');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('breakeven')
    .setDescription('Calculate a player\'s break-even score for this round')
    .addNumberOption(o => o
      .setName('base_avg')
      .setDescription('Player\'s base average (or omit and provide starting_price instead)')
      .setRequired(false))
    .addNumberOption(o => o
      .setName('starting_price')
      .setDescription('Player\'s season-start price (used to derive base avg if base_avg not given)')
      .setRequired(false))
    .addNumberOption(o => o
      .setName('score_last')
      .setDescription('Score from last round')
      .setRequired(false))
    .addNumberOption(o => o
      .setName('score_prev')
      .setDescription('Score from 2 rounds ago')
      .setRequired(false))
    .addStringOption(o => o
      .setName('player_name')
      .setDescription('Player name (for display only)')
      .setRequired(false))
    .addStringOption(o => o
      .setName('game')
      .setDescription('NRL Fantasy or SuperCoach?')
      .setRequired(false)
      .addChoices(
        { name: 'NRL Fantasy', value: 'nrl' },
        { name: 'SuperCoach',  value: 'supercoach' },
      )),

  async execute(interaction) {
    const playerName   = interaction.options.getString('player_name') ?? 'Player';
    const game         = interaction.options.getString('game') ?? 'nrl';
    const startPrice   = interaction.options.getNumber('starting_price');
    const scoreLast    = interaction.options.getNumber('score_last');
    const scorePrev    = interaction.options.getNumber('score_prev');
    let   baseAvg      = interaction.options.getNumber('base_avg');

    if (!baseAvg && !startPrice) {
      return interaction.reply({ content: '❌ Provide either `base_avg` or `starting_price`.', ephemeral: true });
    }

    if (!baseAvg) baseAvg = baseAvgFromPrice(startPrice, game);

    const recentScores = [];
    if (scorePrev != null) recentScores.push(scorePrev);
    if (scoreLast != null) recentScores.push(scoreLast);

    let result;
    try {
      result = calculateBreakEven({ baseAvg, recentScores });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }

    const movementIcon = result.priceMovement === 'rise' ? '📈' : result.priceMovement === 'fall' ? '📉' : '➡️';
    const movementText = result.priceMovement === 'rise'
      ? 'Last score was above BE — price rising'
      : result.priceMovement === 'fall'
        ? 'Last score was below BE — price falling'
        : 'No score to compare yet';

    const embed = new EmbedBuilder()
      .setColor(0x00F0FF)
      .setTitle(`🏉 Break-Even — ${playerName}`)
      .setDescription(`*${game === 'supercoach' ? 'SuperCoach' : 'NRL Fantasy'} · 3-game rolling average*`)
      .addFields(
        { name: '🎯 Break-Even Score', value: `**${result.breakEven} pts**`, inline: true },
        { name: '📊 Base Average', value: `${baseAvg} pts`, inline: true },
        { name: `${movementIcon} Price Direction`, value: movementText, inline: false },
      );

    if (recentScores.length > 0) {
      embed.addFields({ name: '📋 Recent Scores', value: recentScores.join(', '), inline: true });
    }

    embed.addFields({ name: '🔢 Formula', value: `\`${result.details.formula}\``, inline: false });
    embed.setFooter({ text: 'Such Is Fantasy Tools · /breakeven' });

    return interaction.reply({ embeds: [embed] });
  },
};
