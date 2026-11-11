import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { canManageGoal, goalsInScope, manageableTargets, targetValue } from "@/lib/goals";
import { scopeValue } from "@/lib/scope";
import { resolveScope } from "@/lib/scope-data";
import { loadGoals } from "./data";
import { GoalsView, type GoalViewRow } from "./goals-view";

// Objetivos del negocio (OA19, MANUAL §6.3 y §9.4): qué quiere conseguir la
// organización, con qué métrica, para cuándo y dónde. Los ve todo el equipo de
// su alcance; los gestionan el org_admin (con el segundo factor), el
// region_manager en sus regiones y el location_manager en sus locales. RLS lo
// exige igual: la pantalla solo ofrece lo que se podrá guardar.

const STATUS_ORDER = ["active", "paused", "achieved", "missed", "archived"];

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ scope?: string | string[] }> }) {
  await requireUser();
  const t = await getTranslations("goalsPage");
  const { scope, context } = await resolveScope((await searchParams).scope);
  const aal2 = (await getSessionAal()) === "aal2";
  const targets = manageableTargets({
    role: context.role,
    aal2,
    organization: context.organization,
    regions: context.regions,
    locations: context.locations,
  });

  const regionNames = new Map(context.regions.map((region) => [region.id, region.name]));
  const locationNames = new Map(context.locations.map((location) => [location.id, location.name]));
  const rows: GoalViewRow[] = goalsInScope(await loadGoals(context), scope, context.locations)
    .map((goal) => ({
      ...goal,
      // null: toda la organización (el texto lo pone la vista).
      appliesTo: goal.scope === "organization" ? null : ((goal.scope === "region" ? regionNames : locationNames).get(goal.scopeId) ?? null),
      canManage: canManageGoal(goal, targets),
    }))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.title.localeCompare(b.title, "es"));

  // Al crear, se propone el alcance elegido en el selector si la persona lo gestiona.
  const selected = scopeValue(scope).replace(/^all$/, `organization:${context.organization?.id ?? ""}`);
  const defaultTarget = targets.some((target) => targetValue(target) === selected) ? selected : targets[0] ? targetValue(targets[0]) : "";
  const needsMfa = context.role === "org_admin" && !aal2;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {needsMfa ? (
        <p role="note" data-testid="mfa-required" className="rounded-md border p-3 text-sm">
          {t("mfaRequired")}{" "}
          <Link href="/app/settings/security" className="underline">
            {t("mfaLink")}
          </Link>
        </p>
      ) : null}
      <GoalsView rows={rows} targets={targets} defaultTarget={defaultTarget} />
    </div>
  );
}
