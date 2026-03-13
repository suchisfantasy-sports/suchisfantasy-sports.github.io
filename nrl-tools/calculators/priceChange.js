/**
 * Price Change Predictor — NRL Fantasy & SuperCoach
 *
 * Predicts how much a player's price will change after a given score,
 * and projects price movement over multiple upcoming rounds.
 *
 * Price Change Formula:
 *   price_change = (projected_score − break_even) × (base_price / (3 × base_avg))
 *
 * Derivation:
 *   new_3game_avg = (score_prev2 + score_prev1 + projected) / 3
 *   avg_delta     = new_3game_avg − base_avg
 *   price_change  = avg_delta × (base_price / base_avg)
 *   → simplifies to: (projected − BE) × base_price / (3 × base_avg)
 *
 * NRL Fantasy prices update Thursday each week.
 * SuperCoach prices update Wednesday each week.
 */

const { calculateBreakEven, baseAvgFromPrice } = require('./breakeven');

/**
 * Predict price change after a single projected score.
 *
 * @param {object} opts
 * @param {number}   opts.basePrice      — current price (e.g. 275000)
 * @param {number}   opts.baseAvg        — base average for current price
 * @param {number[]} opts.recentScores   — last scores [oldest first, max 2]
 * @param {number}   opts.projectedScore — projected score this round
 * @returns {{ priceChange: number, newPrice: number, newAvg: number, breakEven: number, direction: string }}
 */
function predictPriceChange({ basePrice, baseAvg, recentScores = [], projectedScore }) {
  if (!basePrice || !baseAvg || projectedScore === undefined) {
    throw new Error('basePrice, baseAvg, and projectedScore are required');
  }

  const { breakEven } = calculateBreakEven({ baseAvg, recentScores });

  // Price change per point above/below BE
  const pricePerPoint = basePrice / (3 * baseAvg);

  const rawChange = (projectedScore - breakEven) * pricePerPoint;
  // Prices move in ~$1,000 increments
  const priceChange = Math.round(rawChange / 1000) * 1000;
  const newPrice = basePrice + priceChange;

  // New 3-game average after this score
  const scores = recentScores.slice(-2);
  const window = [...scores, projectedScore];
  const newAvg = Math.round(window.reduce((a, b) => a + b, 0) / window.length);

  const direction = priceChange > 0 ? '📈 Rise' : priceChange < 0 ? '📉 Fall' : '➡️ Hold';

  return {
    breakEven,
    priceChange,
    newPrice,
    newAvg,
    direction,
    pricePerPoint: Math.round(pricePerPoint),
  };
}

/**
 * Multi-round price projection.
 * Projects price over N rounds given expected scores.
 *
 * @param {object} opts
 * @param {number}   opts.basePrice      — starting price
 * @param {number}   opts.baseAvg        — base avg for starting price
 * @param {number[]} opts.recentScores   — existing score history [oldest first, max 2]
 * @param {number[]} opts.projectedScores — array of N projected scores (1 per round)
 * @returns {Array<{ round: number, score: number, breakEven: number, priceChange: number, price: number }>}
 */
function multiRoundProjection({ basePrice, baseAvg, recentScores = [], projectedScores }) {
  if (!projectedScores?.length) throw new Error('projectedScores array required');

  const results = [];
  let currentPrice = basePrice;
  let scores = [...recentScores.slice(-2)]; // rolling window

  for (let i = 0; i < projectedScores.length; i++) {
    const projected = projectedScores[i];
    const result = predictPriceChange({
      basePrice: currentPrice,
      baseAvg,
      recentScores: scores,
      projectedScore: projected,
    });

    results.push({
      round: i + 1,
      score: projected,
      breakEven: result.breakEven,
      priceChange: result.priceChange,
      price: result.newPrice,
      direction: result.direction,
    });

    // Advance rolling window
    scores = [...scores, projected].slice(-2);
    currentPrice = result.newPrice;
  }

  return results;
}

module.exports = { predictPriceChange, multiRoundProjection };
