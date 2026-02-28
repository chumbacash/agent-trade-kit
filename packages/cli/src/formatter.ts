export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    process.stdout.write("(no data)\n");
    return;
  }
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)),
  );
  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const divider = widths.map((w) => "-".repeat(w)).join("  ");
  process.stdout.write(header + "\n" + divider + "\n");
  for (const row of rows) {
    process.stdout.write(
      keys.map((k, i) => String(row[k] ?? "").padEnd(widths[i])).join("  ") + "\n",
    );
  }
}

export function printKv(obj: Record<string, unknown>, indent = 0): void {
  const pad = " ".repeat(indent);
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      process.stdout.write(`${pad}${k}:\n`);
      printKv(v as Record<string, unknown>, indent + 2);
    } else {
      process.stdout.write(`${pad}${k.padEnd(20 - indent)}  ${v}\n`);
    }
  }
}
