# Chess Champs

Next.js + Supabase.

## Run locally
1. Copy `.env.example` to `.env.local` and fill in `SUPABASE_SERVICE_ROLE_KEY`.
2. `npm install && npm run dev`

## Deploy to Vercel
1. Push this folder to a GitHub repo and import it at vercel.com/new (or run `npx vercel` in this folder).
2. Add the three variables from `.env.example` in Project Settings > Environment Variables.
3. In Supabase > Authentication > URL Configuration, set Site URL to your Vercel domain and add
   `https://YOUR-DOMAIN/auth/callback` under Redirect URLs.
4. Keep "Confirm email" enabled in Supabase. The admin button relies on a verified email.
