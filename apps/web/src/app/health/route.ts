import { checkHealth } from "../../lib/health";

// Sin sesión ni datos de organizaciones: lo llaman la alerta de staging y los
// sondeos de disponibilidad. El proxy no la intercepta (proxy.ts, matcher).
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { httpStatus, body } = await checkHealth();
  return Response.json(body, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}
