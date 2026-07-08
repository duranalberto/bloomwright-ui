import { createHash } from "node:crypto";

declare const mermaidDiagramDefinitionBrand: unique symbol;

export type MermaidDiagramDefinition = string & {
  readonly [mermaidDiagramDefinitionBrand]: true;
};

export function normalizeMermaidDefinition(code: string): string {
  return code.trim();
}

export function defineMermaidDiagram(code: string): MermaidDiagramDefinition {
  if (typeof code !== "string") {
    throw new TypeError("defineMermaidDiagram() expects a string.");
  }

  const normalizedCode = normalizeMermaidDefinition(code);
  if (!normalizedCode) {
    throw new Error("defineMermaidDiagram() received an empty diagram.");
  }

  return normalizedCode as MermaidDiagramDefinition;
}

export function getMermaidStableId(code: string): string {
  return createHash("sha256")
    .update(normalizeMermaidDefinition(code))
    .digest("hex")
    .slice(0, 8);
}

export function getMermaidDiagramType(code: string): string {
  const keyword =
    normalizeMermaidDefinition(code).match(/^([A-Za-z][\w-]*)/)?.[1] ??
    "diagram";

  if (keyword === "graph") return "flowchart";
  if (keyword.startsWith("stateDiagram")) return "state";
  if (keyword.startsWith("sequenceDiagram")) return "sequence";
  if (keyword.startsWith("classDiagram")) return "class";
  if (keyword.startsWith("erDiagram")) return "entity relationship";
  if (keyword.startsWith("gitGraph")) return "git graph";
  if (keyword.startsWith("xychart")) return "chart";

  return keyword.replace(/-/g, " ");
}
