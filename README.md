# Faculty Leave Ledger — Web App

This is a real, standalone web application (built with React + Vite) connected to your
Supabase database. Deploy it and you'll get a public URL like
`https://faculty-leave-tracker.vercel.app` that anyone can visit.

## Deploy it in ~10 minutes (no coding required)

### Step 1: Put this code on GitHub
1. Go to https://github.com and sign up (free) if you don't have an account.
2. Click the **+** icon (top right) → **New repository**.
3. Name it `faculty-leave-tracker`, keep it Public, click **Create repository**.
4. On the new repo page, click **uploading an existing file**.
5. Drag in ALL the files/folders from this project (package.json, vite.config.js,
   index.html, and the whole `src` folder).
6. Scroll down, click **Commit changes**.

### Step 2: Deploy on Vercel (free hosting)
1. Go to https://vercel.com and sign up using your GitHub account.
2. Click **Add New... → Project**.
3. Select your `faculty-leave-tracker` repo and click **Import**.
4. Vercel auto-detects it's a Vite app — just click **Deploy**.
5. Wait ~1 minute. You'll get a live URL — that's your real website.

### That's it
Every time you (or I, via updated files) push new code to GitHub, Vercel
automatically redeploys the live site.

## Notes
- The Supabase URL and public key are already in `src/App.jsx` — that's expected
  and safe (the "publishable" key is designed to be public in frontend code).
- Your data lives in Supabase, not in this code, so it's already a real, persistent
  system — this step is just about giving it a proper public web address.
- Currently your database's security policies allow anyone with the keys to read/write
  data directly. Fine while testing; ask me to help lock this down with real
  authentication before real staff start using it.
