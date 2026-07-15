# ReportCraft

A premium Monthly Student Performance Report generator: dashboard, school setup,
student management (with CSV/XLSX import), a split-screen report builder with
five distinct themes, and a template manager.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Deploy (get a real public link)

**Option A — Vercel / Netlify, no terminal needed**
1. Push this folder to a new GitHub repository.
2. Go to vercel.com or netlify.com, sign in with GitHub, "Import Project," pick this repo.
3. Build command: `npm run build` — Output directory: `dist`
4. Deploy. You'll get a live `https://your-app.vercel.app` URL.

**Option B — Netlify Drop, even faster, no GitHub needed**
```bash
npm install
npm run build
```
Then drag the generated `dist/` folder onto https://app.netlify.com/drop — it deploys instantly and gives you a link.

## About data storage

This build saves all data (school config, students, reports, templates) to the
browser's `localStorage`, so it works out of the box once deployed — but data
stays on one browser/device only, and clearing browser data erases it.

For a real multi-staff school deployment, replace the two functions
`storageGet` / `storageSet` near the top of `src/App.jsx` with calls to a
backend (Supabase or Firebase are the fastest to set up). Every other part of
the app already reads/writes through those two functions, so that's the only
place that needs to change.

## Notes on scope

- Rich text sections use a lightweight `contentEditable` toolbar, not a full
  WYSIWYG engine.
- Section reordering uses native HTML5 drag-and-drop plus up/down buttons.
- PDF export isn't wired up yet — the cleanest path is `react-to-print` for a
  client-side "Print to PDF," or server-side rendering with Puppeteer if you
  want fully automated PDF generation/emailing.
