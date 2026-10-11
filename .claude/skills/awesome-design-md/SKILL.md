---
name: awesome-design-md
description: Use when the user wants a UI, landing page, app or report styled like a known brand or product ("like Stripe", "Linear style", "Apple look", "Notion feel") or asks for a distinct, consistent design system. Fetches the matching DESIGN.md (colors, typography, components, layout, do and don'ts) from the VoltAgent/awesome-design-md collection and builds to it.
---

# Awesome DESIGN.md

A DESIGN.md is a plain-text design system (visual theme, color roles, typography, components, layout, elevation, do's and don'ts, responsive behavior, agent prompt guide) extracted from a popular site. Source: https://github.com/VoltAgent/awesome-design-md (MIT). Each brand lives in `design-md/<slug>/DESIGN.md` with `preview.html` and `preview-dark.html`.

## When to use
- The user names a brand or product as the style reference.
- The user wants a coherent system and has no reference: propose 2 to 3 fitting brands from the index and pick one with a short reason.
- Combine with `design-taste-frontend` / `impeccable` for craft, and with `arabic-report-design` for documents.

## How to fetch
1. Pick the slug from the index below.
2. **Preferred:** attach the repo read-only with `add_repo` (owner `VoltAgent`, repo `awesome-design-md`), clone it into the scratchpad, and read `design-md/<slug>/DESIGN.md` in full.
3. **Fallback:** `WebFetch https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<slug>/DESIGN.md` and ask for the color tokens, typography, and component rules verbatim (use `offset` to read the rest). The file is also hosted at https://getdesign.md.
4. Save the chosen file as `DESIGN.md` in the work folder (do not commit it to a public repo's root unless asked) and build against its tokens.

## How to apply
- Use the file's color roles, type scale, spacing, radii and component rules as the source of truth; do not mix two brands.
- **Arabic or RTL output:** keep the brand's palette, spacing and component feel, but set the typeface to Cairo (brand fonts rarely cover Arabic) and mirror the layout.
- This is inspiration, not impersonation: never reuse logos, brand names, trademarks or copy, and never make a page that passes as the real brand.
- Before finishing, check the result against the file's "do's and don'ts" and verify visually with Playwright or by rendering the PDF pages.

## Index (slug)
airbnb, airtable, apple, binance, bmw, bmw-m, bugatti, cal, claude, clay, clickhouse, cohere, coinbase, composio, cursor, dell-1996, elevenlabs, expo, ferrari, figma, framer, hashicorp, hp, ibm, intercom, kraken, lamborghini, linear.app, lovable, mastercard, meta, minimax, mintlify, miro, mistral.ai, mongodb, nike, nintendo-2001, notion, nvidia, ollama, opencode.ai, pinterest, playstation, posthog, raycast, renault, replicate, resend, revolut, runwayml, sanity, sentry, shopify, slack, spacex, spotify, starbucks, stripe, supabase, superhuman, tesla, theverge, together.ai, uber, vercel, vodafone, voltagent, warp, webflow, wired, wise, x.ai, zapier

Quick picks: calm editorial or docs (notion, mintlify, claude), dark developer tool (linear.app, vercel, raycast, warp), fintech trust (stripe, wise, revolut), premium consumer (apple, spotify, airbnb), playful creative (figma, framer, webflow).
