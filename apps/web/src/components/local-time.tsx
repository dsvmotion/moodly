"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { formatLocalTime } from "@/lib/time-zone";

/**
 * Una fecha y hora en la zona de su local (auditoría de preproducción, M-08).
 * La zona se escribe al lado cuando la organización tiene más de una
 * (`alwaysShowZone`) o cuando el dispositivo de quien mira está en otra zona.
 * El servidor no sabe la zona del dispositivo: la mira el navegador al hidratar
 * (`useSyncExternalStore`, con null en el servidor), así que lo pintado en el
 * servidor y en el cliente coincide y después se añade la zona si hace falta.
 */
export function LocalTime({
  iso,
  timeZone,
  alwaysShowZone,
  ...props
}: {
  iso: string;
  timeZone: string;
  alwaysShowZone: boolean;
  "data-testid"?: string;
}) {
  const locale = useLocale();
  const deviceZone = useSyncExternalStore(noSubscription, readDeviceZone, () => null);
  const withZone = alwaysShowZone || (deviceZone !== null && deviceZone !== timeZone);
  return (
    <time dateTime={iso} title={timeZone} {...props}>
      {formatLocalTime(iso, { locale, timeZone, withZone })}
    </time>
  );
}

// La zona del dispositivo no cambia mientras se mira la página: nada a lo que suscribirse.
function noSubscription(): () => void {
  return () => {};
}

function readDeviceZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
