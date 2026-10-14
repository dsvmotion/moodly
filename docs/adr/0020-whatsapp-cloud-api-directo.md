# 0020 — WhatsApp por Cloud API directo de Meta (sin BSP intermediario en el piloto)

- **Estado:** aceptado
- **Fecha:** 2026-10-14
- **Secciones del MANUAL afectadas:** §7.2 y §8 (canal WhatsApp, BSP [ABIERTO] → cerrado para el piloto)

## Contexto

El canal WhatsApp estaba marcado como **[ABIERTO]** respecto a qué BSP usar (360dialog, Twilio,
Cloud API directo). Producto pidió "lo más seguro y escalable" y se inclinó por **WhatsApp
directo**.

## Decisión

El piloto usa la **Cloud API oficial de Meta directamente**, sin BSP intermediario. El prototipo
`/plataforma/conectar` ya asume este flujo (número + verificación de Meta + plantillas en
revisión).

## Alternativas consideradas

- **360dialog (BSP UE)** — tarifa plana y residencia UE del tráfico de mensajería; se reevalúa
  si un cliente exige residencia UE del canal o soporte de BSP.
- **Twilio** — buena fiabilidad pero *markup* por mensaje sobre el precio de Meta.

## Consecuencias

- Integración directa contra Meta: alta del número, opt-in, verificación de firma en webhooks y
  plantillas aprobadas por Meta (ventana de 24 h).
- Si más adelante se necesita residencia UE del canal, soporte gestionado o escala multi-número,
  se reabre con un BSP; la interfaz interna de canal (`packages/channels`) lo aísla.

## Verificación

- Prototipo `/plataforma/conectar` (PR #19), revisado en navegador: elegir canal → conectar
  (número + Meta, con error/reintento) → plantillas en revisión/aprobadas.
