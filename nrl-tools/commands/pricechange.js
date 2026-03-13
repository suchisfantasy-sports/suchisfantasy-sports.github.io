const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { predictPriceChange, multiRoundProjection } = require('../calculators/priceChange');
const { baseAvgFromPrice } = require('../calculators/breakeven');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pricechange')
    .setDescription('Predict how much a player\'s price will change after a projected score')
    .addNumberOption(o => o
      .setName('current_price')
      .setDescription('Player\'s current price (e.g. 456000)')
      .setRequired(true))
    .addNumberOption(o => o
      .setName('projected_score')
      .setDescription('Expected score this round')
      .setRequired(true))
    .addNumberOption(o => o
      .setName('base_avg')
      .setDescription('Base average (leave blank to auto-derive from price)')
      .setRequired(false))
    .addNumberOption(o => o
      .setName('score_last')
      .setDescription('Last round score')
      .setRequired(false))
    .addNumberOption(o => o
      .setName('score_prev')
      .setDescription('Score from 2 rounds ago')
      .setRequired(false))
    .addStringOption(o => o
      .setName('player_name')
      .setDescription('Player name (display only)')
      .setRequired(false))
    .addStringOption(o => o
      .setName('rounds')
      .setDescription('Comma-separated projected scores for multi-round forecast (e.g. 60,55,65)')
      .setRequired(false)),

  async execute(interaction) {
    const playerName = interaction.options.getString('player_name') ?? 'Player';
    const basePrice  = interaction.options.getNumber('current_price');
    const projected  = interaction.options.getNumber('projected_score');
    const scoreLast  = interaction.options.getNumber('score_last');
    const scorePrev  = interaction.options.getNumber('score_prev');
    const roundsRaw  = interaction.options.getString('rounds');
    let   baseAvg    = interaction.options.getNumber('base_avg');

    if (!baseAvg) baseAvg = baseAvgFromPrice(basePrice, 'nrl');

    const recentScores = [];
    if (scorePrev != null) recentScores.push(scorePrev);
    if (scoreLast != null) recentScores.push(scoreLast);

    try {
      // Single round prediction
      const single = predictPriceChange({ basePrice, baseAvg, recentScores, projectedScore: projected });

      const embed = new EmbedBuilder()
        .setColor(single.priceChange > 0 ? 0x00e676 : single.priceChange < 0 ? 0xff5252 : 0xffd740)
        .setTitle(`${single.direction} Price Change — ${playerName}`)
        .addFields(
          { name: '💰 Current Price', value: formatPrice(basePrice), inline: true },
          { name: '💹 New Price',     value: formatPrice(single.newPrice), inline: true },
          { name: '📊 Change',        value: `${single.priceChange >= 0 ? '+' : ''}${formatPrice(single.priceChange)}`, inline: true },
          { name: '🎯 Break-Even',    value: `${single.breakEven} pts`, inline: true },
          { name: '📈 Projected Score', value: `${projected} pts`, inline: true },
          { name: '📋 New 3-Game Avg', value: `${single.newAvg} pts`, inline: true },
        );

      // Multi-round projection if provided
      if (roundsRaw) {
        const projectedScores = roundsRaw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        if (projectedScores.length > 0) {
          const multiResult = multiRoundProjection({ basePrice, baseAvg, recentScores, projectedScores });
          const table = multiResult.map(r =>
            `Rd ${r.round}: **${r.score} pts** → ${r.direction} ${r.priceChange >= 0 ? '+' : ''}${formatPrice(r.priceChange)} → ${formatPrice(r.price)}`
          ).join('\n');

          embed.addFields({ name: `📅 ${projectedScores.length}-Round Forecast`, value: table });
        }
      }

      embed.setFooter({ text: `Such Is Fantasy Tools · ~${formatPrice(single.pricePerPoint)}/pt above BE` });
      return interaction.reply({ embeds: [embed] });

    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};

function formatPrice(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  return sign + '$' + abs.toLocaleString();
}
