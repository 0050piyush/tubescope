# TubeScope — free, open-source vidIQ alternative

YouTube analytics, SEO and earnings intelligence that runs 100% in the browser. No account, no paywall, no tracking.

**Live:** https://0050piyush.github.io/tubescope/

## What it does (paid-plan features, free)

| Tool | Page | What you get |
|---|---|---|
| Video Scorecard | `video.html` | SEO score (0–100) with fix checklist, engagement health, tags, hashtags, estimated lifetime ad revenue |
| Channel Audit | `channel.html` | Monetization likelihood verdict, estimated monthly + lifetime earnings, health score, upload consistency, top videos, top tags, content ideas |
| Keyword Research | `keywords.html` | Real YouTube autocomplete ideas, competition data per keyword, heuristic opportunity score |
| Trending Explorer | `trending.html` | Most-popular videos by country + category |
| Competitor Compare | `compare.html` | Two channels head-to-head with a verdict |
| Settings | `settings.html` | Free API key setup, key test, daily quota meter |

## How it works

- **Data source:** the official [YouTube Data API v3](https://developers.google.com/youtube/v3) (free tier: 10,000 units/day) using **your own key**, stored only in your browser's localStorage. Nothing is scraped; nothing violates YouTube's ToS.
- **Estimates engine:** all scoring and revenue math is client-side and open (`assets/app.js`):
  - `videoSeoScore()` — weighted metadata + engagement checklist
  - `monetizationVerdict()` — scores public YPP criteria (1,000-sub threshold, activity, kids-status, channel type). YouTube hides real monetization status, so this is always labeled an estimate.
  - `revenueRange()` — niche CPM table × country purchasing-power multiplier × 55% monetized-playback share
  - `channelHealthScore()`, `analyzeUploads()` — consistency, engagement, metadata completeness
- **Quota costs:** video ~1 unit · channel audit ~4 · trending ~2 · compare ~8 · keyword scoring ~100/keyword · captions check 50. A quota meter in the header tracks daily usage.

## Setup (2 minutes)

1. Create a project at [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Library → enable **YouTube Data API v3**
3. Credentials → Create Credentials → API key
4. Paste the key in TubeScope → Settings → Save. Done.

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
