import { createHash } from "node:crypto";

type Seen = WeakSet<object>;

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertSerializableChartOption(
  value: unknown,
  path = "option",
  seen: Seen = new WeakSet(),
): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} must be a finite number.`);
    }
    return;
  }

  if (typeof value === "undefined") {
    throw new TypeError(`${path} must not be undefined.`);
  }

  if (
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    throw new TypeError(
      `${path} contains ${typeof value}, which cannot be passed to enhanced charts.`,
    );
  }

  if (typeof value !== "object") return;

  if (seen.has(value)) {
    throw new TypeError(`${path} contains a circular reference.`);
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertSerializableChartOption(item, `${path}[${index}]`, seen);
    });
    seen.delete(value);
    return;
  }

  if (!isPlainObject(value)) {
    throw new TypeError(
      `${path} must contain only JSON-compatible arrays and plain objects.`,
    );
  }

  for (const [key, item] of Object.entries(value)) {
    assertSerializableChartOption(item, `${path}.${key}`, seen);
  }

  seen.delete(value);
}

export function serializeChartOption(value: unknown): string {
  assertSerializableChartOption(value);
  return JSON.stringify(value);
}

function stableStringifyValue(value: unknown, seen: Seen): string {
  if (value === null) return "null";

  const valueType = typeof value;
  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (valueType === "undefined") return '"[undefined]"';
  if (valueType === "bigint") return JSON.stringify(`[bigint:${value}]`);
  if (valueType === "symbol") return JSON.stringify(String(value));
  if (valueType === "function") {
    return JSON.stringify(`[function:${String(value)}]`);
  }

  if (valueType !== "object") return JSON.stringify(value);

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    throw new TypeError("Cannot hash chart input with a circular reference.");
  }
  seen.add(objectValue);

  if (Array.isArray(value)) {
    const serialized = `[${value
      .map((item) => stableStringifyValue(item, seen))
      .join(",")}]`;
    seen.delete(objectValue);
    return serialized;
  }

  const record = value as Record<string, unknown>;
  const serialized = `{${Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringifyValue(record[key], seen)}`,
    )
    .join(",")}}`;

  seen.delete(objectValue);
  return serialized;
}

export function stableStringify(value: unknown): string {
  return stableStringifyValue(value, new WeakSet());
}

export function chartHash(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 12);
}
