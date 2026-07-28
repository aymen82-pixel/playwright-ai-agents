/**
 * Parseur YAML minimal — sous-ensemble strictement nécessaire à `routing.yaml` :
 * mappings imbriqués (par indentation) + séquences de scalaires (`- valeur`).
 * Zéro dépendance (fidèle au principe « kernel léger »). N'implémente PAS le
 * YAML complet (ancres, multi-docs, scalaires multilignes…).
 */

type YamlValue = string | null | YamlValue[] | { [k: string]: YamlValue };

interface Line {
  indent: number;
  content: string;
}

export function parseYaml(text: string): YamlValue {
  const lines: Line[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || /^\s*#/.test(raw)) continue;
    const indent = raw.length - raw.trimStart().length;
    lines.push({ indent, content: raw.slice(indent) });
  }
  if (lines.length === 0) return null;

  let pos = 0;

  const parseBlock = (indent: number): YamlValue => {
    if (lines[pos].content.startsWith("- ")) {
      const arr: YamlValue[] = [];
      while (
        pos < lines.length &&
        lines[pos].indent === indent &&
        lines[pos].content.startsWith("- ")
      ) {
        arr.push(unquote(lines[pos].content.slice(2).trim()));
        pos++;
      }
      return arr;
    }

    const obj: { [k: string]: YamlValue } = {};
    while (
      pos < lines.length &&
      lines[pos].indent === indent &&
      !lines[pos].content.startsWith("- ")
    ) {
      const line = lines[pos].content;
      const colon = line.indexOf(":");
      if (colon === -1) {
        throw new Error(`Ligne YAML sans ':' — "${line}"`);
      }
      const key = unquote(line.slice(0, colon).trim());
      const after = line.slice(colon + 1).trim();
      pos++;
      if (after !== "") {
        obj[key] = unquote(after);
      } else if (pos < lines.length && lines[pos].indent > indent) {
        obj[key] = parseBlock(lines[pos].indent);
      } else {
        obj[key] = null;
      }
    }
    return obj;
  };

  return parseBlock(lines[0].indent);
}

function unquote(s: string): string {
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")))
  ) {
    return s.slice(1, -1);
  }
  return s;
}
