import type { ReactNode } from "react";
import { BrandLogo } from "./brand-logo";

/**
 * Marco de las pantallas de acceso (login y segundo factor; auditoría del
 * frontend, F-7): logotipo, una tarjeta centrada y una nota al pie. Fuera del
 * app shell: aquí aún no hay sesión completa.
 */
export function AuthShell({ title, description, children, footer }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <BrandLogo className="mx-auto h-6 w-[94px] bg-foreground" />
        <div className="flex flex-col gap-6 rounded-xl border bg-background p-6 shadow-panel sm:p-8">
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="text-xl font-semibold">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {children}
        </div>
        {footer ? <div className="text-center text-xs text-muted-foreground">{footer}</div> : null}
      </div>
    </main>
  );
}
