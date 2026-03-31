# GitHub Pages Deployment

This UI can deploy as a static site through GitHub Pages.

## What Is Configured

- Vite uses a relative build base for production bundles, so the app can live under the repository Pages path.
- GitHub Actions workflow: [`deploy-pages.yml`](/Users/alexhan/Documents/Alex_dev/Retirement%20Calculator/.github/workflows/deploy-pages.yml)
- Validation before deploy:
  - `npm run typecheck`
  - `npm run smoke:golden`
  - `npm run build:ui`

## One-Time GitHub Setup

1. Open repository settings.
2. Go to `Pages`.
3. Under build and deployment, choose `GitHub Actions`.

## Expected URL

For this repository, the Pages URL should be:

- `https://goodvibes833.github.io/canadian-retirement-calculator/`

## Local Deployment Check

Run:

```bash
npm run build:deploy
```

That reproduces the same validation chain used before the Pages artifact is uploaded.
