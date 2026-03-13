/**
 * Trade Calculator — NRL Fantasy & SuperCoach
 *
 * Compares two players and calculates the full value of a trade:
 *   - Bank impact (sell + bank - buy)
 *   - Average points gain/loss
 *   - Total points value over remaining rounds
 *   - Price trajectory impact (is player rising or falling?)
 *   - Trade verdict with recommendation
 *
 * Works for both straight swaps and captain upgrades.
 */

/**
 * @param {object} opts
 * @param {object} opts.sell   — player being sold
 *   @param {string} sell.name
 *   @param {number} sell.price
 *   @param {number} sell.avgScore          — 3-game rolling avg
 *   @param {number} sell.breakEven         — current break-even
 *   @param {number} sell.projectedAvg      — expected avg for rest of season
 *   @param {'rising'|'falling'|'steady'} sell.priceTrend
 * @param {object} opts.buy    — player being bought
 *   @param {string} buy.name
 *   @param {number} buy.price
 *   @param {number} buy.avgScore
 *   @param {number} buy.breakEven
 *   @param {number} buy.projectedAvg
 *   @param {'rising'|'falling'|'steady'} buy.priceTrend
 * @param {number} opts.bank            — current bank balance
 * @param {number} opts.remainingRounds — rounds left in season
 * @returns {{ viable: boolean, bankAfter: number, pointsGain: number, verdict: string, breakdown: object }}
 */
function calculateTrade({ sell, buy, bank = 0, remainingRounds = 10 }) {
  // ── Bank impact ─────────────────────────────────────────────────────────
  const proceeds = sell.price;
  const cost = buy.price;
  const bankAfter = bank + proceeds - cost;
  const canAfford = bankAfter >= 0;

  // ── Points value ─────────────────────────────────────────────────────────
  const pointsGainPerRound = (buy.projectedAvg || buy.avgScore) - (sell.projectedAvg || sell.avgScore);
  const totalPointsGain = Math.round(pointsGainPerRound * remainingRounds);

  // ── Price trajectory score ───────────────────────────────────────────────
  // Rising sellers losing value, falling buyers = bad; invert for good trades
  const trendScore = {
    rising:  1,
    steady:  0,
    falling: -1,
  };
  const sellerTrend = trendScore[sell.priceTrend] ?? 0;
  const buyerTrend  = trendScore[buy.priceTrend]  ?? 0;

  // Good trade: sell rising (get max value), buy rising (gain price upside)
  // Also good: sell falling (get out before further drops)
  const tradeTimingScore = sellerTrend + buyerTrend; // range: -2 to 2

  // ── Break-even comparison ────────────────────────────────────────────────
  const beAdvantage = sell.breakEven - buy.breakEven; // positive = buy player easier to hold

  // ── Verdict ──────────────────────────────────────────────────────────────
  const issues = [];
  if (!canAfford) issues.push(`Can't afford — ${formatPrice(Math.abs(bankAfter))} short`);
  if (pointsGainPerRound < 0) issues.push(`Losing ~${Math.abs(Math.round(pointsGainPerRound))} pts/round`);
  if (sell.priceTrend === 'rising') issues.push('Selling a rising asset early');
  if (buy.priceTrend === 'falling') issues.push('Buying a falling player');

  const positives = [];
  if (pointsGainPerRound > 5)  positives.push(`Gain ~${Math.round(pointsGainPerRound)} pts/round`);
  if (buy.priceTrend === 'rising') positives.push('Buying into a price rise');
  if (sell.priceTrend === 'falling') positives.push('Selling before further price drops');
  if (beAdvantage > 10) positives.push(`${buy.name}'s BE is ${beAdvantage} pts easier to hit`);
  if (bankAfter > 50000) positives.push(`Bank improves by ${formatPrice(bankAfter - bank)}`);

  let verdict;
  if (!canAfford) {
    verdict = '❌ Cannot Afford';
  } else if (totalPointsGain >= 50 && tradeTimingScore >= 0) {
    verdict = '✅ Strong Trade — Do It';
  } else if (totalPointsGain >= 20) {
    verdict = '👍 Trade Recommended';
  } else if (totalPointsGain >= 0 && issues.length === 0) {
    verdict = '➡️ Marginal — Consider Holding';
  } else if (totalPointsGain < 0 && issues.length > 0) {
    verdict = '⚠️ Avoid — Net Negative';
  } else {
    verdict = '🤔 Situational — Check Byes & Captains';
  }

  return {
    viable: canAfford,
    bankAfter,
    bankChange: bankAfter - bank,
    pointsGainPerRound: Math.round(pointsGainPerRound * 10) / 10,
    totalPointsGain,
    verdict,
    positives,
    issues,
    breakdown: {
      sell: { name: sell.name, price: sell.price, avg: sell.avgScore, be: sell.breakEven, trend: sell.priceTrend },
      buy:  { name: buy.name,  price: buy.price,  avg: buy.avgScore,  be: buy.breakEven,  trend: buy.priceTrend },
      remainingRounds,
    },
  };
}

function formatPrice(n) {
  return '$' + Math.abs(n).toLocaleString();
}

module.exports = { calculateTrade };
