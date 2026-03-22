# Such Is Fantasy Alert Bot — Reference Guide

---

## First-Time Setup

### Step 1 — Create Discord Webhooks (once per sport)

Do this 4 times — once each for NRL, EPL, NBA, NFL.

1. Open Discord → go to the `#late-mail-and-team-news` channel for that sport
2. Click the **gear icon** next to the channel name → **Integrations** → **Webhooks**
3. Click **New Webhook** → name it `Such Is Fantasy Alert Bot`
4. Click **Copy Webhook URL** → paste it somewhere temporarily (Notepad)
5. Repeat for all 4 sports

---

### Step 2 — Create your .env file

1. Go to: `C:\Users\katie\Desktop\such-is-fantasy\rss-bot\`
2. Copy `.env.example` → rename the copy to `.env` (remove `.example`)
3. Open `.env` with Notepad and paste your webhook URLs:

```
WEBHOOK_NRL=https://discord.com/api/webhooks/...
WEBHOOK_EPL=https://discord.com/api/webhooks/...
WEBHOOK_NBA=https://discord.com/api/webhooks/...
WEBHOOK_NFL=https://discord.com/api/webhooks/...
```

4. Save and close

> **Common mistake:** Windows may save it as `.env.txt` — make sure the file is named exactly `.env` with no extension.

---

### Step 3 — Install Node.js (if not already installed)

Check in Command Prompt:
```
node --version
```
If you see version 18 or higher, skip this. Otherwise download from **nodejs.org** and install.

---

### Step 4 — Run the bot (first time)

Open Command Prompt and run:
```
cd C:\Users\katie\Desktop\such-is-fantasy\rss-bot
npm install
npm start
```

---

## Running Without Keeping Command Prompt Open (pm2)

### Install pm2 (one-time):
```
npm install -g pm2
```

### Start the bot with pm2:
```
cd C:\Users\katie\Desktop\such-is-fantasy\rss-bot
pm2 start bot.js --name such-is-fantasy-bot
pm2 save
```

### Auto-start on PC reboot:
```
pm2 startup
```
Copy and run the command it prints.

---

## Daily pm2 Commands

| Command | What it does |
|---|---|
| `pm2 status` | Check if bot is running |
| `pm2 logs such-is-fantasy-bot` | See what the bot is posting |
| `pm2 stop such-is-fantasy-bot` | Stop the bot |
| `pm2 restart such-is-fantasy-bot` | Restart (e.g. after editing bot.js) |

---

## How the Bot Works

- Polls RSS feeds every **10 minutes**
- Filters by injury/team news keywords (injury, ruled out, doubtful, late mail, etc.)
- Posts colour-coded Discord embeds to each sport channel
- Skips items already seen — nothing posts twice
- Auto-prunes seen items older than 7 days

### RSS Sources

| Sport | Sources |
|---|---|
| NRL | Fox Sports AU, SMH Sport, NRL.com |
| EPL | BBC Sport, Sky Sports, The Guardian |
| NBA | ESPN, BBC Sport, The Guardian |
| NFL | ESPN, BBC Sport, The Guardian |

---

## Key File Locations

| File | Purpose |
|---|---|
| `rss-bot/bot.js` | Main bot code |
| `rss-bot/.env` | Your Discord webhook URLs (keep private) |
| `rss-bot/seen.json` | Cache of already-posted items (auto-managed) |
| `rss-bot/SETUP.md` | Full setup guide |

---

## Changing the Bot Name in Discord

The bot posts under the name **Such Is Fantasy Alert Bot** — this is set in `bot.js` line 137.

To rename it, open `bot.js` and find:
```
username: 'Such Is Fantasy Alert Bot'
```
Change the name there and restart the bot with `pm2 restart such-is-fantasy-bot`.
