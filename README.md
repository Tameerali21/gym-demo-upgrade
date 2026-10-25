# Gym / Fitness Coaching Demo — "Never Miss a Customer" Fleet

Live interactive demo website for a fictional online fitness coaching business,
**VoltHaus Performance Coaching** (Raleigh, NC), with the fleet-standard **Kai** AI
coaching coordinator widget. Runs 100% client-side — no network calls, no tracking,
works straight from `file://` or any static host. Bookings and leads are simulated
and stored only in the browser's `localStorage`.

**Personalization target:** Sam Hessey — *Hessey Performance* / *QuotaFit Code*.
Delivered link:
`?biz=Hessey%20Performance&tagline=QuotaFit%20Code` on the live URL
(plus `city`, `phone`, `addr`, `services`, `hours` as needed).

## The five flows (all live in the chat widget)

1. **Programmes & pricing Q&A** — 1:1 coaching $249/mo, 12-Week Signature Programme
   $599, Hybrid $349/mo, Small-Group (max 6) $149/mo, Nutrition Check-Ins add-on
   $79/mo, Competition Prep $449/mo. All numbers are clearly-labelled **demo prices**;
   plus honest answers on results (no guarantees) and injuries (coaches, not doctors).
2. **Free discovery-call booking** — goal chips (Fat Loss / Build Muscle / Athletic
   Performance / General Fitness / Nutrition Coaching) → name → phone or Skip
   (`digits.length < 7` rejects "notaphone") → day → time → confirmation card with
   a `VP-XXXXX` booking reference (prefix derives from business-name initials) and
   a tap-to-call link.
3. **After-hours lead capture** — "It's 11:42 PM" notice: name → phone → goal,
   saved to the demo dataset and mirrored in the **Captured leads inbox** panel.
4. **Review routing** — 5★ → Google review button, 1–4★ → private feedback that is
   persisted to the inbox as a private note (never a fake public review).
5. **60-sec training quiz** (added 2026-10-25, salon pattern) — 🧲 chip or "quiz":
   fitness goal → programme interest → timeline → name (2–40 chars) → phone
   (`digits.length < 7` rejects "notaphone") → "✅ Quiz complete!" training-profile
   card (Goal/Programme/Timeline) + lead saved to the inbox as
   "Training quiz — qualified lead" (source: training quiz). Kai promises a
   personalized training-plan recommendation only — no invented results,
   guarantees, before/afters, or prices beyond the page's labelled demo prices.
   Router audit 2026-10-25: no gym router keyword starts with "qui", so the chip
   value "quiz" can never be hijacked, and "quiz" hijacks no existing branch.

## Honesty standard

- The fictional default business was verified not to exist as a real business in
  the chosen city (name + city web search, 2026-10-21).
- No invented client reviews, testimonials, or result numbers anywhere on the page.
- The page, chat, chat header, and the tap-to-call CTA all follow `?biz=&tagline=&city=&phone=&addr=&services=&hours=`
  personalization, so a real prospect's own business can step into the demo
  end-to-end — including the phone number the CTA dials.

## Files

- `index.html` — VoltHaus site + widget markup
- `assets/widget.js` — Kai's brain (router, 5 flows, leads → localStorage, `window.__maya` test hooks)
- `assets/style.css` — charcoal + volt-green fleet palette
- `og-preview.jpg` — 1200×630 link-share card

Palette: charcoal + volt green (distinct from fleet siblings). AI coordinator: **Kai**.
Verified with the fleet puppeteer harness: `demo-deploy-zips/gym-verify-2026-10-21.js`
(FULL run 2026-10-21: source dir + extracted zip, then live-URL verification).
