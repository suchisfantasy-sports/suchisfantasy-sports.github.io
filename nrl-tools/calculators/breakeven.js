/**
 * Break-Even Calculator — NRL Fantasy & SuperCoach
 *
 * Break-even = the score a player must hit this round so their 3-game
 * rolling average does NOT fall below their base average (i.e., price
 * stays the same or rises).
 *
 * Formula: BE = ceil( 3 × base_avg − score_prev2 − score_prev1 )
 *
 * Where:
 *   base_avg   = the average the player needs to maintain current price
 *   score_prev1 = last round score
 *   score_prev2 = two rounds ago score
 *
 * If a player has fewer than 2 historical scores, we adjust accordingly.
 */

/**
 * @param {object} opts
 * @param {number}   opts.baseAvg       — base average (price ÷ price_factor)
 * @param {number[]} opts.recentScores  — recent scores, oldest first, max 2 needed
 *                                        e.g. [score_2_rounds_ago, score_last_round]
 * @returns {{ breakEven: number, priceMovement: 'rise'|'hold'|'fall', details: object }}
 */
function calculateBreakEven({ baseAvg, recentScores = [] }) {
  if (!baseAvg || baseAvg <= 0) throw new Error('baseAvg must be a positive number');

  const s = recentScores.slice(-2); // only need last 2

  let raw;
  if (s.length === 0) {
    // No history — player needs to score their base avg
    raw = baseAvg;
  } else if (s.length === 1) {
    // 1 game played — rolling window is 2 scores short
    raw = 3 * baseAvg - s[0];
  } else {
    // 2+ games played — standard 3-game rolling average
    raw = 3 * baseAvg - s[0] - s[1];
  }

  const breakEven = Math.ceil(raw);

  // Premium estimate: points above/below BE → price direction
  const lastScore = s[s.length - 1] ?? null;
  let priceMovement = 'hold';
  if (lastScore !== null) {
    if (lastScore > breakEven) priceMovement = 'rise';
    else if (lastScore < breakEven) priceMovement = 'fall';
  }

  return {
    breakEven,
    priceMovement,
    details: {
      baseAvg,
      recentScores: s,
      formula: s.length === 2
        ? `ceil(3 × ${baseAvg} − ${s[0]} − ${s[1]}) = ${breakEven}`
        : s.length === 1
          ? `ceil(3 × ${baseAvg} − ${s[0]}) = ${breakEven}`
          : `baseAvg = ${breakEven}`,
    },
  };
}

/**
 * Derive base average from a known starting price.
 * NRL Fantasy price factor is approximately $5,500 per average point.
 * SuperCoach is slightly different (~$5,800 per avg point).
 *
 * @param {number} startingPrice — player's price at season start (e.g. 275000)
 * @param {'nrl'|'supercoach'} game
 */
function baseAvgFromPrice(startingPrice, game = 'nrl') {
  const factor = game === 'supercoach' ? 5800 : 5500;
  return Math.round(startingPrice / factor);
}

module.exports = { calculateBreakEven, baseAvgFromPrice };
