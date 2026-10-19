"""Auditoría estática del prototipo /plataforma (apps/site).

Comprueba, en todas las pantallas:
  - que cada ruta interna enlazada existe (literales y plantillas);
  - que no hay enlaces href="#" sin respuesta (sin data-demo);
  - que no quedan pastillas <span> que simulan un selector ni desplegables «⌄» falsos;
  - que cada parámetro de URL que se envía (?a= ?c= ?i= ?prov=…) se lee en la página destino;
  - que no aparecen sedes que no existen ni contadores de aprobaciones fijos.

Uso (desde la raíz):  python3 apps/site/scripts/audit-prototipo.py apps/site/src
Sale con código 1 si encuentra algún problema.
"""
import pathlib, re, sys, json

ROOT = pathlib.Path(sys.argv[1])           # apps/site/src
APP = ROOT / "app"
pages = sorted(APP.glob("plataforma/**/page.jsx"))
routes = {"/" + str(p.parent.relative_to(APP)).replace("\\", "/") for p in pages}
routes |= {"/plataforma"}

def src(p): return p.read_text(encoding="utf-8")
issues = {"rota": [], "hash_muerto": [], "selector_falso": [], "desplegable_falso": [], "param_sin_lector": [], "sede_inventada": [], "badge_fijo": []}
produced = {}  # ruta destino -> parámetros que le llegan

for p in pages:
    s = src(p); rel = str(p.relative_to(APP))
    # 1) enlaces internos (literales y plantillas) → ruta existente
    # cualquier literal de ruta (href directo, arrays de enlaces, ternarios…)
    for m in re.finditer(r'["`](/plataforma[^"`#\s]*)["`]', s):
        url = m.group(1)
        base = re.split(r"[?$]", url)[0].rstrip("/") or "/plataforma"
        if base not in routes: issues["rota"].append(f"{rel} → {url}")
        q = re.findall(r"[?&](\w+)=", url)
        for k in q: produced.setdefault(base, set()).add(k)
    # 2) href="#" sin data-demo (enlace muerto sin respuesta)
    for m in re.finditer(r'<a [^>]*href="#"[^>]*>', s):
        if "data-demo" not in m.group(0): issues["hash_muerto"].append(rel)
    # 3) pastillas <span> con aspecto de seleccionadas (selector falso)
    for m in re.finditer(r'<span style=\{\{ padding: "\d+px \d+px", borderRadius: "800px", background: "#000000", color: "#ffffff"[^}]*\}\}>([^<]{1,40})</span>', s):
        txt = m.group(1)
        if txt not in ("Haz",) and not txt.startswith("{"):
            issues["selector_falso"].append(f"{rel}: «{txt}»")
    # 4) desplegables falsos «… ⌄» en <span> estáticos
    for m in re.finditer(r'<span style=\{\{[^}]*\}\}>([^<{]{0,40})⌄</span>', s):
        issues["desplegable_falso"].append(f"{rel}: «{m.group(1).strip()}⌄»")
    # 5) sedes que no existen
    for bad in ("Sede Sur", "Sede Playa", ">Playa<", ">Universidad<"):
        if bad in s: issues["sede_inventada"].append(f"{rel}: {bad}")
    # 6) contador de aprobaciones fijo en la barra móvil
    if re.search(r'>\d+</span>Aprobar', s): issues["badge_fijo"].append(rel)

# 7) cada parámetro producido debe leerse en la página destino (o en sus componentes)
readers = {}
comp_src = "\n".join(src(c) for c in (ROOT / "components").glob("*.js*"))
for base, keys in produced.items():
    page = APP / base.lstrip("/") / "page.jsx"
    text = src(page) if page.exists() else ""
    for k in keys:
        direct = f'get("{k}")' in text
        via_hook = k == "a" and "useAgentParam" in text and 'get("a")' in comp_src
        if not (direct or via_hook): issues["param_sin_lector"].append(f"{base}?{k}=")

total_demo = sum(src(p).count("data-demo") for p in pages)
print(json.dumps({"pantallas": len(pages), "rutas": len(routes), "enlaces_con_parametro": {k: sorted(v) for k, v in produced.items()},
                  "data_demo_con_aviso": total_demo, **{k: v for k, v in issues.items()}}, ensure_ascii=False, indent=1))
sys.exit(1 if any(issues.values()) else 0)
