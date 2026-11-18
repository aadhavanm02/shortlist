# Shortlist

A personal job hunting app for two people (Aadhavan and Gayathri). It finds up to 20 matching jobs a day, tailors your resume to each job with free AI, and downloads a one-page PDF.

Resumes and preferences are saved only on the device you use. API keys live in a small Cloudflare Worker (`worker/`), so nobody has to enter a key in the app, and keys never appear in this repo or in the site's code.

## First-time setup (each person)

1. Open the app and pick your profile.
2. Upload your resume PDF (the app reads it with 1 AI request), or use **Load it instead** with your `shortlist-<name>.json` starter file.
3. Pick job titles, cities, work type, experience range and salary, then **Save and find my jobs**.

## Backend (Cloudflare Worker)

The Worker at `https://shortlist-api.aadhavanm8.workers.dev` adds the keys and forwards requests to Gemini, Groq, JSearch and Adzuna. It only answers requests from the GitHub Pages site and localhost.

```bash
cd worker
npx wrangler deploy                      # deploy changes to worker/src/index.js
npx wrangler secret put GEMINI_KEY       # replace a key (also GROQ_KEY, RAPIDAPI_KEY, ADZUNA_ID, ADZUNA_KEY)
```

Both people share these keys, so free limits are shared too. The default daily limits in Settings are split between you.

## Android app

Download **[Shortlist.apk](https://github.com/aadhavanm02/shortlist/releases/download/android-latest/Shortlist.apk)** on the phone, open it, and allow installing from that source when Android asks. Every push to `main` builds a new APK at the same link (`.github/workflows/android.yml`).

- The app is the same web app wrapped with Capacitor (`android/`, `capacitor.config.json`).
- PDFs save to Documents/Shortlist and open the share sheet (Files, Drive, WhatsApp, Gmail).
- A reminder notification arrives at 7 AM each day.
- Updates install over the old app only when every APK is signed with the same key, stored as the repo secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS`. Without them each build uses a temporary key, so you would have to uninstall first, which clears the app's saved data.
- Icons and splash come from `assets/` (`npx @capacitor/assets generate --android`).

## Daily use

- Jobs are fetched the first time you open the app each day. **Refresh** fetches again (uses job search quota).
- Open a job → **Tailor resume to this job** → accept or reject suggestions → **Download PDF** → tell the app if you applied.
- **Refine with chat**: put all your changes in one message. Up to 20 refinements per job.
- Click any line in the resume to edit it yourself. Manual edits never use AI.

## Free limits (shared, per day)

| What | Model | Limit used by the app |
|---|---|---|
| Tailoring (first pass per job) | Gemini Flash | 10 each |
| Refinements, trims, resume import | Gemini Flash-Lite | 200 each, 20 per job |
| Backup | Groq gpt-oss-120b | about 40 |

Limits come from the providers and can change. If a model name stops working, change it in Settings → Limits and models.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`. In the repo, set **Settings → Pages → Source** to **GitHub Actions** once.

## Notes

- JSearch's free plan is 200 requests a month, shared. Each daily fetch uses one request per city (plus one for remote).
- Adzuna only gives a preview of each description. The job page lets you paste the full description for better tailoring.
- Jobs from the last 3 days are fetched. Skipped jobs disappear after 7 days.
