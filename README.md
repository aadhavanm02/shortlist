# Shortlist

A personal job hunting app for two people (Aadhavan and Gayathri). It finds up to 20 matching jobs a day, tailors your resume to each job with free AI, and downloads a one-page PDF.

Everything runs in your browser. Resumes, preferences and keys are saved only on the device you use. Nothing is stored in this repo or on a server.

## First-time setup (about 10 minutes per person)

1. Open the app and pick your profile.
2. **Gemini key (required).** Go to [Google AI Studio](https://aistudio.google.com/app/apikey), sign in, click **Create API key**, and paste it into onboarding.
3. **Resume.** Upload your resume PDF. The app reads it into text (uses 1 AI request). If you have a `shortlist-<name>.json` starter file, use **Load it instead**.
4. Pick job titles, cities, work type, experience range and salary, then **Save and find my jobs**.
5. **Job search keys** (Settings → Keys). Add at least one:
   - **JSearch** (recommended): sign up at [RapidAPI JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch), subscribe to the free Basic plan, copy your `X-RapidAPI-Key`. Covers LinkedIn, Indeed, Glassdoor and company pages through Google for Jobs.
   - **Adzuna**: register at [developer.adzuna.com](https://developer.adzuna.com/), copy the App ID and App Key.
6. **Groq key (optional backup):** [console.groq.com/keys](https://console.groq.com/keys).

## Daily use

- Jobs are fetched the first time you open the app each day. **Refresh** fetches again (uses job search quota).
- Open a job → **Tailor resume to this job** → accept or reject suggestions → **Download PDF** → tell the app if you applied.
- **Refine with chat**: put all your changes in one message. Up to 20 refinements per job.
- Click any line in the resume to edit it yourself. Manual edits never use AI.

## Free limits (per person, per day)

| What | Model | Limit used by the app |
|---|---|---|
| Tailoring (first pass per job) | Gemini Flash | 20 |
| Refinements, trims, resume import | Gemini Flash-Lite | 400 total, 20 per job |
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

- Some job sources may block requests from browsers (CORS). If one source keeps failing, the app shows it at the top of the job list and uses the other source.
- Adzuna only gives a preview of each description. The job page lets you paste the full description for better tailoring.
- Jobs from the last 3 days are fetched. Skipped jobs disappear after 7 days.
