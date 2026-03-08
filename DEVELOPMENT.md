# MealMap Development Guide

## First-time setup

Install Vercel CLI and link the project:
```bash
npm install -g vercel
npx vercel link
```

Pull environment variables from Vercel:
```bash
npx vercel env pull .env.local
```

This creates `.env.local` with all production env vars. It is gitignored and safe.

---

## Running locally

```bash
npx vercel dev
```

- Runs the frontend (Vite) + `api/handler.ts` serverless function together
- Uses `.env.local` automatically
- Open `http://localhost:3000`

This is the closest thing to production. Use this instead of `npm run dev` when testing API changes.

---

## Making changes

### Frontend only (client/src/)
Just edit and save — Vite hot-reloads instantly in `vercel dev`.

### API changes (api/handler.ts or api/_lib/)
Save the file — `vercel dev` restarts the function automatically.

### Database schema changes (shared/schema.ts)
After editing the schema, push changes to Supabase:
```bash
npm run db:push
```

---

## Previewing before deploying

Create a preview deployment (does not affect production):
```bash
npx vercel
```

Vercel gives you a unique preview URL like:
`https://mealmap-abc123-zachfuchs-2767s-projects.vercel.app`

Share this URL to test or review before going live.

---

## Deploying to production

**Step 1 — Commit your changes:**
```bash
git add -A
git commit -m "your message here"
git push origin main
```

Vercel automatically deploys on every push to `main`. Wait ~1 minute and check vercel.com for the deployment status.

**Or deploy manually:**
```bash
npx vercel --prod
```

---

## Updating environment variables

If you need to add or change an env var:

1. Update it in **Vercel dashboard → Settings → Environment Variables**
2. Update your local `.env.local` to match
3. Redeploy: `npx vercel --prod`

Never commit `.env` or `.env.local` — both are gitignored.

---

## Checking logs

View live function logs:
```bash
npx vercel logs https://your-app.vercel.app
```

Or go to **vercel.com → your project → deployment → Functions → handler → Logs**.

---

## Database access

Open Supabase Studio (table editor, SQL editor):
- Go to **supabase.com → your project → Table Editor**

Run raw SQL:
- Go to **supabase.com → your project → SQL Editor**
