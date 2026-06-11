// Ingest a Dr. Gundry article (VSL/listicle) engagement event.
// The article fires: page_view, section_view, section_exit, scroll_depth,
// cta_click, video_play/progress/end, exit. We map its scroll sections to an
// ordinal "funnel" so the GetGrounded dashboard renders read-depth + drop-off.
import { sessions, jsonResponse, handlePreflight, geoFromContext, shortenUA, shortenReferrer, now } from './_common.js';

// Article scroll sections in reading order (ordinal 1 = top of page).
const SCREEN_ORDER = [
  'landing','hero','author','confession','statin_truth','suppression','discovery',
  'other_supplements','results','gallery','cases','videos','scarcity','cta'
];
const TOTAL_SCREENS = SCREEN_ORDER.length;
function screenOrdinal(v) {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v !== 'string') return null;
  const idx = SCREEN_ORDER.indexOf(v);
  return idx >= 0 ? (idx + 1) : null;
}

export default async (req, context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  let payload;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'bad json' }, 400); }

  const { session_id, type } = payload || {};
  if (!session_id || !type) return jsonResponse({ error: 'session_id+type required' }, 400);

  const store = sessions();
  let s;
  try {
    s = await store.get(session_id, { type: 'json' });
  } catch {
    s = null;
  }

  const ts = now();
  if (!s) {
    const geo = geoFromContext(context);
    /* Capture every session regardless of country. The dashboard can still segment
       by country, but no traffic should be silently dropped. */
    s = {
      id: session_id,
      started: ts,
      last_seen: ts,
      completed_at: null,
      abandoned_at: null,
      deepest_screen: 1,
      branch: null,
      answers: {},
      screen_times: {},  // screen_id -> first arrival ts
      events: [],
      country: geo.country,
      city: geo.city,
      region: geo.region,
      timezone: geo.timezone,
      referrer: shortenReferrer(payload.referrer || req.headers.get('referer')),
      ua: shortenUA(req.headers.get('user-agent'))
    };
  }

  s.last_seen = ts;

  // Record a "screen" (= scroll section) arrival.
  function reachScreen(screenVal) {
    const ord = screenOrdinal(screenVal);
    if (ord === null) return;
    if (ord > s.deepest_screen) s.deepest_screen = ord;
    if (!s.screen_times[ord]) s.screen_times[ord] = ts;
    s.screen_path = s.screen_path || [];
    if (s.screen_path[s.screen_path.length - 1] !== ord) s.screen_path.push(ord);
    if (s.screen_path.length > 50) s.screen_path = s.screen_path.slice(-50);
  }

  // Apply event
  switch (type) {
    case 'page_view':
      reachScreen('landing');
      break;
    case 'screen_view':       // (accepted for parity)
      reachScreen(payload.screen);
      break;
    case 'section_view':
      reachScreen(payload.section);
      break;
    case 'cta_click':
      // A CTA click is the article's conversion event.
      if (!s.completed_at) s.completed_at = ts;
      break;
    case 'scroll_depth':
      if (typeof payload.scroll_pct === 'number') {
        s.max_scroll_pct = Math.max(s.max_scroll_pct || 0, payload.scroll_pct);
      }
      break;
    case 'complete':
      s.completed_at = ts;
      s.deepest_screen = Math.max(s.deepest_screen, TOTAL_SCREENS);
      break;
    case 'exit':
    case 'abandon':
      if (!s.completed_at) s.abandoned_at = ts;
      break;
    // section_exit, video_play/progress/end fall through → just logged + last_seen
  }

  // Keep event log bounded (last 60 events per session)
  s.events.push({
    ts, type,
    screen: payload.screen ?? payload.section ?? null,
    cta_id: payload.cta_id ?? null,
    scroll_pct: payload.scroll_pct ?? null,
    video_id: payload.video_id ?? null,
    label: payload.label ?? null
  });
  if (s.events.length > 60) s.events = s.events.slice(-60);

  await store.set(session_id, JSON.stringify(s));
  return jsonResponse({ ok: true });
};
