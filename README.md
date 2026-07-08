# The Ledger

A personal golf stat tracker. Log each hole in a few taps, find the leaks in your game, and know what to practice.

Built by Aaron Galloway.

## Live app

Once deployed via GitHub Pages, the app lives at:
`https://<your-github-username>.github.io/the-ledger/`

Open that URL on your phone, then Share → Add to Home Screen to install it as a real web app. All your data lives on your device — nothing leaves your browser.

## Features

- Log tee shot, approach, sand, chip, putts, and score for each hole
- 9-hole or 18-hole rounds, tracked honestly (no fake extrapolation)
- Handicap index using WHS math with a PROVISIONAL label until you've logged 20 rounds
- Traceable stats — tap any stat row to see which holes fed it, highlighted on the scorecard
- By-club performance (fairway % by club off the tee, GIR % by club on approach)
- Configurable bag — name your clubs however you want
- Export / import your data as a JSON file for backup
- iOS-style light and dark modes

## Local development

```
npm install
npm run dev
```

## Deploy

Push to `main`. GitHub Actions builds and deploys to Pages automatically. First-time setup:

1. Repo Settings → Pages → Source: **GitHub Actions**.
2. Push to `main`. The workflow runs and publishes.

## Notes

- If you rename the repo, update `base` in `vite.config.js` to match the new name.
- Your rounds live in the browser's `localStorage` under key `yardage-book-v1`. Clearing browser data will wipe them, so use Export from time to time.
