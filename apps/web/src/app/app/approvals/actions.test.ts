import { beforeEach, describe, expect, it, vi } from "vitest";

// decideApproval lee la aprobación antes de aprobar (reserva pasada, OA02, y
// corrección de una respuesta). Si esa lectura falla o no devuelve la fila, la
// acción no aprueba: falla cerrada (hallazgo de la Revisora en #313).

const read = vi.fn();
const update = vi.fn();

vi.mock("server-only", () => ({}));
// Vitest no resuelve el alias `@/`: los módulos puros reales, por su ruta.
vi.mock("@/lib/approval-input", () => import("../../../lib/approval-input"));
vi.mock("@/lib/validation", () => import("../../../lib/validation"));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("@/lib/observability/logger", () => ({ securityEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: read }) }),
      update: (values: unknown) => {
        update(values);
        return {
          eq: () => ({
            eq: () => ({
              select: async () => ({ data: [{ organization_id: "org-1", effect_class: "external_message" }], error: null }),
            }),
          }),
        };
      },
    }),
  })),
}));

const { decideApproval } = await import("./actions");

const ID = "3f6c1d2e-8a4b-4c5d-9e6f-7a8b9c0d1e2f";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("decideApproval: la lectura previa falla cerrada", () => {
  beforeEach(() => {
    read.mockReset();
    update.mockReset();
  });

  it("si la lectura de la aprobación da error, no aprueba", async () => {
    read.mockResolvedValue({ data: null, error: { code: "57014", message: "canceling statement" } });
    const result = await decideApproval({ error: null }, form({ id: ID, decision: "approved" }));
    expect(result).toEqual({ error: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("si la lectura no devuelve la fila, no aprueba", async () => {
    read.mockResolvedValue({ data: null, error: null });
    const result = await decideApproval({ error: null }, form({ id: ID, decision: "approved" }));
    expect(result).toEqual({ error: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("con un texto corregido y la lectura con error, tampoco aprueba", async () => {
    read.mockResolvedValue({ data: null, error: { code: "57014", message: "canceling statement" } });
    const result = await decideApproval({ error: null }, form({ id: ID, decision: "approved", text: "Hola" }));
    expect(result).toEqual({ error: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("con la lectura correcta, aprueba (control del doble)", async () => {
    read.mockResolvedValue({ data: { execution: { skill_key: "otra.skill", input: {} } }, error: null });
    const result = await decideApproval({ error: null }, form({ id: ID, decision: "approved" }));
    expect(result).toEqual({ error: null });
    expect(update).toHaveBeenCalledWith({ status: "approved" });
  });
});
