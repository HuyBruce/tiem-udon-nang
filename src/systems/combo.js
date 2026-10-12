import { textVi } from "../i18n.js";
export const orderParts = (customer) => customer.combo?.parts || [customer];

export const deliveredCount = (customer) =>
  customer.combo?.delivered.length || 0;

export const nextPartIndex = (customer) =>
  orderParts(customer).findIndex(
    (_, index) =>
      !customer.combo?.delivered.some((part) => part.index === index),
  );

export const partCustomer = (customer, index) => ({
  ...customer,
  ...orderParts(customer)[index],
});

export function combineResults(delivered) {
  const results = delivered.map(({ result }) => result);
  const score =
    results.reduce((sum, result) => sum + result.score, 0) / results.length;
  const correct = results.every((result) => result.correct);
  return {
    correct,
    score,
    payment: results.reduce((sum, result) => sum + result.payment, 0),
    tip: results.reduce((sum, result) => sum + result.tip, 0),
    rep: results.reduce((sum, result) => sum + result.rep, 0) / results.length,
    review: !correct
      ? textVi("t_39ac87f0d410")
      : score >= 85
        ? textVi("t_794075b127e8")
        : textVi("t_a2e2e5033fc0"),
  };
}
