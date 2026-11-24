import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// La clave de API de una integración nativa (ADR 0055) solo existe en claro en
// memoria: en la Server Action que la cifra, en el worker que la abre y la
// comprueba, y en el cliente de Koibox que la usa. Este test falla si en esos
// archivos un log, un evento de seguridad o un error lleva el valor (o algo de
// lo que se puede sacar: el sobre cifrado, la clave de datos, la privada).
//
// Se revisan las llamadas a logger.*/log.*/ctx.logger.*, securityEvent y
// logSecurityEvent, y los `new …Error(…)`: ningún argumento puede nombrar
// esas variables ni tener propiedades con esos nombres.

const ROOT = join(import.meta.dirname, "..", "..", "..");

const DENIED_IDENTIFIERS = new Set([
  "submittedKey",
  "apiKey",
  "plaintext",
  "sealed",
  "sealedSecret",
  "ciphertext",
  "encryptedDataKey",
  "dataKey",
  "privateKeyPem",
  "ingressPrivatePem",
]);
const DENIED_PROPERTY = /^(api_?key|key|secret|plaintext|ciphertext|encrypted_?data_?key|private_?key(_?pem)?|value)$/i;
const LOG_METHODS = new Set(["info", "warn", "error", "debug", "trace", "fatal"]);

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.(test|e2e|integration)\.tsx?$/.test(entry) ? [path] : [];
  });
}

function isLogCall(call: ts.CallExpression): boolean {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text === "securityEvent" || callee.text === "logSecurityEvent";
  if (ts.isPropertyAccessExpression(callee) && LOG_METHODS.has(callee.name.text)) {
    const target = callee.expression;
    const name = ts.isIdentifier(target) ? target.text : ts.isPropertyAccessExpression(target) ? target.name.text : "";
    return /^(log|logger)$/i.test(name);
  }
  return false;
}

function isErrorConstruction(node: ts.NewExpression): boolean {
  return ts.isIdentifier(node.expression) && /Error$/.test(node.expression.text);
}

/** Lo que nombra un argumento: variables y nombres de propiedades. */
function offences(arg: ts.Node): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && DENIED_IDENTIFIERS.has(node.text)) {
      // `x.apiKey` (una propiedad leída) también cuenta; un nombre de propiedad de un literal, abajo.
      found.push(node.text);
    } else if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && ts.isIdentifier(node.name)) {
      if (DENIED_PROPERTY.test(node.name.text)) found.push(`${node.name.text}:`);
    } else if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && DENIED_PROPERTY.test(node.name.text)) {
      found.push(`${node.name.text}:`);
    }
    ts.forEachChild(node, visit);
  };
  visit(arg);
  return found;
}

export function checkSource(path: string, text: string): { calls: number; problems: string[] } {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let calls = 0;
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    const args = ts.isCallExpression(node) && isLogCall(node) ? node.arguments : ts.isNewExpression(node) && isErrorConstruction(node) ? node.arguments : null;
    if (args) {
      calls += 1;
      for (const arg of args) {
        for (const what of offences(arg)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          problems.push(`${path}:${line + 1} ${what}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { calls, problems };
}

// Los archivos que tocan la clave en claro: los que usan el sobre
// (@repo/integrations/key-ingress) o el flujo de la web (key-flow), el propio
// sobre y el cliente de Koibox.
const files = [join(ROOT, "apps", "web", "src"), join(ROOT, "apps", "worker", "src"), join(ROOT, "packages", "integrations", "src")]
  .flatMap(sourceFiles)
  .map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }))
  .filter(
    ({ path, text }) =>
      text.includes("@repo/integrations/key-ingress") ||
      text.includes("@/lib/integrations/key-flow") ||
      path.startsWith("packages/integrations/src/key-ingress/") ||
      path.startsWith("packages/integrations/src/booking/koibox/"),
  );

describe("ningún log, evento ni error lleva la clave de una integración (ADR 0055)", () => {
  it("revisa los archivos que tocan la clave en claro (web, worker y el cliente de Koibox)", () => {
    const paths = files.map(({ path }) => path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "apps/web/src/app/app/settings/integrations/key-actions.ts",
        "apps/web/src/lib/integrations/key-flow.ts",
        "apps/worker/src/integrations/key-submission.ts",
        "packages/integrations/src/key-ingress/sealed-key.ts",
        "packages/integrations/src/booking/koibox/client.ts",
      ]),
    );
    // Y en ellos hay logs, eventos y errores que revisar: el test no está vacío.
    expect(files.reduce((sum, { path, text }) => sum + checkSource(path, text).calls, 0)).toBeGreaterThan(10);
  });

  it("ninguno nombra la clave, el sobre ni la privada", () => {
    const problems = files.flatMap(({ path, text }) => checkSource(path, text).problems);
    expect(problems).toEqual([]);
  });

  it("y el detector los encontraría (prueba en negativo)", () => {
    const bad = [
      `securityEvent("integration.key_submitted", { userId, apiKey });`,
      `logger.info({ submittedKey }, "x");`,
      `ctx.logger.warn({ value: input }, "x");`,
      `log.error({ "api_key": k }, "x");`,
      `throw new SubmissionRejectedError(\`no vale: \${plaintext}\`);`,
      `logger.info({ key: sealed.ciphertext }, "x");`,
    ];
    for (const snippet of bad) expect(checkSource("bad.ts", snippet).problems, snippet).not.toEqual([]);
    expect(checkSource("ok.ts", `securityEvent("integration.key_submitted", { userId, organizationId, provider });`).problems).toEqual([]);
  });
});
