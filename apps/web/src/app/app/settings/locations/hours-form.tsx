"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { DAYS, readOpeningHours, type BusinessFormState, type Day } from "@/lib/business-setup/schema";
import { saveOpeningHours } from "./actions";

// El horario de un local, día a día (OA04): cerrado, o de una hora a otra. Es
// lo que leen los huecos de las reservas (find_booking_slots).

const initial: BusinessFormState = { error: null, savedAt: null };

export function OpeningHoursForm({ locationId, openingHours }: { locationId: string; openingHours: unknown }) {
  const t = useTranslations("servicesPage");
  const tDays = useTranslations("records.days");
  const [state, action, pending] = useActionState(saveOpeningHours, initial);
  const [days, setDays] = useState(() => readOpeningHours(openingHours));
  // Controlados: React vacía los campos sin controlar al terminar la acción, y volverían al horario de antes.
  const change = (day: Day, value: Partial<{ open: boolean; from: string; to: string }>) =>
    setDays((current) => ({ ...current, [day]: { ...current[day], ...value } }));

  return (
    <form action={action} className="flex flex-col gap-3" data-testid="hours-form">
      <input type="hidden" name="locationId" value={locationId} />
      <fieldset className="flex flex-col gap-2" disabled={pending}>
        <legend className="mb-1 text-sm font-medium">{t("hoursTitle")}</legend>
        {DAYS.map((day) => (
          <div key={day} className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm" data-testid={`hours-${day}`}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name={`${day}.open`}
                checked={days[day].open}
                onChange={(event) => change(day, { open: event.target.checked })}
                className="size-4"
                data-testid={`hours-${day}-open`}
              />
              {tDays(day)}
            </label>
            {days[day].open ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  name={`${day}.from`}
                  required
                  step={900}
                  value={days[day].from}
                  onChange={(event) => change(day, { from: event.target.value })}
                  aria-label={t("opensAt", { day: tDays(day) })}
                  data-testid={`hours-${day}-from`}
                />
                <span aria-hidden>–</span>
                <Input
                  type="time"
                  name={`${day}.to`}
                  required
                  step={900}
                  value={days[day].to}
                  onChange={(event) => change(day, { to: event.target.value })}
                  aria-label={t("closesAt", { day: tDays(day) })}
                  data-testid={`hours-${day}-to`}
                />
              </div>
            ) : (
              <span className="text-muted-foreground">{t("closed")}</span>
            )}
          </div>
        ))}
      </fieldset>
      <p className="text-muted-foreground text-xs">{t("hoursHelp")}</p>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm" data-testid="business-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        {state.savedAt && !pending && !state.error ? (
          <span role="status" className="text-muted-foreground text-sm" data-testid="business-saved">
            {t("saved")}
          </span>
        ) : null}
        <Button type="submit" disabled={pending} data-testid="hours-save">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
