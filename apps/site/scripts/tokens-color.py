"""Convierte los colores literales del prototipo en variables CSS semánticas.

Regla de oro: cada variable vale EN CLARO exactamente el color que sustituye, así el
modo claro no cambia ni un píxel. El significado (y por tanto el valor en oscuro) se
decide por la PROPIEDAD: el mismo #000000 es «tinta» como texto y «botón» como fondo.
Uso: python3 darkmode_codemod.py <apps/site/src> [--apply]
"""
import re, sys, pathlib, collections

ROOT = pathlib.Path(sys.argv[1]); APPLY = "--apply" in sys.argv

TEXT = {  # color de texto / iconos
    "#000000": "ink", "#2b2b2e": "ink-2", "#5f5f63": "muted", "#6b6b70": "muted-2", "#9a9a9e": "muted-3", "#9b9ba1": "muted-4",
    "#004c39": "green-fg", "#a30042": "rose-fg", "#8e4e00": "amber-fg", "#2457f5": "blue-fg", "#3a4a63": "slate-fg",
    "#4b2ec9": "violet-fg", "#2c5868": "mist-fg", "#0000002a": "line-strong", "#d4d4d8": "track",
}
BG = {  # superficies y rellenos suaves
    "#ffffff": "paper", "#000000": "ink", "#f4f4f5": "canvas", "#ebebed": "sunken", "#e9e9ec": "backdrop",
    "#fafafa": "paper-2a", "#f7f7f8": "paper-2b", "#f2f2f4": "paper-2c", "#f0f0f1": "paper-2d",
    "#d4d4d8": "track", "#d9d9de": "track-2",
    "#dcebdd": "green-bg", "#ffe8d6": "amber-bg", "#fff1d6": "amber-bg-2", "#fbe1ea": "rose-bg", "#fdf3f7": "rose-bg-2", "#ffe0ea": "rose-bg-3",
    "#e8edff": "blue-bg", "#eef1f6": "slate-bg", "#eceafe": "violet-bg", "#efe6ff": "violet-bg-2", "#dbe9ef": "mist-bg",
    "#f6f2e8": "linen", "#a3c2a7": "sage", "#9dbecc": "mist", "#ffbab5": "coral",
    "#0000001a": "line", "#0000000f": "line-soft", "#0000000d": "tint", "#0000000a": "tint-a",
}
LINE = {  # bordes y anillos
    "#0000001a": "line", "#0000000f": "line-soft", "#0000002a": "line-strong", "#0000004d": "line-x",
    "#000000": "ink", "#ffffff": "on-ink", "#ffffff55": "on-ink-55", "#a3004233": "rose-line",
    "#2457f5": "blue-fg", "#a30042": "rose-fg", "#004c39": "green-fg", "#8e4e00": "amber-fg",
    "#0000000a": "tint-a", "#f6f2e8": "linen",
}
PASTEL = {h for h, n in BG.items() if n.endswith("-bg") or n.startswith(("amber-bg", "rose-bg", "violet-bg")) or n in ("linen", "sage", "mist", "coral", "mist-bg")}
TEXT_KEYS = {"color", "fg", "chipFg", "statusColor", "metaColor", "leftColor", "tagFg", "accentColor", "textDecorationColor", "caretColor", "stroke", "fill"}
BG_KEYS = {"background", "backgroundColor", "bg", "tint", "statusBg", "chipBg", "tagBg", "bar", "sage", "mist", "coral", "linen"}
LINE_KEYS = {"border", "borderColor", "borderTop", "borderBottom", "borderLeft", "borderRight", "borderTopColor", "boxShadow", "outline", "outlineColor"}
KEEP_KEYS = {"recepcion", "atencion", "comercial", "admin"}  # rellenos de marca de cada agente
HEX = re.compile(r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b")

stats = collections.Counter(); unmapped = collections.Counter()

def var(name): return f"var(--{name})"

def map_hex(h, cat, obj_text):
    h = h.lower()
    if cat == "keep": return None
    if cat == "text":
        if h == "#ffffff":
            # Texto blanco sobre el botón/pastilla negra → se invierte con él; sobre rellenos de color, sigue blanco.
            return var("on-ink") if re.search(r'background(Color)?\s*:[^,}]*"#000000"', obj_text) else None
        if h in TEXT: return var(TEXT[h])
        if h in PASTEL: return None  # pastel usado como texto sobre fondo oscuro: se mantiene
        return None
    if cat == "bg":
        if h in BG: return var(BG[h])
        return None  # rellenos fuertes (verde, magenta, ámbar, azul, naranja): se mantienen
    if cat == "line":
        if h in LINE: return var(LINE[h])
        return None  # sombras
    # Sin propiedad conocida (arrays de datos, comparaciones): por valor.
    if h in PASTEL: return var(BG[h])
    if h in TEXT and h not in ("#ffffff",): return var(TEXT[h])
    return None

def enclosing_object(s, pos):
    depth = 0; i = pos
    while i > 0:
        i -= 1
        c = s[i]
        if c == "}": depth += 1
        elif c == "{":
            if depth == 0: break
            depth -= 1
    j = pos; depth = 0
    while j < len(s):
        c = s[j]
        if c == "{": depth += 1
        elif c == "}":
            if depth == 0: break
            depth -= 1
        j += 1
    return s[i:j + 1]

def value_end(s, start):
    """Fin de la expresión de valor de una propiedad (coma o llave de cierre a nivel 0)."""
    depth = 0; i = start; q = None
    while i < len(s):
        c = s[i]
        if q:
            if c == "\\": i += 2; continue
            if c == q: q = None
        elif c in "\"'`": q = c
        elif c in "([{": depth += 1
        elif c in ")]}":
            if depth == 0: return i
            depth -= 1
        elif c == "," and depth == 0: return i
        elif c == "\n" and depth == 0: return i
        i += 1
    return i

def transform(s, fname):
    edits = []  # (start, end, replacement)
    decided = []  # posiciones ya resueltas por propiedad (se conviertan o no)
    # 1) propiedades «clave: valor» (estilos y datos)
    for m in re.finditer(r'(?<![\w.$-])(\w+)\s*:\s*(?!:)', s):
        key = m.group(1); vstart = m.end(); vend = value_end(s, vstart); val = s[vstart:vend]
        if "#" not in val: continue
        cat = "keep" if key in KEEP_KEYS else "text" if key in TEXT_KEYS else "bg" if key in BG_KEYS else "line" if key in LINE_KEYS else None
        if cat is None: continue
        obj = enclosing_object(s, m.start())
        for hm in HEX.finditer(val):
            # solo hex dentro de cadenas
            before = val[:hm.start()]
            if before.count('"') % 2 == 0 and before.count("`") % 2 == 0: continue
            decided.append((vstart + hm.start(), vstart + hm.end()))
            rep = map_hex(hm.group(0), cat, obj)
            if rep: edits.append((vstart + hm.start(), vstart + hm.end(), rep)); stats[f"{cat}:{hm.group(0).lower()}"] += 1
            else: unmapped[f"{cat}:{hm.group(0).lower()}"] += 1
    # 2) atributos SVG stroke= / fill=
    for m in re.finditer(r'\b(stroke|fill)=(\{[^}]*\}|"[^"]*")', s):
        for hm in HEX.finditer(m.group(2)):
            decided.append((m.start(2) + hm.start(), m.start(2) + hm.end()))
            rep = map_hex(hm.group(0), "text", "")
            if rep: edits.append((m.start(2) + hm.start(), m.start(2) + hm.end(), rep)); stats[f"attr:{hm.group(0).lower()}"] += 1
    # 3) resto de literales hex en cadenas (arrays de datos, comparaciones): por valor
    taken = {(a, b) for a, b, _ in edits}
    covered = sorted([(a, b) for a, b, _ in edits] + decided)
    for hm in re.finditer(r'"(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)"', s):
        a, b = hm.start(1), hm.end(1)
        if any(x <= a < y for x, y in covered): continue
        line = s[s.rfind("\n", 0, a) + 1: s.find("\n", a)]
        if re.search(r"\bLIGHT\b|AGENT_COLOR|AGENT_TABLE_COLOR|recepcion:|atencion:", line): continue  # comparaciones con colores de agente
        rep = map_hex(hm.group(1), None, "")
        if rep: edits.append((a, b, rep)); stats[f"valor:{hm.group(1).lower()}"] += 1
    # aplicar de atrás adelante, sin solapes
    edits.sort(key=lambda e: e[0], reverse=True); out = s; last = None
    for a, b, r in edits:
        if last is not None and b > last: continue
        out = out[:a] + r + out[b:]; last = a
    return out, len(edits)

files = sorted(ROOT.glob("app/plataforma/**/*.jsx")) + [ROOT / "components" / f for f in
    ["app-sidebar.jsx", "settings-nav.jsx", "settings-shell.jsx", "pills.jsx", "mobile-frame.jsx", "modelos-tabs.jsx", "demo-actions.jsx", "sede-cycle.jsx", "sede-data.js", "integrations-data.js", "models-catalog.js"]]
total = 0
for f in files:
    s = f.read_text(); out, n = transform(s, f.name); total += n
    if APPLY and out != s: f.write_text(out)
print(f"{len(files)} archivos · {total} sustituciones {'APLICADAS' if APPLY else '(en seco)'}")
print("sin convertir (se mantienen):", ", ".join(f"{k}×{v}" for k, v in unmapped.most_common(25)))
