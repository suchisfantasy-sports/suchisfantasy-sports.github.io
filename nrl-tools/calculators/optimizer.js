/**
 * Draftstars NRL Lineup Optimizer
 *
 * Draftstars Classic NRL lineup (9 players, $50,000 salary cap):
 *   Slot        | Eligible positions
 *   ------------|-------------------
 *   Halfback    | HB
 *   Five-Eighth | FE
 *   Fullback    | FB
 *   Hooker      | HOK
 *   Centre ×2   | CTR
 *   Wing ×2     | WG
 *   Forward     | PROP, FRF, 2RF, LK (flexible forward slot)
 *
 * The optimizer uses a greedy selection + local-search hill-climbing approach.
 * For each position slot, it picks the highest-value player who fits within
 * the remaining salary cap, then iteratively swaps players to improve the total.
 *
 * Provide a players array with: name, salary, projectedPoints, position
 */

const LINEUP_STRUCTURE = [
  { slot: 'Halfback',   eligible: ['HB'],              count: 1 },
  { slot: 'Five-Eight', eligible: ['FE'],              count: 1 },
  { slot: 'Fullback',   eligible: ['FB'],              count: 1 },
  { slot: 'Hooker',     eligible: ['HOK'],             count: 1 },
  { slot: 'Centre',     eligible: ['CTR'],             count: 2 },
  { slot: 'Wing',       eligible: ['WG'],              count: 2 },
  { slot: 'Forward',    eligible: ['PROP','FRF','2RF','LK'], count: 1 },
];

const SALARY_CAP = 50000;
const LINEUP_SIZE = 9;

/**
 * Optimise a Draftstars NRL lineup.
 *
 * @param {Array<{ name: string, salary: number, projectedPoints: number, position: string, team?: string }>} players
 * @param {object} [opts]
 * @param {string[]} [opts.lock]       — player names to lock into lineup
 * @param {string[]} [opts.exclude]    — player names to exclude
 * @param {number}   [opts.maxPerTeam] — max players from one team (default 4)
 * @param {number}   [opts.iterations] — hill-climb iterations (default 2000)
 * @returns {{ lineup: object[], totalSalary: number, projectedPoints: number, salarySaved: number }}
 */
function optimizeLineup(players, opts = {}) {
  const { lock = [], exclude = [], maxPerTeam = 4, iterations = 2000 } = opts;

  const pool = players.filter(p =>
    !exclude.map(n => n.toLowerCase()).includes(p.name.toLowerCase())
  );

  // ── Greedy seed lineup ───────────────────────────────────────────────────
  let best = greedyLineup(pool, lock, maxPerTeam);
  if (!best) throw new Error('Could not build a valid lineup from the provided player pool');

  // ── Hill-climbing local search ───────────────────────────────────────────
  for (let i = 0; i < iterations; i++) {
    // Pick a random non-locked player in lineup to swap out
    const swappable = best.lineup.filter(p =>
      !lock.map(n => n.toLowerCase()).includes(p.name.toLowerCase())
    );
    if (swappable.length === 0) break;

    const out = swappable[Math.floor(Math.random() * swappable.length)];
    const candidates = eligibleSwaps(out, best.lineup, pool, maxPerTeam, best.totalSalary, lock);

    for (const candidate of candidates) {
      const newLineup = best.lineup.map(p => p.name === out.name ? candidate : p);
      const newSalary = newLineup.reduce((s, p) => s + p.salary, 0);
      const newPts    = newLineup.reduce((s, p) => s + p.projectedPoints, 0);

      if (newSalary <= SALARY_CAP && newPts > best.projectedPoints && isValid(newLineup, maxPerTeam)) {
        best = { lineup: newLineup, totalSalary: newSalary, projectedPoints: newPts };
        break;
      }
    }
  }

  return {
    lineup: best.lineup.map(p => ({
      name: p.name,
      position: p.position,
      team: p.team ?? '—',
      salary: p.salary,
      projectedPoints: p.projectedPoints,
    })),
    totalSalary: best.totalSalary,
    salarySaved: SALARY_CAP - best.totalSalary,
    projectedPoints: Math.round(best.projectedPoints * 10) / 10,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function greedyLineup(pool, lock, maxPerTeam) {
  const lineup = [];
  const used = new Set();

  // Add locked players first
  for (const name of lock) {
    const p = pool.find(pl => pl.name.toLowerCase() === name.toLowerCase());
    if (p && !used.has(p.name)) {
      lineup.push(p);
      used.add(p.name);
    }
  }

  // Fill slots greedily by projected points descending
  for (const { eligible, count } of LINEUP_STRUCTURE) {
    let filled = lineup.filter(p => eligible.includes(p.position)).length;
    const needed = count - filled;

    const candidates = pool
      .filter(p => eligible.includes(p.position) && !used.has(p.name))
      .sort((a, b) => b.projectedPoints - a.projectedPoints);

    for (let i = 0; i < needed && i < candidates.length; i++) {
      const p = candidates[i];
      const currentSalary = lineup.reduce((s, pl) => s + pl.salary, 0);
      if (currentSalary + p.salary <= SALARY_CAP) {
        lineup.push(p);
        used.add(p.name);
      }
    }
  }

  if (lineup.length < LINEUP_SIZE) return null;

  const totalSalary = lineup.reduce((s, p) => s + p.salary, 0);
  const projectedPoints = lineup.reduce((s, p) => s + p.projectedPoints, 0);
  return { lineup, totalSalary, projectedPoints };
}

function eligibleSwaps(out, lineup, pool, maxPerTeam, totalSalary, lock) {
  const remaining = SALARY_CAP - (totalSalary - out.salary);
  const usedNames = new Set(lineup.map(p => p.name));

  return pool
    .filter(p =>
      !usedNames.has(p.name) &&
      p.position === out.position &&
      p.salary <= remaining &&
      !lock.map(n => n.toLowerCase()).includes(p.name.toLowerCase())
    )
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, 10); // top 10 candidates for speed
}

function isValid(lineup, maxPerTeam) {
  if (lineup.length !== LINEUP_SIZE) return false;
  // Check max per team
  const teamCounts = {};
  for (const p of lineup) {
    teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
    if (teamCounts[p.team] > maxPerTeam) return false;
  }
  // Check positions filled correctly
  for (const { eligible, count } of LINEUP_STRUCTURE) {
    const filled = lineup.filter(p => eligible.includes(p.position)).length;
    if (filled < count) return false;
  }
  return true;
}

module.exports = { optimizeLineup, LINEUP_STRUCTURE, SALARY_CAP };
