// AST based extraction: retain expressions, event handlers and HTML in their
// original modules; move Vietnamese literal text to the language data file.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { parseAst } from "rollup/parseAst";
const dictionary = JSON.parse(await fs.readFile("data/strings.vi.json", "utf8"));
dictionary.text ??= {};
const hasVietnamese = (s) => /[À-ỹĐđ]/u.test(s);
const key = (s) => {
  const id = "t_" + crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
  if (dictionary.text[id] && dictionary.text[id] !== s) throw new Error("Text key collision");
  dictionary.text[id] = s; return `textVi(${JSON.stringify(id)})`;
};
const files = [];
async function walk(dir) { for (const item of await fs.readdir(dir, { withFileTypes: true })) {
  const file = path.join(dir, item.name);
  if (item.isDirectory()) await walk(file); else if (file.endsWith(".js") && file !== path.join("src", "i18n.js")) files.push(file);
} }
await walk("src");
const pending = [];
for (const file of files) {
  const source = (await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""), edits = [];
  function visit(node, parent = null, field = "") {
    if (!node || typeof node !== "object") return;
    if (node.type === "Literal" && typeof node.value === "string" && hasVietnamese(node.value) &&
      !(parent?.type === "Property" && field === "key" && !parent.computed)) {
      edits.push({ start: node.start, end: node.end, value: key(node.value) }); return;
    }
    if (node.type === "TemplateElement") {
      const raw = source.slice(node.start, node.end);
      // Visible text and aria-label contents; ASCII markup/attributes are retained.
      for (const match of raw.matchAll(/[A-Za-zÀ-ỹĐđ0-9][A-Za-zÀ-ỹĐđ0-9 \t.,!?…:;·%¥★☆+–—()/#−]*/gu)) {
        const value = match[0].trimEnd();
        if (hasVietnamese(value)) edits.push({ start: node.start + match.index, end: node.start + match.index + value.length, value: "${" + key(value) + "}" });
      }
      return;
    }
    for (const [name, value] of Object.entries(node)) {
      if (Array.isArray(value)) for (const child of value) visit(child, node, name);
      else if (value && typeof value === "object" && value.type) visit(value, node, name);
    }
  }
  visit(parseAst(source));
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let result = source;
  for (const edit of edits) result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  if (!source.includes('import { textVi }')) {
    let relative = path.relative(path.dirname(file), "src/i18n.js").replaceAll("\\", "/");
    if (!relative.startsWith(".")) relative = "./" + relative;
    result = `import { textVi } from ${JSON.stringify(relative)};\n` + result;
  }
  try { parseAst(result); } catch (error) { console.error(file, result.slice(error.pos - 100, error.pos + 100)); throw error; }
  pending.push({ file, result });
}
await fs.writeFile("data/strings.vi.json", JSON.stringify(dictionary, null, 2) + "\n");
for (const { file, result } of pending) await fs.writeFile(file, result);
console.log(`Extracted ${Object.keys(dictionary.text).length} Vietnamese texts; updated ${pending.length} modules.`);
