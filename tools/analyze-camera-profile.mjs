import fs from "node:fs/promises";
import path from "node:path";

const directory = process.argv[2];
if (!directory)
  throw new Error(
    "Usage: node tools/analyze-camera-profile.mjs PROFILE_DIRECTORY [OUTPUT_JSON]",
  );
const files = await fs.readdir(directory);
const snapshots = files
  .filter((f) => f.endsWith(".heapsnapshot"))
  .sort(
    (a, b) => Number(a.match(/-(\d+)ms/)[1]) - Number(b.match(/-(\d+)ms/)[1]),
  );
function heap(s) {
  const fields = s.snapshot.meta.node_fields;
  const stride = fields.length,
    types = s.snapshot.meta.node_types[0];
  const indexes = Object.fromEntries(fields.map((f, i) => [f, i]));
  const groups = new Map();
  let selfBytes = 0,
    detached = 0,
    elements = 0;
  for (let n = 0; n < s.nodes.length; n += stride) {
    const type = types[s.nodes[n + indexes.type]],
      name = s.strings[s.nodes[n + indexes.name]];
    const label =
      type === "string" || type === "concatenated string"
        ? name.slice(0, 120)
        : name;
    const key = `${type}: ${label}`,
      bytes = s.nodes[n + indexes.self_size];
    const row = groups.get(key) || {
      type,
      name: label,
      count: 0,
      selfBytes: 0,
    };
    row.count++;
    row.selfBytes += bytes;
    groups.set(key, row);
    selfBytes += bytes;
    if (type === "native" && name.startsWith("<")) elements++;
    if (
      type === "native" &&
      name.startsWith("<") &&
      indexes.detachedness !== undefined &&
      s.nodes[n + indexes.detachedness] === 2
    )
      detached++;
  }
  return {
    nodeCount: s.nodes.length / stride,
    selfBytes,
    detached,
    elements,
    groups,
  };
}
const result = {
  method:
    "V8 heap snapshots after GC; self size is not retained size. Detached counts include native DOM element tags only, not DOMRect/performance entries. Group growth alone does not establish a leak.",
  heap: [],
  cpu: [],
};
if (snapshots.length >= 2) {
  const before = heap(
    JSON.parse(await fs.readFile(path.join(directory, snapshots[0]), "utf8")),
  );
  const after = heap(
    JSON.parse(
      await fs.readFile(path.join(directory, snapshots.at(-1)), "utf8"),
    ),
  );
  const keys = new Set([...before.groups.keys(), ...after.groups.keys()]);
  const delta = [...keys].map((key) => {
    const a = before.groups.get(key) || { count: 0, selfBytes: 0 };
    const b = after.groups.get(key) || { ...a, count: 0, selfBytes: 0 };
    return {
      name: key,
      beforeCount: a.count,
      afterCount: b.count,
      countDelta: b.count - a.count,
      bytesDelta: b.selfBytes - a.selfBytes,
    };
  });
  result.heap = {
    before: {
      file: snapshots[0],
      nodes: before.nodeCount,
      selfBytes: before.selfBytes,
      detachedElementCount: before.detached,
      elementCount: before.elements,
    },
    after: {
      file: snapshots.at(-1),
      nodes: after.nodeCount,
      selfBytes: after.selfBytes,
      detachedElementCount: after.detached,
      elementCount: after.elements,
    },
    largestGrowth: delta
      .filter((x) => x.bytesDelta > 0)
      .sort((a, b) => b.bytesDelta - a.bytesDelta)
      .slice(0, 30),
    nativeGrowth: delta
      .filter((x) => x.name.startsWith("native:") && x.countDelta > 0)
      .sort((a, b) => b.countDelta - a.countDelta)
      .slice(0, 25),
  };
}
for (const file of files.filter((f) => f.endsWith(".cpuprofile"))) {
  const p = JSON.parse(await fs.readFile(path.join(directory, file), "utf8"));
  const nodes = new Map(p.nodes.map((n) => [n.id, n])),
    totals = new Map(),
    parents = new Map();
  for (const n of p.nodes)
    for (const id of n.children || []) parents.set(id, n.id);
  const animationCallers = new Map();
  let total = 0;
  for (let i = 0; i < p.samples.length; i++) {
    const n = nodes.get(p.samples[i]),
      dt = p.timeDeltas[i];
    total += dt;
    const f = n.callFrame,
      key = `${f.functionName || "(anonymous)"} ${f.url}:${f.lineNumber + 1}:${f.columnNumber + 1}`;
    const row = totals.get(key) || {
      function: f.functionName || "(anonymous)",
      url: f.url,
      line: f.lineNumber + 1,
      column: f.columnNumber + 1,
      selfMs: 0,
    };
    row.selfMs += dt / 1000;
    totals.set(key, row);
    if (f.functionName === "getAnimations") {
      const parent = nodes.get(parents.get(n.id))?.callFrame;
      const caller = `${parent?.functionName || "(anonymous)"} ${parent?.url || ""}:${(parent?.lineNumber ?? -1) + 1}:${(parent?.columnNumber ?? -1) + 1}`;
      animationCallers.set(
        caller,
        (animationCallers.get(caller) || 0) + dt / 1000,
      );
    }
  }
  result.cpu.push({
    file,
    durationMs: (p.endTime - p.startTime) / 1000,
    sampledMs: total / 1000,
    animationCallers: [...animationCallers]
      .map(([caller, selfMs]) => ({ caller, selfMs }))
      .sort((a, b) => b.selfMs - a.selfMs),
    hottestSelf: [...totals.values()]
      .sort((a, b) => b.selfMs - a.selfMs)
      .slice(0, 40),
  });
}
const output = process.argv[3] || path.join(directory, "analysis.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      output,
      heap: result.heap.before
        ? {
            before: result.heap.before,
            after: result.heap.after,
            largestGrowth: result.heap.largestGrowth
              .slice(0, 6)
              .map((x) => ({ ...x, name: x.name.slice(0, 100) })),
          }
        : [],
      cpu: result.cpu.map((p) => ({
        ...p,
        hottestSelf: p.hottestSelf.slice(0, 8),
      })),
    },
    null,
    2,
  ),
);
