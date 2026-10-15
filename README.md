# TubeScope — free, open-source vidIQ alternative

YouTube analytics, SEO and earnings intelligence that runs 100% in the browser. No account, no paywall, no tracking.

**Live:** https://0050piyush.github.io/tubescope/

## What it does (paid-plan features, free)

| Tool | Page | What you get |
|---|---|---|
| Video Scorecard | `video.html` | SEO score (0–100) with fix checklist, engagement health, tags, hashtags, estimated lifetime ad revenue |
| Channel Audit | `channel.html` | Monetization likelihood verdict, estimated monthly + lifetime earnings, health score, upload consistency, top videos, top tags, content ideas |
| AI Daily Ideas | `ideas.html` | Personalized video ideas from your channel's top performers via free AI (or your own OpenAI-compatible key) |
| Keyword Research | `keywords.html` | Real YouTube autocomplete ideas, competition data per keyword, heuristic opportunity score |
| Trend Radar | `trends.html` | Niche velocity scan: rising videos + breakout phrases before they peak |
| Competitor Tracker | `tracker.html` | Watchlist with snapshot history, subs/views velocity, surging alerts, new-upload detection |
| My Channel | `mychannel.html` | Private analytics via Google OAuth (read-only): 28-day views, watch time, traffic sources, top videos |
| Trending Explorer | `trending.html` | Most-popular videos by country + category |
| Competitor Compare | `compare.html` | Two channels head-to-head with a verdict |
| Settings | `settings.html` | Free API key setup, key test, daily quota meter, custom AI endpoint |
| Browser extension | `extension/` | Chrome/Edge MV3 extension: one-click TubeScope analysis on any YouTube page (load unpacked) |

## How it works

- **Data source:** the official [YouTube Data API v3](https://developers.google.com/youtube/v3) (free tier: 10,000 units/day) using **your own key**, stored only in your browser's localStorage. Nothing is scraped; nothing violates YouTube's ToS.
- **Estimates engine:** all scoring and revenue math is client-side and open (`assets/app.js`):
  - `videoSeoScore()` — weighted metadata + engagement checklist
  - `monetizationVerdict()` — scores public YPP criteria (1,000-sub threshold, activity, kids-status, channel type). YouTube hides real monetization status, so this is always labeled an estimate.
  - `revenueRange()` — niche CPM table × country purchasing-power multiplier × 55% monetized-playback share
  - `channelHealthScore()`, `analyzeUploads()` — consistency, engagement, metadata completeness
- **Quota:** tracked live in the header; see Setup below for per-tool costs.

## Setup (2 minutes)

1. Create a project at [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Library → enable **YouTube Data API v3**
3. Credentials → Create Credentials → API key
4. Paste the key in TubeScope → Settings → Save. Done.

### My Channel Analytics (private stats, optional)

Same Cloud project, a few extra steps:

1. Enable the **YouTube Analytics API** in the API Library
2. OAuth consent screen → External → add scopes `youtube.readonly` + `yt-analytics.readonly` → add your Google account as a **test user**
3. Credentials → Create Credentials → OAuth client ID → Web application → Authorized JavaScript origins: `https://0050piyush.github.io`
4. Paste the client ID on the My Channel page → Connect with Google (read-only)

### Browser extension (optional)

`chrome://extensions` → Developer mode → Load unpacked → select the `extension/` folder. A TubeScope button then appears on every YouTube video/channel page.

## Quota costs

Video ~1 · channel audit ~4 · trending ~2 · compare ~8 · keyword scoring ~100/keyword · trend scan ~101 · tracker refresh ~2/channel. The free tier gives 10,000 units/day.

## Run locally

```bash
cd tubescope
python3 -m http.server 8080
# open http://localhost:8080
```

No build step. Static HTML/CSS/vanilla JS — deploy anywhere (GitHub Pages, Netlify, Hostinger).

## Honesty notes

- Monetization status and revenue are **estimates**. YouTube does not expose them publicly; TubeScope shows its reasoning for every verdict.
- Not affiliated with YouTube, Google, or vidIQ. "vidIQ alternative" describes feature parity, not endorsement.

## License

MIT — see [LICENSE](LICENSE).
