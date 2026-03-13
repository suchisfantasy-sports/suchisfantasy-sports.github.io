/**
 * Bye Round Planner — NRL Fantasy & SuperCoach
 *
 * NRL has 3 bye rounds during the season (typically rounds 9–16).
 * Each team has exactly one bye round.
 *
 * This tool:
 *   1. Takes a squad and maps each player to their team's bye round
 *   2. Identifies rounds where you have too many bye-affected players
 *   3. Flags positions most at risk
 *   4. Suggests trade targets by position to fix coverage
 *
 * Bye rounds 2025 (provisional — update if NRL changes schedule):
 * Round 9:  Cowboys, Bulldogs, Titans, Rabbitohs, Sea Eagles, Broncos
 * Round 10: Warriors, Panthers, Storm, Tigers, Raiders, Knights
 * Round 11: Sharks, Roosters, Dolphins, Dragons, Eels, Sea Eagles (2 teams alternate)
 *
 * NOTE: The NRL hasn't finalised 2025 byes at time of writing.
 * Update data/bye-schedule.json each season.
 */

const BYE_SCHEDULE = require('../data/bye-schedule.json');

/**
 * @param {Array<{ name: string, team: string, position: string }>} squad
 * @param {'nrl'|'supercoach'} game
 * @returns {{ roundBreakdown: object, riskRounds: number[], recommendations: string[] }}
 */
function planByes(squad, game = 'nrl') {
  const roundBreakdown = {}; // round → players on bye

  for (const player of squad) {
    const byeRound = getByeRound(player.team);
    if (byeRound === null) {
      continue; // team not found — skip
    }
    if (!roundBreakdown[byeRound]) roundBreakdown[byeRound] = [];
    roundBreakdown[byeRound].push({
      name: player.name,
      team: player.team,
      position: player.position,
    });
  }

  // ── Identify risk rounds (4+ players on bye) ─────────────────────────────
  const riskThreshold = game === 'supercoach' ? 3 : 4; // SuperCoach smaller benches
  const riskRounds = Object.entries(roundBreakdown)
    .filter(([, players]) => players.length >= riskThreshold)
    .map(([round]) => Number(round))
    .sort((a, b) => a - b);

  // ── Position coverage check ──────────────────────────────────────────────
  const recommendations = [];

  for (const round of riskRounds) {
    const byePlayers = roundBreakdown[round];
    const positionCount = {};
    for (const p of byePlayers) {
      positionCount[p.position] = (positionCount[p.position] || 0) + 1;
    }

    recommendations.push(`⚠️ Round ${round}: ${byePlayers.length} players on bye (${byePlayers.map(p => p.name).join(', ')})`);

    for (const [pos, count] of Object.entries(positionCount)) {
      if (count >= 2) {
        recommendations.push(`   → ${count}× ${pos} on bye — consider trading 1 for a different-bye replacement`);
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Bye coverage looks solid — no rounds with excessive bye clashes');
  }

  // ── Bye round summary ────────────────────────────────────────────────────
  const summary = Object.entries(roundBreakdown).map(([round, players]) => ({
    round: Number(round),
    count: players.length,
    players,
    risk: players.length >= riskThreshold ? 'HIGH' : players.length >= 2 ? 'MEDIUM' : 'LOW',
  })).sort((a, b) => a.round - b.round);

  return { summary, riskRounds, recommendations };
}

function getByeRound(team) {
  const normalised = team.toLowerCase().trim();
  for (const [round, teams] of Object.entries(BYE_SCHEDULE)) {
    if (teams.map(t => t.toLowerCase()).some(t => normalised.includes(t) || t.includes(normalised))) {
      return Number(round);
    }
  }
  return null;
}

/**
 * Get all teams that have their bye in a given round.
 * @param {number} round
 */
function teamsOnBye(round) {
  return BYE_SCHEDULE[round] ?? [];
}

/**
 * Get bye round for a specific team.
 * @param {string} team
 */
function teamByeRound(team) {
  return getByeRound(team);
}

module.exports = { planByes, teamsOnBye, teamByeRound };
