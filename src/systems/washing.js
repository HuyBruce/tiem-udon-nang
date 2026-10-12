import balance from "../../config/balance.json" with { type: "json" };
export const washCount = (sink, limit = balance.washing.batchSize) =>
  Math.min(Math.max(0, sink), balance.washing.batchSize, Math.max(0, limit));
export const washSeconds = (level) =>
  level
    ? balance.washing.staffSeconds[
        Math.min(level, balance.washing.staffSeconds.length) - 1
      ]
    : balance.washing.manualSeconds;
