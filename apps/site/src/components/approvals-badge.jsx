"use client";
import { useSede } from "@/components/use-sede";
import { approvalsCount } from "@/components/sede-data";

// Número de aprobaciones pendientes de la sede activa (barra inferior móvil).
export default function ApprovalsBadge() {
  const { sede } = useSede();
  return <>{approvalsCount(sede)}</>;
}
