const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { calculateTrade } = require('../calculators/tradeCalc');

const TREND_CHOICES = [
  { name: '📈 Rising', value: 'rising' },
  { name: '➡️ Steady', value: 'steady' },
  { name: '📉 Falling', value: 'falling' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Evaluate whether a trade is worth making')

    // SELL player
    .addStringOption(o => o.setName('sell_name').setDescription('Name of player you\'re selling').setRequired(true))
    .addNumberOption(o => o.setName('sell_price').setDescription('Sell price').setRequired(true))
    .addNumberOption(o => o.setName('sell_avg').setDescription('Sell player\'s 3-game average').setRequired(true))
    .addNumberOption(o => o.setName('sell_be').setDescription('Sell player\'s break-even').setRequired(true))
    .addStringOption(o => o.setName('sell_trend').setDescription('Sell player\'s price trend').setRequired(true).addChoices(...TREND_CHOICES))
    .addNumberOption(o => o.setName('sell_projected').setDescription('Sell player\'s projected avg for rest of season (optional)').setRequired(false))

    // BUY player
    .addStringOption(o => o.setName('buy_name').setDescription('Name of player you\'re buying').setRequired(true))
    .addNumberOption(o => o.setName('buy_price').setDescription('Buy price').setRequired(true))
    .addNumberOption(o => o.setName('buy_avg').setDescription('Buy player\'s 3-game average').setRequired(true))
    .addNumberOption(o => o.setName('buy_be').setDescription('Buy player\'s break-even').setRequired(true))
    .addStringOption(o => o.setName('buy_trend').setDescription('Buy player\'s price trend').setRequired(true).addChoices(...TREND_CHOICES))
    .addNumberOption(o => o.setName('buy_projected').setDescription('Buy player\'s projected avg for rest of season (optional)').setRequired(false))

    // Context
    .addNumberOption(o => o.setName('bank').setDescription('Current bank balance (default 0)').setRequired(false))
    .addNumberOption(o => o.setName('rounds_left').setDescription('Rounds remaining in season (default 10)').setRequired(false)),

  async execute(interaction) {
    const bank          = interaction.options.getNumber('bank') ?? 0;
    const roundsLeft    = interaction.options.getNumber('rounds_left') ?? 10;

    const sell = {
      name:          interaction.options.getString('sell_name'),
      price:         interaction.options.getNumber('sell_price'),
      avgScore:      interaction.options.getNumber('sell_avg'),
      breakEven:     interaction.options.getNumber('sell_be'),
      priceTrend:    interaction.options.getString('sell_trend'),
      projectedAvg:  interaction.options.getNumber('sell_projected') ?? interaction.options.getNumber('sell_avg'),
    };
    const buy = {
      name:          interaction.options.getString('buy_name'),
      price:         interaction.options.getNumber('buy_price'),
      avgScore:      interaction.options.getNumber('buy_avg'),
      breakEven:     interaction.options.getNumber('buy_be'),
      priceTrend:    interaction.options.getString('buy_trend'),
      projectedAvg:  interaction.options.getNumber('buy_projected') ?? interaction.options.getNumber('buy_avg'),
    };

    let result;
    try {
      result = calculateTrade({ sell, buy, bank, remainingRounds: roundsLeft });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }

    const verdictColor = result.verdict.startsWith('✅') ? 0x00e676
      : result.verdict.startsWith('👍') ? 0x64dd17
      : result.verdict.startsWith('➡️') ? 0xffd740
      : 0xff5252;

    const embed = new EmbedBuilder()
      .setColor(verdictColor)
      .setTitle(`🔄 Trade: ${sell.name} → ${buy.name}`)
      .setDescription(`**${result.verdict}**`)
      .addFields(
        {
          name: `📤 Selling: ${sell.name}`,
          value: [
            `Price: **${fp(sell.price)}**`,
            `Avg: ${sell.avgScore} | BE: ${sell.breakEven}`,
            `Trend: ${trendIcon(sell.priceTrend)}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: `📥 Buying: ${buy.name}`,
          value: [
            `Price: **${fp(buy.price)}**`,
            `Avg: ${buy.avgScore} | BE: ${buy.breakEven}`,
            `Trend: ${trendIcon(buy.priceTrend)}`,
          ].join('\n'),
          inline: true,
        },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: '🏦 Bank After Trade', value: result.viable ? fp(result.bankAfter) : `❌ Short by ${fp(Math.abs(result.bankAfter))}`, inline: true },
        { name: '📊 Pts Gain/Round', value: `${result.pointsGainPerRound >= 0 ? '+' : ''}${result.pointsGainPerRound}`, inline: true },
        { name: `📅 Total Over ${roundsLeft} Rounds`, value: `${result.totalPointsGain >= 0 ? '+' : ''}${result.totalPointsGain} pts`, inline: true },
      );

    if (result.positives.length > 0) {
      embed.addFields({ name: '✅ Pros', value: result.positives.map(p => `• ${p}`).join('\n') });
    }
    if (result.issues.length > 0) {
      embed.addFields({ name: '⚠️ Cons', value: result.issues.map(i => `• ${i}`).join('\n') });
    }

    embed.setFooter({ text: 'Such Is Fantasy Tools · /trade' });
    return interaction.reply({ embeds: [embed] });
  },
};

const fp = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString();
const trendIcon = t => t === 'rising' ? '📈 Rising' : t === 'falling' ? '📉 Falling' : '➡️ Steady';
