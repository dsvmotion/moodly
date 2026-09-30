import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/app-frame";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { requireUser } from "@/lib/auth/session";
import { parseSidebarCollapsed, parseTheme, SIDEBAR_COOKIE, THEME_COOKIE } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// App shell (MANUAL §9.2). El layout pinta la estructura; la comprobación que
// protege los datos está en cada página (requireUser, cerca de los datos):
// según la guía de Next.js, los layouts no se vuelven a renderizar al navegar.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const cookieStore = await cookies();
  const supabase = await createClient();

  // Organizaciones que el usuario ve según RLS (hoy, una por usuario del seed).
  const { data: organizations } = await supabase.from("organizations").select("id, name").order("name");

  return (
    <AppFrame
      topbar={<AppTopbar />}
      sidebar={
        <AppSidebar
          userEmail={user.email ?? ""}
          signOutAction={signOut}
          theme={parseTheme(cookieStore.get(THEME_COOKIE)?.value)}
          defaultCollapsed={parseSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE)?.value)}
          header={
            <div data-testid="org-name" className="truncate px-2 py-1.5 text-sm font-semibold">
              {organizations?.map((organization) => organization.name).join(" · ")}
            </div>
          }
        />
      }
    >
      {children}
    </AppFrame>
  );
}
