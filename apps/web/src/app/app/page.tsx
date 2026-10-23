import { redirect } from "next/navigation";

// La pantalla de inicio (P1, MANUAL §9.4) llega con la tarea 4. Mientras
// tanto /app lleva a "Mi organización".
export default function AppHome() {
  redirect("/app/ajustes/general");
}
