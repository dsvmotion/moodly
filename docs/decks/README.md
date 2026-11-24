# Decks de presentación

Fuentes de las dos presentaciones (noviembre de 2026). Son material comercial, no documentación del producto: si discrepan con `docs/MANUAL.md` o con un ADR, mandan estos.

| Deck | Diapositivas generadas | Publicado en |
|---|---|---|
| Inversores (19 + anexo) | `generador/inv/project/` | https://claude.ai/artifact/Pta4YgVJajqLPuaxTtpnMt |
| Empresas piloto (22) | `generador/pil/project/` | https://claude.ai/artifact/2ietfCtFQrhaJ42GUnmdC3 |

Los enlaces son privados: solo los abre su dueño y quien él invite.

## Cómo está montado

- `generador/lib.cjs`: los componentes (portada, tablas, fichas, línea de tiempo) y los colores de marca.
- `generador/build.cjs`: define las dos presentaciones y aplica, en orden, los parches `inv2…inv13.cjs` y `pil2…pil9.cjs` (los `shared*.cjs` son diapositivas comunes a las dos). Cada parche es una ronda de cambios; el estado final es el resultado de aplicarlos todos.
- `deck/` y `deck-inv/`: la primera versión de cada deck. El generador solo lee de ahí el `deck.json` y las notas del presentador.
- `generador/{inv,pil}/project/`: la salida. Una diapositiva por archivo (`slides/<id>.html`, 1920×1080, estilos en línea) y `deck.json` con el orden.

## Regenerar

```bash
cd docs/decks/generador
node build.cjs          # reescribe inv/project y pil/project, y un preview.html de cada una
node shot.cjs inv pil   # opcional: PNG por diapositiva y aviso de desbordes (necesita Playwright)
```

`build.cjs` lee las fuentes y los logos de `apps/site/public`. Las imágenes de las diapositivas apuntan a `/_blob/<id>`, que solo existe dentro del artefacto publicado; `preview.html` las sustituye por los SVG del repo.

## Qué conviene saber antes de enseñarlos

- Varias cifras de mercado se leyeron en resúmenes y no en el informe original; lo dicen las notas del presentador y la diapositiva «De dónde sale cada número».
- La tarifa de WhatsApp para España está sin verificar (ver `docs/design/modelo-precios.md`).
- Los cierres no llevan correo de contacto: está por decidir.
