// SCPB RSS Injury Alert Bot
// Polls sports RSS feeds every 10 minutes and posts injury/team news to Discord
// Node.js 18+ required (uses built-in fetch)

require('dotenv').config();
const Parser = require('rss-parser');
const fs     = require('fs');
const path   = require('path');

const parser    = new Parser({ timeout: 10000 });
const SEEN_FILE = path.join(__dirname, 'seen.json');
const INTERVAL  = 10 * 60 * 1000; // 10 minutes

// ── RSS feeds per sport ─────────────────────────────────────────────────────
// Multiple sources per sport — first one to return a match wins
const FEEDS = {
  nrl: [
    'https://www.zerotackle.com/feed/',
    'https://www.leaguefreak.com/feed/',
    'https://rss.app/feeds/X0jwiY7Ayh0wM4kb.xml',
    'https://rss.app/feeds/wstLPJdt7oEUA8UG.xml',
    'https://rss.app/feeds/FhMZUs3u2V9PJsJx.xml',
  ],
  epl: [
    'https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml',
    'https://www.skysports.com/rss/12040',
    'https://www.theguardian.com/football/premierleague/rss',
  ],
  nba: [
    'https://www.espn.com/espn/rss/nba/news',
    'https://feeds.bbci.co.uk/sport/basketball/rss.xml',
    'https://www.theguardian.com/sport/nba/rss',
  ],
  nfl: [
    'https://www.espn.com/espn/rss/nfl/news',
    'https://feeds.bbci.co.uk/sport/american-football/rss.xml',
    'https://www.theguardian.com/sport/nfl/rss',
  ],
  podcast: [
    'https://anchor.fm/s/10d8e4a8c/podcast/rss',
  ],
};

// ── Discord webhook URLs (set in .env) ─────────────────────────────────────
const WEBHOOKS = {
  nrl:     process.env.WEBHOOK_NRL,
  epl:     process.env.WEBHOOK_EPL,
  nba:     process.env.WEBHOOK_NBA,
  nfl:     process.env.WEBHOOK_NFL,
  podcast: process.env.WEBHOOK_PODCAST,
};

// ── Sport colours for Discord embed sidebars ───────────────────────────────
const COLORS = {
  nrl:     0x00F0FF, // cyan
  epl:     0x00A651, // green
  nba:     0xFF6B00, // orange
  nfl:     0x013369, // navy
  podcast: 0x1DB954, // Spotify green
};

// ── Sport display names ─────────────────────────────────────────────────────
const SPORT_NAMES = {
  nrl:     'NRL',
  epl:     'EPL',
  nba:     'NBA',
  nfl:     'NFL',
  podcast: 'Podcast',
};

// ── Keywords that flag an item as injury/team-news relevant ────────────────
const KEYWORDS = [
  'injur', 'injury', 'injured',
  'ruled out', 'ruled in',
  'out for', 'out with',
  'doubtful', 'questionable',
  'late mail', 'late change', 'late scratching',
  'team news', 'team list', 'team sheet',
  'lineup', 'line-up', 'line up',
  'starting xi', 'starting lineup',
  'confirmed xi',
  'hamstring', 'knee', 'ankle', 'shoulder', 'groin',
  'concussion', 'suspension', 'suspended', 'ban',
  'scratch', 'scratched', 'withdrawn',
  'dnp', 'did not practice', 'limited practice',
  'game-time decision', 'day-to-day',
  'surgery', 'hospital',
  'emergency', 'replacement',
  'price rise', 'price fall', 'price change',
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function isRelevant(title = '', snippet = '') {
  const text = `${title} ${snippet}`.toLowerCase();
  return KEYWORDS.some(kw => text.includes(kw));
}

function loadSeen() {
  try {
    return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

function pruneSeen(seen) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  return Object.fromEntries(
    Object.entries(seen).filter(([, ts]) => ts > cutoff)
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postToDiscord(webhookUrl, item, sport) {
  const embed = {
    title:       item.title?.slice(0, 256) || 'Team News Update',
    url:         item.link || undefined,
    description: (item.contentSnippet || item.summary || '').slice(0, 500) || undefined,
    color:       COLORS[sport],
    author: {
      name: sport === 'podcast'
        ? `🎙️ Such Is Fantasy — New Episode`
        : `📡 ${SPORT_NAMES[sport]} — Late Mail & Team News`,
    },
    footer: {
      text: item.creator
        ? `${item.creator} via ${item.feedTitle || 'RSS'}`
        : (item.feedTitle || 'RSS Feed'),
    },
    timestamp: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
  };

  // Remove undefined fields
  if (!embed.url)         delete embed.url;
  if (!embed.description) delete embed.description;

  const res = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ embeds: [embed], username: 'Such Is Fantasy Alert Bot' }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ── Main polling function ───────────────────────────────────────────────────
async function checkFeeds() {
  const seen = loadSeen();
  let posted = 0;
  let errors = 0;

  for (const [sport, urls] of Object.entries(FEEDS)) {
    const webhookUrl = WEBHOOKS[sport];

    if (!webhookUrl) {
      console.warn(`[${SPORT_NAMES[sport]}] WEBHOOK_${sport.toUpperCase()} not set — skipping`);
      continue;
    }

    for (const url of urls) {
      try {
        const feed = await parser.parseURL(url);
        const items = feed.items.slice(0, 15); // check latest 15

        for (const item of items) {
          const id = item.guid || item.link || item.title;
          if (!id) continue;

          // Already processed
          if (seen[id]) continue;

          // Mark seen regardless (avoids re-checking non-relevant items)
          seen[id] = Date.now();

          if (sport !== 'podcast' && !isRelevant(item.title, item.contentSnippet || item.summary)) continue;

          try {
            await postToDiscord(webhookUrl, { ...item, feedTitle: feed.title }, sport);
            posted++;
            console.log(`[${SPORT_NAMES[sport]}] ✓ Posted: ${item.title}`);
            await sleep(1500); // avoid Discord rate limit
          } catch (err) {
            errors++;
            console.error(`[${SPORT_NAMES[sport]}] ✗ Discord error: ${err.message}`);
          }
        }
      } catch (err) {
        // Don't count RSS parse errors as fatal — one feed can be down
        console.error(`[${SPORT_NAMES[sport]}] RSS error (${url}): ${err.message}`);
      }
    }
  }

  saveSeen(pruneSeen(seen));

  const time = new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney', hour12: false });
  console.log(`[${time} AEDT] Poll complete — ${posted} posted, ${errors} errors`);
}

// ── Boot ────────────────────────────────────────────────────────────────────
console.log('Such Is Fantasy Alert Bot starting...');
console.log(`Polling every ${INTERVAL / 60000} minutes`);
console.log(`Active sports: ${Object.keys(FEEDS).map(s => SPORT_NAMES[s]).join(', ')}\n`);

// Validate webhooks on startup
const missing = Object.keys(WEBHOOKS).filter(s => !WEBHOOKS[s]);
if (missing.length) {
  console.warn(`WARNING: Missing webhooks for: ${missing.map(s => SPORT_NAMES[s]).join(', ')}`);
  console.warn('These sports will be skipped. Check your .env file.\n');
}

// Run immediately, then poll on interval
checkFeeds().catch(console.error);
const timer = setInterval(() => checkFeeds().catch(console.error), INTERVAL);

// Graceful shutdown
process.on('SIGINT',  () => { clearInterval(timer); console.log('\nBot stopped.'); process.exit(0); });
process.on('SIGTERM', () => { clearInterval(timer); console.log('\nBot stopped.'); process.exit(0); });
