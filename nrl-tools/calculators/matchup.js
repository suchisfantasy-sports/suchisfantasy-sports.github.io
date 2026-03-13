/**
 * Matchup / Opposition Analysis — NRL Fantasy & SuperCoach
 *
 * Rates how many fantasy points a team concedes to each position.
 * The higher the points conceded, the more "favourable" the matchup.
 *
 * Usage:
 *   1. Load historical "points conceded by position" stats per team
 *      (from NRL Fantasy data, or pass in manually)
 *   2. Compare teams to find the most/least generous matchups
 *   3. Use to decide start/sit decisions and captaincy targets
 *
 * Matchup Rating Scale:
 *   ★★★★★ Elite   — top 2 matchups for position
 *   ★★★★☆ Great   — top 5
 *   ★★★☆☆ Neutral — average
 *   ★★☆☆☆ Tough   — below average
 *   ★☆☆☆☆ Avoid   — worst matchups
 */

/**
 * Rate a matchup for a given player position against an opponent.
 *
 * @param {object} opts
 * @param {string} opts.position         — player position (e.g. 'HOK', 'HB', 'CTR')
 * @param {string} opts.opponent         — opponent team name
 * @param {Array<{ team: string, position: string, avgConceded: number }>} opts.defenceStats
 *   — array of how many pts each team concedes per position (3-game or season avg)
 * @returns {{ rating: number, stars: string, label: string, avgConceded: number, rank: number, totalTeams: number }}
 */
function rateMatchup({ position, opponent, defenceStats }) {
  // Filter to the relevant position
  const positionStats = defenceStats.filter(s => s.position.toUpperCase() === position.toUpperCase());
  if (positionStats.length === 0) throw new Error(`No defence stats found for position: ${position}`);

  // Sort by points conceded descending (most generous first)
  const ranked = [...positionStats].sort((a, b) => b.avgConceded - a.avgConceded);

  const opponentNorm = opponent.toLowerCase();
  const rankIndex = ranked.findIndex(s => s.team.toLowerCase().includes(opponentNorm) || opponentNorm.includes(s.team.toLowerCase()));

  if (rankIndex === -1) throw new Error(`Team "${opponent}" not found in defence stats`);

  const rank = rankIndex + 1; // 1 = best for fantasy (most pts conceded)
  const total = ranked.length;
  const avgConceded = ranked[rankIndex].avgConceded;

  const pct = (total - rank) / (total - 1); // 1.0 = best matchup, 0.0 = worst
  const rating = Math.round(pct * 4) + 1; // 1–5 stars

  const LABELS = {
    5: 'Elite',
    4: 'Great',
    3: 'Neutral',
    2: 'Tough',
    1: 'Avoid',
  };

  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

  return {
    rating,
    stars,
    label: LABELS[rating],
    avgConceded,
    rank,
    totalTeams: total,
    percentile: Math.round(pct * 100),
  };
}

/**
 * Get the best matchups across all teams for a given position this round.
 * Useful for finding captain targets.
 *
 * @param {object} opts
 * @param {string} opts.position
 * @param {Array<{ team: string, position: string, avgConceded: number }>} opts.defenceStats
 * @param {number} [opts.topN] — how many to return (default 5)
 * @returns {Array<{ team: string, avgConceded: number, rank: number, stars: string }>}
 */
function bestMatchupsForPosition({ position, defenceStats, topN = 5 }) {
  const positionStats = defenceStats.filter(s => s.position.toUpperCase() === position.toUpperCase());
  const ranked = [...positionStats].sort((a, b) => b.avgConceded - a.avgConceded);
  const total = ranked.length;

  return ranked.slice(0, topN).map((s, i) => {
    const pct = (total - (i + 1)) / (total - 1);
    const stars = '★'.repeat(Math.round(pct * 4) + 1) + '☆'.repeat(5 - (Math.round(pct * 4) + 1));
    return {
      team: s.team,
      avgConceded: s.avgConceded,
      rank: i + 1,
      stars,
    };
  });
}

/**
 * Full matchup report: all positions for a player's upcoming opponent.
 *
 * @param {string} opponent
 * @param {Array<{ team: string, position: string, avgConceded: number }>} defenceStats
 * @returns {Array<{ position: string, avgConceded: number, stars: string, label: string }>}
 */
function teamMatchupReport(opponent, defenceStats) {
  const positions = [...new Set(defenceStats.map(s => s.position))];
  const results = [];

  for (const pos of positions) {
    try {
      const result = rateMatchup({ position: pos, opponent, defenceStats });
      results.push({ position: pos, ...result });
    } catch {
      // skip if no data for this position/team combo
    }
  }

  return results.sort((a, b) => b.rating - a.rating);
}

module.exports = { rateMatchup, bestMatchupsForPosition, teamMatchupReport };
