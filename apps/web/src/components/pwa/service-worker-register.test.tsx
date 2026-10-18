import { NextIntlClientProvider } from "next-intl";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import es from "../../../messages/es.json";
import { ServiceWorkerRegister, UpdateBanner } from "./service-worker-register";

const labels = { message: "Hay una versión nueva disponible.", reload: "Recargar", later: "Más tarde" };

/** Botones del árbol de elementos, para comprobar a qué acción va cada uno. */
function buttons(node: ReactNode): ReactElement<{ children: ReactNode; onClick: () => void }>[] {
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return [];
  const own = typeof node.type !== "string" && node.props.onClick ? [node as ReactElement<{ children: ReactNode; onClick: () => void }>] : [];
  const children = ([] as ReactNode[]).concat(node.props.children ?? []);
  return [...own, ...children.flatMap(buttons)];
}

describe("aviso de versión nueva", () => {
  it("la región aria-live existe desde el principio, vacía hasta que hay versión nueva", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={es} timeZone="Europe/Madrid">
        <ServiceWorkerRegister />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain(labels.reload);
  });

  it("ofrece recargar y también dejarlo para más tarde", () => {
    const html = renderToStaticMarkup(<UpdateBanner labels={labels} onReload={() => {}} onLater={() => {}} />);
    expect(html).toContain(labels.message);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain(labels.reload);
    expect(html).toContain(labels.later);
  });

  it("cada botón lanza su acción", () => {
    const onReload = vi.fn();
    const onLater = vi.fn();
    const found = buttons(UpdateBanner({ labels, onReload, onLater }));
    found.find((b) => b.props.children === labels.reload)?.props.onClick();
    found.find((b) => b.props.children === labels.later)?.props.onClick();
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
