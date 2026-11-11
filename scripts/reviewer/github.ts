// Lo que la Revisora lee y escribe en GitHub, por la API REST y sin
// dependencias. Lee el PR como datos; nunca hace checkout de su código.

import type { PastReview } from "./delta.ts";

export interface GitHubClient {
  get(path: string, accept?: string): Promise<Response>;
  post(path: string, body: unknown): Promise<Response>;
}

export function client(token: string, fetchImpl: typeof fetch = fetch): GitHubClient {
  const headers = (accept: string) => ({
    authorization: `Bearer ${token}`,
    accept,
    "x-github-api-version": "2022-11-28",
    "user-agent": "revisora",
  });
  return {
    get: (path, accept = "application/vnd.github+json") => fetchImpl(`https://api.github.com${path}`, { headers: headers(accept) }),
    post: (path, body) =>
      fetchImpl(`https://api.github.com${path}`, {
        method: "POST",
        headers: { ...headers("application/vnd.github+json"), "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}

async function ok(response: Response, what: string): Promise<Response> {
  if (!response.ok) throw new Error(`GitHub respondió ${response.status} al pedir ${what}`);
  return response;
}

export interface PullRequest {
  number: number;
  title: string;
  draft: boolean;
  state: string;
  head: { sha: string };
  base: { ref: string; sha: string };
}

export async function getPull(gh: GitHubClient, repo: string, n: number): Promise<PullRequest> {
  return (await (await ok(await gh.get(`/repos/${repo}/pulls/${n}`), "el PR")).json()) as PullRequest;
}

/** Las rutas del PR; en los renombrados, también la de antes. Hasta 3.000 archivos (el tope de la API). */
export async function getFiles(gh: GitHubClient, repo: string, n: number): Promise<{ files: string[]; complete: boolean }> {
  const files: string[] = [];
  for (let page = 1; page <= 30; page++) {
    const items = (await (await ok(await gh.get(`/repos/${repo}/pulls/${n}/files?per_page=100&page=${page}`), "los archivos")).json()) as {
      filename: string;
      previous_filename?: string;
    }[];
    for (const item of items) {
      files.push(item.filename);
      if (item.previous_filename) files.push(item.previous_filename);
    }
    if (items.length < 100) return { files, complete: true };
  }
  return { files, complete: false };
}

/** El diff del PR entero, o null si GitHub no lo da (PR demasiado grande). */
export async function getPullDiff(gh: GitHubClient, repo: string, n: number): Promise<string | null> {
  const response = await gh.get(`/repos/${repo}/pulls/${n}`, "application/vnd.github.v3.diff");
  return response.ok ? response.text() : null;
}

export async function getCompareStatus(gh: GitHubClient, repo: string, since: string, head: string): Promise<string | null> {
  const response = await gh.get(`/repos/${repo}/compare/${since}...${head}?per_page=1`);
  if (!response.ok) return null;
  return ((await response.json()) as { status?: string }).status ?? null;
}

export async function getCompareDiff(gh: GitHubClient, repo: string, since: string, head: string): Promise<string | null> {
  const response = await gh.get(`/repos/${repo}/compare/${since}...${head}`, "application/vnd.github.v3.diff");
  return response.ok ? response.text() : null;
}

export async function getReviews(gh: GitHubClient, repo: string, n: number): Promise<PastReview[]> {
  const all: PastReview[] = [];
  for (let page = 1; page <= 10; page++) {
    const items = (await (await ok(await gh.get(`/repos/${repo}/pulls/${n}/reviews?per_page=100&page=${page}`), "las revisiones")).json()) as PastReview[];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

/** Un archivo del head del PR como texto (dato), o null si no existe. */
export async function getFileAt(gh: GitHubClient, repo: string, path: string, ref: string): Promise<string | null> {
  const response = await gh.get(`/repos/${repo}/contents/${path}?ref=${ref}`, "application/vnd.github.raw+json");
  return response.ok ? response.text() : null;
}

export async function postReview(
  gh: GitHubClient,
  repo: string,
  n: number,
  review: { commitId: string; event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"; body: string },
): Promise<void> {
  await ok(
    await gh.post(`/repos/${repo}/pulls/${n}/reviews`, { commit_id: review.commitId, event: review.event, body: review.body }),
    "publicar la revisión",
  );
}
