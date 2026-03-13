/**
 * Squad Builder / Team Selector — NRL Fantasy & SuperCoach
 *
 * Builds the optimal 17-player NRL Fantasy squad (or 18-player SuperCoach squad)
 * within salary cap, meeting all positional requirements, while maximising
 * projected average points.
 *
 * NRL Fantasy Squad Requirements:
 *   Fullback (FB):         1
 *   Wing/Centre (CTW):     4
 *   Five-Eighth/HB (HFB): 2
 *   Hooker (HOK):          2
 *   Front Row (FRF):       4
 *   Back Row/Lock (MID):   4
 *   Total:                 17 players
 *   Salary cap:            $6,000,000
 *
 * SuperCoach Squad Requirements:
 *   Fullback (FB):  1
 *   Back (BACK):    4  (CTR/WG)
 *   HFB:            2  (HB/FE)
 *   HOK:            2
 *   FRF:            4  (Props)
 *   MID:            5  (2RF + LK + bench)
 *   Total:          18 players
 *   Salary cap:     $6,500,000
 *
 * Algorithm: Greedy positional fill by projected average descending,
 * with budget-aware pruning.
 */

const NRL_FANTASY_REQUIREMENTS = [
  { position: 'FB',  count: 1 },
  { position: 'CTW', count: 4 },
  { position: 'HFB', count: 2 },
  { position: 'HOK', count: 2 },
  { position: 'FRF', count: 4 },
  { position: 'MID', count: 4 },
];
const NRL_CAP = 6000000;

const SUPERCOACH_REQUIREMENTS = [
  { position: 'FB',   count: 1 },
  { position: 'BACK', count: 4 },
  { position: 'HFB',  count: 2 },
  { position: 'HOK',  count: 2 },
  { position: 'FRF',  count: 4 },
  { position: 'MID',  count: 5 },
];
const SUPERCOACH_CAP = 6500000;

// Positional aliases — allows flexible input
const ALIASES = {
  'FULLBACK': 'FB',
  'WING': 'CTW', 'CENTRE': 'CTW', 'CENTER': 'CTW', 'CTR': 'CTW', 'WG': 'CTW',
  'HALFBACK': 'HFB', 'HALF': 'HFB', 'HB': 'HFB', 'FIVE-EIGHTH': 'HFB', 'FE': 'HFB',
  'HOOKER': 'HOK',
  'PROP': 'FRF', 'FRONT ROW': 'FRF',
  'LOCK': 'MID', 'SECOND ROW': 'MID', '2RF': 'MID', 'LK': 'MID', 'BACK ROW': 'MID',
  // SuperCoach
  'BACK': 'BACK',
};

/**
 * Build an optimal squad.
 *
 * @param {Array<{ name: string, price: number, projectedAvg: number, position: string, team?: string }>} players
 * @param {object} [opts]
 * @param {'nrl'|'supercoach'} [opts.game]         — default 'nrl'
 * @param {string[]} [opts.mustInclude]             — player names to force into squad
 * @param {string[]} [opts.exclude]                 — players to exclude
 * @param {number}   [opts.maxPerTeam]              — max from one team (default 5)
 * @returns {{ squad: object[], totalPrice: number, avgProjected: number, remaining: number, breakdown: object }}
 */
function buildSquad(players, opts = {}) {
  const { game = 'nrl', mustInclude = [], exclude = [], maxPerTeam = 5 } = opts;

  const requirements = game === 'supercoach' ? SUPERCOACH_REQUIREMENTS : NRL_FANTASY_REQUIREMENTS;
  const cap = game === 'supercoach' ? SUPERCOACH_CAP : NRL_CAP;

  // Normalise positions
  const pool = players
    .filter(p => !exclude.map(n => n.toLowerCase()).includes(p.name.toLowerCase()))
    .map(p => ({ ...p, position: normalisePosition(p.position) }))
    .filter(p => p.position !== null);

  const squad = [];
  const used = new Set();
  const teamCounts = {};

  // Lock must-include players first
  for (const name of mustInclude) {
    const p = pool.find(pl => pl.name.toLowerCase() === name.toLowerCase());
    if (p && !used.has(p.name)) {
      squad.push(p);
      used.add(p.name);
      teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
    }
  }

  // Fill requirements greedily
  for (const { position, count } of requirements) {
    const alreadyFilled = squad.filter(p => p.position === position).length;
    const needed = count - alreadyFilled;
    if (needed <= 0) continue;

    const currentSpend = squad.reduce((s, p) => s + p.price, 0);
    const slotsLeft = (requirements.reduce((s, r) => s + r.count, 0)) - squad.length;
    const budgetForSlot = (cap - currentSpend);

    // Sort by projected avg descending, apply team cap
    const candidates = pool
      .filter(p =>
        p.position === position &&
        !used.has(p.name) &&
        (teamCounts[p.team] ?? 0) < maxPerTeam
      )
      .sort((a, b) => b.projectedAvg - a.projectedAvg);

    let picked = 0;
    for (const p of candidates) {
      if (picked >= needed) break;
      // Ensure minimum budget for remaining slots
      const avgRemainingCost = 300000; // conservative estimate for unfilled slots
      if (currentSpend + p.price + (slotsLeft - picked - 1) * avgRemainingCost > cap) continue;

      squad.push(p);
      used.add(p.name);
      teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
      picked++;
    }
  }

  const totalPrice = squad.reduce((s, p) => s + p.price, 0);
  const avgProjected = squad.length
    ? Math.round((squad.reduce((s, p) => s + p.projectedAvg, 0) / squad.length) * 10) / 10
    : 0;

  // Build position breakdown
  const breakdown = {};
  for (const { position, count } of requirements) {
    const filled = squad.filter(p => p.position === position);
    breakdown[position] = {
      required: count,
      filled: filled.length,
      short: Math.max(0, count - filled.length),
      players: filled.map(p => ({ name: p.name, price: p.price, avg: p.projectedAvg })),
    };
  }

  return {
    squad: squad.map(p => ({
      name: p.name,
      position: p.position,
      team: p.team ?? '—',
      price: p.price,
      projectedAvg: p.projectedAvg,
    })),
    totalPrice,
    remaining: cap - totalPrice,
    avgProjected,
    breakdown,
    complete: squad.length === requirements.reduce((s, r) => s + r.count, 0),
  };
}

function normalisePosition(pos) {
  if (!pos) return null;
  const upper = pos.toUpperCase().trim();
  return ALIASES[upper] ?? (Object.values(ALIASES).includes(upper) ? upper : null);
}

module.exports = { buildSquad, NRL_FANTASY_REQUIREMENTS, SUPERCOACH_REQUIREMENTS };
