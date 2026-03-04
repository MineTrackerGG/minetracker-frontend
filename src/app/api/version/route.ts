import { NextResponse } from "next/server";

function getCommitHash(): string {
  return (
    process.env.GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ??
    "unknown"
  );
}

export async function GET() {
  const commitHash = getCommitHash();

  return NextResponse.json({
    commitHash,
    shortCommitHash: commitHash === "unknown" ? "unknown" : commitHash.slice(0, 7),
  });
}
