import ts from "typescript";
import { normalizeMermaidDefinition } from "./definition.ts";

function isAstroSource(filePath: string): boolean {
  return filePath.endsWith(".astro");
}

function isDefinitionSource(filePath: string): boolean {
  return (
    filePath.endsWith(".astro") ||
    filePath.endsWith(".ts") ||
    filePath.endsWith(".tsx")
  );
}

function extractAstroFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1] ?? "";
}

function getParseText(content: string, filePath: string): string {
  return isAstroSource(filePath) ? extractAstroFrontmatter(content) : content;
}

function getScriptKind(filePath: string): ts.ScriptKind {
  return filePath.endsWith(".tsx") || filePath.endsWith(".astro")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
}

function isDefineMermaidDiagramCall(
  node: ts.Node,
): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "defineMermaidDiagram"
  );
}

function isStringRawTag(node: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "String" &&
    node.name.text === "raw"
  );
}

function getRawTemplateText(
  template: ts.NoSubstitutionTemplateLiteral,
  sourceFile: ts.SourceFile,
): string {
  const text = template.getText(sourceFile);
  return text.slice(1, -1);
}

function failDynamicDefinition(filePath: string): never {
  throw new Error(
    `[mermaid] defineMermaidDiagram() in ${filePath} must use a static string or String.raw template literal without interpolation.`,
  );
}

function readStaticDefinitionArg(
  arg: ts.Expression,
  sourceFile: ts.SourceFile,
  filePath: string,
): string {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    return normalizeMermaidDefinition(arg.text);
  }

  if (ts.isTemplateExpression(arg)) {
    return failDynamicDefinition(filePath);
  }

  if (ts.isTaggedTemplateExpression(arg) && isStringRawTag(arg.tag)) {
    if (ts.isNoSubstitutionTemplateLiteral(arg.template)) {
      return normalizeMermaidDefinition(
        getRawTemplateText(arg.template, sourceFile),
      );
    }

    return failDynamicDefinition(filePath);
  }

  return failDynamicDefinition(filePath);
}

export function extractMermaidDefinitionCalls(
  content: string,
  filePath: string,
): string[] {
  if (!isDefinitionSource(filePath)) return [];

  const parseText = getParseText(content, filePath);
  if (!parseText) return [];

  const sourceFile = ts.createSourceFile(
    filePath,
    parseText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );
  const definitions: string[] = [];

  const visit = (node: ts.Node): void => {
    if (isDefineMermaidDiagramCall(node)) {
      if (node.arguments.length !== 1) {
        return failDynamicDefinition(filePath);
      }

      const code = readStaticDefinitionArg(
        node.arguments[0]!,
        sourceFile,
        filePath,
      );

      if (!code) {
        throw new Error(
          `[mermaid] defineMermaidDiagram() in ${filePath} received an empty diagram.`,
        );
      }

      definitions.push(code);
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return definitions;
}
