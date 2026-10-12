import strings from "../data/strings.vi.json" with { type: "json" };
export function textVi(id) {
  if (!Object.hasOwn(strings.text, id))
    throw new Error("Missing Vietnamese text: " + id);
  return strings.text[id];
}
