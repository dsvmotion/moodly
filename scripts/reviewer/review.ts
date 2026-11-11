// La Revisora automática (SE01, órdenes de M0 §5). Uso, desde la raíz de la rama base:
//   node scripts/reviewer/review.ts
// Variables: GH_TOKEN (token de la App, creado en el job), GH_REPO, PR_NUMBER,
// BOT_LOGIN (`<app-slug>[bot]`), REVIEWER_AI_GATEWAY_API_KEY (solo niveles 1 y 2)
// y, en Actions, GITHUB_STEP_SUMMARY.

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addedDone, fixedChecks, type CheckResult } from "./checks.ts";
import { LEVEL1_CAN_APPROVE, MAX_DIFF_CHARS, modelForLevel, type Level } from "./config.ts";
import { lastReview, marker, planDelta, restrictToPrFiles, splitDiff } from "./delta.ts";
import { complete, costEur, withinBudget, type Usage } from "./gateway.ts";
import * as github from "./github.ts";
import { classify, parseSensitivePatterns } from "./levels.ts";
import { buildMessages } from "./prompt.ts";
import { decide, parseModelOutput, type Decision, type ModelOutput } from "./verdict.ts";

export interface Deps {
  gh: github.GitHubClient;
  repo: string;
  pr: number;
  botLogin: string;
  apiKey: string | null;
  /** La raíz de la rama base: de ahí salen la lista de la guarda, la rúbrica y las reglas. */
  root: string;
  /** Corre scripts/merge-guard/check-sensitive.sh de la rama base. */
  runGuard: (files: readonly string[], diff: string) => { exit: number; output: string };
  callModel: typeof complete;
  log: (line: string) => void;
}

export interface Outcome {
  posted: boolean;
  level: Level | null;
  decision: Decision | null;
  model: string | null;
  usage: Usage | null;
  costEur: number | null;
  note: string;
}

function renderBody(input: {
  level: Level;
  decision: Decision;
  checks: readonly CheckResult[];
  model: ModelOutput | null;
  modelId: string | null;
  since: string | null;
  notes: readonly string[];
  head: string;
}): string {
  const lines = [
    `### Revisora · nivel ${input.level}${input.modelId ? ` · ${input.modelId}` : " · sin modelo"}`,
    "",
    `**Decisión:** ${input.decision.event} — ${input.decision.why}.`,
    input.since ? `Revisado lo nuevo desde \`${input.since.slice(0, 7)}\`.` : "Revisado el PR entero.",
    "",
    "**Comprobaciones fijas**",
    ...input.checks.map((check) => `- ${check.ok ? "✅" : "❌"} ${check.name}: ${check.detail.replaceAll("\n", "; ")}`),
  ];
  if (input.model) {
    lines.push("", `**Hallazgos del modelo** (${input.model.findings.length})`);
    if (input.model.findings.length === 0) lines.push("- Ninguno.");
    for (const f of input.model.findings) {
      lines.push(`- **${f.severity}** \`${f.file}${f.line ? `:${f.line}` : ""}\`: ${f.evidence.replaceAll("\n", " ")}`);
    }
  }
  if (input.notes.length > 0) lines.push("", ...input.notes.map((note) => `> ${note}`));
  if (input.level === 2) lines.push("", "Zona sensible: hace falta el veredicto de una sesión Revisora y el visto bueno de producto.");
  lines.push("", marker(input.head, input.level));
  return lines.join("\n");
}

