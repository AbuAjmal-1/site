# CJCP Dark

Link board with voting and admin control, backed by Netlify Blobs and serverless functions (no external backend).

## Deploy on Netlify

1. Connect this repo to Netlify (or drag-and-drop the folder).
2. Set **Environment variable** in Netlify:
   - **Key:** `ADMIN_KEY`
   - **Value:** your secret admin key (e.g. a strong password). Anyone who knows this key can update links via "Developer access".
3. Deploy. Netlify will install dependencies and expose:
   - `/.netlify/functions/getLinks` — read links
   - `/.netlify/functions/vote` — up/down vote (rate-limited by IP)
   - `/.netlify/functions/adminUpdate` — update links (requires correct `ADMIN_KEY`)

No `netlify.toml` is required; default function paths are used.

## Local dev

```bash
npm install
npx netlify dev
```

Set `ADMIN_KEY` in a `.env` file or in Netlify UI for local env.
