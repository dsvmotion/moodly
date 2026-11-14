"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { formatClock } from "@/lib/calendar";

/**
 * La hora de una cita, de inicio a fin, en la zona de su sede (M-08). La zona va
 * al lado cuando la organización tiene más de una (`alwaysShowZone`) o cuando el
 * dispositivo de quien mira está en otra; como LocalTime, el servidor no sabe la
 * del dispositivo y la añade el navegador al hidratar.
 */
export function AppointmentTime({
  startsAt,
  endsAt,
  timeZone,
  alwaysShowZone,
}: {
  startsAt: string;
  endsAt: string;
  timeZone: string;
  alwaysShowZone: boolean;
}) {
  const locale = useLocale();
  const deviceZone = useSyncExternalStore(noSubscription, readDeviceZone, () => null);
  const withZone = alwaysShowZone || (deviceZone !== null && deviceZone !== timeZone);
  return (
    <time dateTime={startsAt} title={timeZone} data-testid="appointment-time" className="tabular-nums">
      {formatClock(startsAt, { locale, timeZone, withZone: false })}–{formatClock(endsAt, { locale, timeZone, withZone })}
    </time>
  );
}

function noSubscription(): () => void {
  return () => {};
}

function readDeviceZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