export async function run(deps: Deps): Promise<Outcome> {
  const none = (note: string): Outcome => ({ posted: false, level: null, decision: null, model: null, usage: null, costEur: null, note });
  const pull = await github.getPull(deps.gh, deps.repo, deps.pr);
  if (pull.state !== "open") return none("el PR no está abierto");
  if (pull.draft) return none("el PR es un borrador: la Revisora no revisa borradores");
  if (pull.base.ref !== "main") return none(`el PR va contra ${pull.base.ref}: la Revisora solo revisa PRs contra main`);
  const head = pull.head.sha;

  // Si ya revisó este mismo commit, no repite.
  const reviews = await github.getReviews(deps.gh, deps.repo, deps.pr);
  const last = lastReview(reviews, deps.botLogin);
  const since = last?.sha ?? null;
  const compareStatus = since && since !== head ? await github.getCompareStatus(deps.gh, deps.repo, since, head) : null;
  const plan = planDelta({ since, head, compareStatus, lastState: last?.state ?? null });
  if (plan.kind === "nothing-new") return none(`nada nuevo desde ${head.slice(0, 7)}`);

  const notes: string[] = [];
  const { files, complete: allFiles } = await github.getFiles(deps.gh, deps.repo, deps.pr);
  const sensitive = parseSensitivePatterns(readFileSync(join(deps.root, "scripts/merge-guard/sensitive-paths.txt"), "utf8"));
  const classification = classify(files, sensitive);
  let level = classification.level;
  if (!allFiles) {
    level = 2;
    notes.push("El PR tiene más archivos de los que da la API: se trata como zona sensible.");
  }

  const fullDiff = await github.getPullDiff(deps.gh, deps.repo, deps.pr);
  const guard = fullDiff === null ? { exit: 2, output: "" } : deps.runGuard(files, fullDiff);
  const scopeYaml = await github.getFileAt(deps.gh, deps.repo, "docs/scope.yaml", head);
  const checks = fixedChecks({ title: pull.title, guardExit: guard.exit, guardOutput: guard.output, scopeYaml });

  let modelOutput: ModelOutput | null = null;
  let modelId: string | null = null;
  let usage: Usage | null = null;
  let cost: number | null = null;
  let reviewedSince: string | null = null;

  if (level !== 0) {
    const model = modelForLevel(level);
    modelId = model.id;
    let diff = fullDiff;
    if (plan.kind === "delta") {
      const compareDiff = await github.getCompareDiff(deps.gh, deps.repo, plan.since, head);
      if (compareDiff !== null) {
        diff = restrictToPrFiles(compareDiff, files);
        reviewedSince = plan.since;
      } else {
        notes.push("No se pudo calcular lo nuevo desde la última revisión: se revisa el PR entero.");
      }
    }
    if (diff === null) {
      notes.push("GitHub no da el diff de este PR (demasiado grande): no se manda al modelo.");
    } else if (diff.length > MAX_DIFF_CHARS) {
      notes.push(`El diff tiene ${diff.length} caracteres, más del tope de ${MAX_DIFF_CHARS}: no se manda al modelo.`);
    } else if (!deps.apiKey) {
      notes.push("Sin clave del gateway en el job: no se llama al modelo.");
    } else {
      const messages = buildMessages({ dir: join(deps.root, "scripts/reviewer"), title: pull.title, level, files, diff, since: reviewedSince });
      if (!withinBudget(messages, model)) {
        notes.push("La revisión pasaría del tope de 0,50 €: no se llama al modelo.");
      } else {
        try {
          const completion = await deps.callModel({ apiKey: deps.apiKey, model, messages });
          usage = completion.usage;
          cost = costEur(completion.usage, model);
          modelOutput = parseModelOutput(completion.text);
          if (!modelOutput) notes.push(`La respuesta del modelo no tiene la forma de la rúbrica (fin: ${completion.finishReason ?? "?"}): no se aprueba.`);
        } catch (error) {
          notes.push(`No se pudo llamar al modelo: ${(error as Error).message}.`);
        }
      }
    }
  }

  const newDone = fullDiff === null ? [] : addedDone(splitDiff(fullDiff).get("docs/scope.yaml") ?? "");
  const decision = decide({ level, checks, model: modelOutput, level1CanApprove: LEVEL1_CAN_APPROVE, newDone });
  const body = renderBody({ level, decision, checks, model: modelOutput, modelId, since: reviewedSince, notes, head });
  await github.postReview(deps.gh, deps.repo, deps.pr, { commitId: head, event: decision.event, body });
  deps.log(`nivel ${level} (${classification.reasons.slice(0, 5).join(", ")}): ${decision.event}`);
  return { posted: true, level, decision, model: modelId, usage, costEur: cost, note: notes.join(" ") };
}

function guardRunner(root: string) {
  return (files: readonly string[], diff: string) => {
    const dir = mkdtempSync(join(tmpdir(), "revisora-"));
    writeFileSync(join(dir, "files.txt"), `${files.join("\n")}\n`);
    writeFileSync(join(dir, "diff.patch"), diff);
    try {
      const output = execFileSync("bash", [join(root, "scripts/merge-guard/check-sensitive.sh"), join(dir, "files.txt"), join(dir, "diff.patch")], {
        encoding: "utf8",
        // Un PR grande lista muchas rutas sensibles; con el tope por defecto (1 MB) la guarda saldría como fallida.
        maxBuffer: 64 * 1024 * 1024,
        timeout: 300_000,
      });
      return { exit: 0, output };
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      return { exit: failure.status ?? 2, output: failure.stdout ?? "" };
    }
  };
}

function summary(outcome: Outcome): string {
  const usage = outcome.usage;
  return [
    "### Revisora",
    "",
    "| Nivel | Decisión | Modelo | Entrada | De caché | Salida | Coste estimado |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    `| ${outcome.level ?? "-"} | ${outcome.decision?.event ?? "sin revisión"} | ${outcome.model ?? "-"} | ${usage?.inputTokens ?? 0} | ${usage?.cachedInputTokens ?? 0} | ${usage?.outputTokens ?? 0} | ${outcome.costEur === null ? "-" : `${outcome.costEur.toFixed(4)} €`} |`,
    "",
    outcome.note,
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const env = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`Falta la variable ${name}`);
    return value;
  };
  const pr = Number(env("PR_NUMBER"));
  if (!Number.isInteger(pr) || pr <= 0) throw new Error("PR_NUMBER no es un número de PR");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const outcome = await run({
    gh: github.client(env("GH_TOKEN")),
    repo: env("GH_REPO"),
    pr,
    botLogin: env("BOT_LOGIN"),
    apiKey: process.env.REVIEWER_AI_GATEWAY_API_KEY || null,
    root,
    runGuard: guardRunner(root),
    callModel: complete,
    log: (line) => console.log(line),
  });
  console.log(outcome.posted ? `revisión publicada: ${outcome.decision?.event}` : `sin revisión: ${outcome.note}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(outcome));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(`La Revisora falló: ${(error as Error).message}`);
    process.exit(1);
  });
}
