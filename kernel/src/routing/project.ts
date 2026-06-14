/**
 * Moteur de projection déterministe pour la transmission sélective (`filter`).
 *
 * Chaque règle de `routing.yaml` est un chemin qui extrait/projette un sous-arbre
 * du payload source. Grammaire supportée :
 *   - `domain`                                  champ simple
 *   - `session.{role,storage_state_path}`       projection d'objet
 *   - `pages[].{url,title,complexity}`          projection par élément de tableau
 *   - `api_calls`                               sous-arbre complet
 *   - `results[?failure.kind==SCRIPT].{id,spec}` filtre de tableau + projection
 */

type Step =
  | { type: "key"; name: string }
  | { type: "array" }
  | { type: "filter"; path: string; value: string }
  | { type: "pick"; keys: string[] };

interface ParsedPath {
  base: string;
  steps: Step[];
}

export function parsePath(path: string): ParsedPath {
  let i = 0;
  const readIdent = (): string => {
    const start = i;
    while (i < path.length && /[A-Za-z0-9_-]/.test(path[i])) i++;
    return path.slice(start, i);
  };

  const base = readIdent();
  if (!base) throw new Error(`Chemin invalide : "${path}"`);
  const steps: Step[] = [];

  while (i < path.length) {
    const ch = path[i];
    if (ch === "[") {
      if (path[i + 1] === "]") {
        steps.push({ type: "array" });
        i += 2;
      } else if (path[i + 1] === "?") {
        const end = path.indexOf("]", i);
        if (end === -1) throw new Error(`Filtre non terminé dans "${path}"`);
        const expr = path.slice(i + 2, end);
        const eq = expr.indexOf("==");
        if (eq === -1) throw new Error(`Filtre sans == dans "${path}"`);
        steps.push({
          type: "filter",
          path: expr.slice(0, eq).trim(),
          value: unquote(expr.slice(eq + 2).trim()),
        });
        i = end + 1;
      } else {
        throw new Error(`Crochet inattendu dans "${path}"`);
      }
    } else if (ch === ".") {
      i++;
      if (path[i] === "{") {
        const end = path.indexOf("}", i);
        if (end === -1) throw new Error(`Projection non terminée dans "${path}"`);
        const keys = path
          .slice(i + 1, end)
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        steps.push({ type: "pick", keys });
        i = end + 1;
      } else {
        const name = readIdent();
        if (!name) throw new Error(`Clé attendue après '.' dans "${path}"`);
        steps.push({ type: "key", name });
      }
    } else {
      throw new Error(`Caractère inattendu '${ch}' dans "${path}"`);
    }
  }

  return { base, steps };
}

/** Applique une règle de chemin à un objet source. Retourne { key, value }. */
export function applyRule(
  source: Record<string, unknown>,
  path: string,
): { key: string; value: unknown } {
  const { base, steps } = parsePath(path);
  let current: unknown = source?.[base];

  for (const step of steps) {
    switch (step.type) {
      case "array":
        // Marqueur : current doit être un tableau ; les étapes suivantes mappent.
        break;
      case "filter":
        current = Array.isArray(current)
          ? current.filter((el) => String(getByPath(el, step.path)) === step.value)
          : current;
        break;
      case "key":
        current = Array.isArray(current)
          ? current.map((el) => (el as Record<string, unknown>)?.[step.name])
          : (current as Record<string, unknown>)?.[step.name];
        break;
      case "pick":
        current = Array.isArray(current)
          ? current.map((el) => pickKeys(el, step.keys))
          : pickKeys(current, step.keys);
        break;
    }
  }

  return { key: base, value: current };
}

/** Projette un payload source selon une liste de règles → objet extrait. */
export function project(
  source: Record<string, unknown>,
  rules: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const rule of rules) {
    const { key, value } = applyRule(source, rule);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function pickKeys(obj: unknown, keys: string[]): unknown {
  if (obj == null || typeof obj !== "object") return obj;
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in src) out[k] = src[k];
  }
  return out;
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, seg) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[seg];
  }, obj);
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}
