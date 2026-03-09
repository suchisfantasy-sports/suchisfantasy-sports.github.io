# SCPB RSS Injury Alert Bot — Setup Guide

Posts injury alerts and team news to your Discord `#late-mail-and-team-news` channels automatically.

---

## 1. Create a Discord Webhook for each sport

Do this once per sport channel (NRL, EPL, NBA, NFL).

1. Open Discord → go to the `#late-mail-and-team-news` channel for a sport
2. Click the gear icon (Edit Channel) → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Name it `Such Is Fantasy Alert Bot` (optional: set avatar)
5. Click **Copy Webhook URL**
6. Paste it into your `.env` file (see step 2)

Repeat for all four sport channels.

---

## 2. Create your .env file

In the `rss-bot/` folder, copy the example file:

```
cp .env.example .env
```

Then open `.env` and paste each webhook URL:

```
WEBHOOK_NRL=https://discord.com/api/webhooks/...
WEBHOOK_EPL=https://discord.com/api/webhooks/...
WEBHOOK_NBA=https://discord.com/api/webhooks/...
WEBHOOK_NFL=https://discord.com/api/webhooks/...
```

---

## 3. Install and run

Make sure Node.js 18+ is installed, then:

```bash
cd rss-bot
npm install
npm start
```

The bot will:
- Run immediately on startup
- Poll RSS feeds every **10 minutes**
- Post only injury/team-news items (filtered by keyword)
- Skip items already seen (tracked in `seen.json`)
- Auto-prune seen items older than 7 days

---

## 4. Keep it running (optional)

To keep the bot running after you close the terminal, install `pm2`:

```bash
npm install -g pm2
pm2 start bot.js --name scpb-bot
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

To check logs: `pm2 logs scpb-bot`
To stop: `pm2 stop scpb-bot`

---

## RSS Sources

| Sport | Sources |
|-------|---------|
| NRL   | Fox Sports AU, SMH Sport, NRL.com |
| EPL   | BBC Sport, Sky Sports, The Guardian |
| NBA   | ESPN, BBC Sport, The Guardian |
| NFL   | ESPN, BBC Sport, The Guardian |

If a feed goes down, the bot skips it and tries the next source. Add or swap URLs in the `FEEDS` object in `bot.js`.

---

## Keyword Filtering

The bot only posts items containing words like:
`injury, ruled out, doubtful, late mail, team news, lineup, hamstring, suspension, scratched, price rise` etc.

Full list is in the `KEYWORDS` array in `bot.js` — add sport-specific terms as needed.
