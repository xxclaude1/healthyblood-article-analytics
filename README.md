# Healthy Blood — Article Analytics Dashboard

Live dashboard: **https://healthyblood-article-analytics.netlify.app/**

A real-time engagement dashboard for the Dr. Gundry "Healthy Blood" article/VSL
(same design as the GetGrounded analytics dashboard, adapted for an article).

## What it shows
- **Page views**, live readers, and conversion rate (views → CTA click)
- **Read-depth funnel** across all 14 page sections (Page Load → Hero → Author →
  Statin Truth → … → Scarcity → Buy CTA) with section-by-section drop-off
- **Bottleneck detector** — where readers stop scrolling
- **CTA engagement** — which button gets clicked (Top / Bottom / Sticky)
- Average time on page, live reader list, device / referrer / geo
- Click any session to replay its scroll journey · **CSV export**

## How it's wired
The article at **https://drgundrysecrets-article.netlify.app/** (repo:
`drgundrysecrets-article`) already fires events for page view, each scroll section,
scroll depth, and CTA clicks. It now sends them to this site's `track` function.
Data is stored in **Netlify Blobs** — no database, no monthly cost.

```
article  ──events──▶  /.netlify/functions/track  ──▶  Netlify Blobs
dashboard  ◀──json──  /.netlify/functions/stats  ◀──┘
```

## Deploy / update
Hosted on Netlify (account: xxclaude1). To redeploy after changes:

```bash
npm install
netlify deploy --prod --dir .
```

Or connect this GitHub repo to the Netlify site for automatic deploys on push.

## Files
- `index.html` — the dashboard UI
- `netlify/functions/track.js` — receives article events (maps scroll sections to a funnel)
- `netlify/functions/stats.js` — aggregates the read-depth funnel + CTA data
- `netlify/functions/download.js` — CSV export
- `netlify/functions/heartbeat.js` — live-reader presence ping
