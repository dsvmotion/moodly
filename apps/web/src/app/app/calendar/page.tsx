import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@repo/ui/components/badge";
import { buttonVariants } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { ChevronLeftIcon, ChevronRightIcon } from "@repo/ui/lib/icons";
import { AppointmentTime } from "@/components/calendar/appointment-time";
import { requireUser } from "@/lib/auth/session";
import {
  calendarDays,
  calendarHref,
  DATE_PARAM,
  groupByDay,
  parseDate,
  parseView,
  stepDate,
  todayIn,
  VIEW_PARAM,
  type CalendarAppointment,
  type CalendarView,
} from "@/lib/calendar";
import { CALENDAR_LIMIT, loadCalendar } from "@/lib/calendar-data";
import { locationsInScope, SCOPE_PARAM } from "@/lib/scope";
import { resolveScope } from "@/lib/scope-data";
import { DEFAULT_TIME_ZONE, needsZoneLabel, zoneForLocation } from "@/lib/time-zone";

// La agenda (OA03, MANUAL §9.4 `/app/calendar`): las citas por día o por semana,
// de las sedes del alcance elegido, cada una en el día y la hora de su sede. Solo
// lectura en este incremento: reservar, mover y cancelar desde aquí vendrán
// después. Se lee con la sesión (RLS), nunca con la service role.

const BASE = "/app/calendar";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const params = await searchParams;
  const [t, format] = await Promise.all([getTranslations("calendarPage"), getFormatter()]);
  const { scope, context } = await resolveScope(params[SCOPE_PARAM]);

  const visible = [...locationsInScope(scope, context.locations)].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const view = parseView(first(params[VIEW_PARAM]));
  const date = parseDate(first(params[DATE_PARAM]), todayIn(zoneForLocation(null, scope, context.locations)));
  const days = calendarDays(view, date);
  const { rows, truncated } = await loadCalendar(scope, context, days);

  const zones = new Map(context.locations.map((location) => [location.id, location.timeZone]));
  const zoneOf = (locationId: string) => zones.get(locationId) ?? DEFAULT_TIME_ZONE;
  const byDay = groupByDay(rows, days, zoneOf);
  const alwaysShowZone = needsZoneLabel(context.locations);
  const showLocations = visible.length > 1;

  const query = new URLSearchParams();
  const scopeParam = first(params[SCOPE_PARAM]);
  if (scopeParam) query.set(SCOPE_PARAM, scopeParam);
  const href = (nextView: CalendarView, nextDate: string) => calendarHref(BASE, query, nextView, nextDate);
  const dayLabel = (day: string, style: "long" | "short") =>
    format.dateTime(new Date(`${day}T12:00:00.000Z`), {
      timeZone: "UTC",
      weekday: style,
      day: "numeric",
      month: style === "long" ? "long" : "short",
      ...(style === "long" ? { year: "numeric" } : {}),
    });
  const total = [...byDay.values()].reduce((sum, list) => sum + list.length, 0);
  const firstDay = days[0] ?? date;
  const lastDay = days[days.length - 1] ?? date;
  const rangeLabel = view === "day" ? dayLabel(date, "long") : `${dayLabel(firstDay, "short")} – ${dayLabel(lastDay, "short")}`;

  const toggle = (target: CalendarView) => (
    <Link
      href={href(target, date)}
      aria-current={view === target ? "page" : undefined}
      data-testid={`calendar-view-${target}`}
      className={buttonVariants({ variant: view === target ? "default" : "outline", size: "sm" })}
    >
      {t(target)}
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <span className="text-muted-foreground text-sm" data-testid="calendar-count">
            {t("count", { count: total })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("views")} className="flex gap-1">
          {toggle("day")}
          {toggle("week")}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={href(view, stepDate(view, date, -1))}
            aria-label={t(view === "week" ? "previousWeek" : "previousDay")}
            data-testid="calendar-previous"
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Link>
          <Link
            href={href(view, todayIn(zoneForLocation(null, scope, context.locations)))}
            data-testid="calendar-today"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("today")}
          </Link>
          <Link
            href={href(view, stepDate(view, date, 1))}
            aria-label={t(view === "week" ? "nextWeek" : "nextDay")}
            data-testid="calendar-next"
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        </div>
        <h2 className="text-sm font-medium first-letter:uppercase" data-testid="calendar-range">
          {rangeLabel}
        </h2>
      </div>

      {total === 0 ? (
        <EmptyState data-testid="calendar-empty" title={t("emptyTitle")} description={t("empty")} />
      ) : (
        <ol className="flex flex-col gap-4" data-testid="calendar-days">
          {days.map((day) => {
            const list = byDay.get(day) ?? [];
            if (view === "week" && list.length === 0) return null;
            return (
              <li key={day} data-testid="calendar-day" data-date={day} className="flex flex-col gap-2">
                {view === "week" ? <h3 className="text-sm font-medium first-letter:uppercase">{dayLabel(day, "long")}</h3> : null}
                {list.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("emptyDay")}</p>
                ) : showLocations ? (
                  visible
                    .filter((location) => list.some((a) => a.locationId === location.id))
                    .map((location) => (
                      <section key={location.id} data-testid="calendar-location" data-location={location.id} className="flex flex-col gap-1">
                        <h4 className="text-muted-foreground text-xs font-medium">{location.name}</h4>
                        <AppointmentList
                          items={list.filter((a) => a.locationId === location.id)}
                          zoneOf={zoneOf}
                          alwaysShowZone={alwaysShowZone}
                          t={t}
                        />
                      </section>
                    ))
                ) : (
                  <AppointmentList items={list} zoneOf={zoneOf} alwaysShowZone={alwaysShowZone} t={t} />
                )}
              </li>
            );
          })}
        </ol>
      )}
      {truncated ? (
        <p className="text-muted-foreground text-sm" data-testid="calendar-truncated">
          {t("truncated", { count: CALENDAR_LIMIT })}
        </p>
      ) : null}
    </div>
  );
}

function AppointmentList({
  items,
  zoneOf,
  alwaysShowZone,
  t,
}: {
  items: CalendarAppointment[];
  zoneOf: (locationId: string) => string;
  alwaysShowZone: boolean;
  t: Awaited<ReturnType<typeof getTranslations<"calendarPage">>>;
}) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {items.map((a) => (
        <li
          key={a.id}
          data-testid="appointment"
          data-appointment={a.id}
          data-status={a.status}
          className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="text-sm font-medium sm:w-40 sm:shrink-0">
            <AppointmentTime startsAt={a.startsAt} endsAt={a.endsAt} timeZone={zoneOf(a.locationId)} alwaysShowZone={alwaysShowZone} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={`text-sm break-words ${a.status === "cancelled" ? "text-muted-foreground line-through" : ""}`} data-testid="appointment-contact">
              {a.contact ?? t("unknownContact")}
            </span>
            <span className="text-muted-foreground text-xs break-words">
              <span data-testid="appointment-service">{a.service ?? t("unknownService")}</span>
              {" · "}
              <span data-testid="appointment-resource">{a.resource ? t("with", { resource: a.resource }) : t("unknownResource")}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant={a.status === "booked" ? "outline" : "muted"} data-testid="appointment-status">
              {t(`status.${a.status}`)}
            </Badge>
            <Badge data-testid="appointment-origin" data-origin={a.bookedBy}>
              {t(`origin.${a.bookedBy}`)}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
