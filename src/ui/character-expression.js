import art from "../../data/character-art.json" with { type: "json" };
import balance from "../../config/balance.json" with { type: "json" };

export function characterAsset(c = {}) {
  const id = c.personId || c.id || "mai";
  const frames = art.expressionFrames[id];
  if (!frames) return `character-${id}${c.happy === false ? "-sad" : ""}`;
  if (c.expression && frames.includes(c.expression))
    return `v3-${id}${c.expression === "neutral" ? "" : `-${c.expression}`}`;
  let expression = "neutral";
  if (c.happy === false) expression = c.result?.score < 50 ? "angry" : "sad";
  else if (c.happy === true)
    expression =
      c.result?.score >= balance.quality.excellentThreshold
        ? "very-happy"
        : "happy";
  else if (c.status === "waiting" && c.hints >= 3) expression = "angry";
  else if (c.status === "waiting" && (c.accepted || c.hints))
    expression = "thinking";
  if (!frames.includes(expression)) expression = "neutral";
  return `v3-${id}${expression === "neutral" ? "" : `-${expression}`}`;
}
