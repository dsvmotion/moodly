import { defaultFilter } from "cmdk";

export interface SearchableItem {
  id: string;
  label: string;
  keywords?: string[];
}

/** Valor con el que la paleta registra cada elemento en cmdk. */
export function commandItemValue(item: SearchableItem): string {
  return `${item.label} ${item.id}`;
}

/**
 * Ordena los grupos por su mejor coincidencia con la búsqueda, con la misma
 * puntuación que usa cmdk para filtrar. cmdk 1.1.1 ordena los elementos dentro
 * de cada grupo pero no los grupos (los busca por su id en `data-value`, donde
 * guarda el título), así que la mejor coincidencia podía quedar detrás de otra
 * peor y Enter elegía esa. Sin búsqueda, o a igual puntuación, se mantiene el
 * orden original.
 */
export function orderGroupsBySearch<G extends { items: SearchableItem[] }>(groups: readonly G[], search: string): G[] {
  if (!search.trim()) return [...groups];
  const best = (group: G) =>
    Math.max(0, ...group.items.map((item) => defaultFilter(commandItemValue(item), search, item.keywords ?? [])));
  return groups
    .map((group, index) => ({ group, index, score: best(group) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ group }) => group);
}
