This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deployed Frontend Commit Hash

This app exposes the currently deployed frontend commit hash via:

`GET /api/version`

Example response:

```json
{
  "commitHash": "7c47cf65f0b8d8fef5b2fa56f76840e01ea1e87d",
  "shortCommitHash": "7c47cf6"
}
```

It resolves the hash from these environment variables (first one found):

1. `GIT_COMMIT_SHA`
2. `VERCEL_GIT_COMMIT_SHA`
3. `NEXT_PUBLIC_GIT_COMMIT_SHA`

For Docker builds, pass `GIT_COMMIT_SHA` as a build arg:

```powershell
docker build --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD) -t minetracker-frontend .
```
