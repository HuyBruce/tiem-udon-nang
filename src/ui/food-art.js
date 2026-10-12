import { sprite } from "./assets.js";
export function bowl(dish = {}, color = "", small = false) {
  const base = dish.empty
    ? "bowl-empty"
    : !dish.poured
      ? "bowl-noodles"
      : dish.broth?.includes("curry")
        ? "bowl-curry"
        : dish.broth?.includes("miso")
          ? "bowl-miso"
          : "bowl-soup";
  return (
    '<span class="bowl-art food-layers">' +
    sprite(base + (color === "#739b99" ? "-blue" : "")) +
    (dish.empty
      ? ""
      : (dish.tops || [])
          .map(
            (id, i) =>
              '<span class="food-topping" style="transform:translate(' +
              [-18, 15, 0, -10, 20, 3][i % 6] +
              "%," +
              [-4, 0, 9, 9, 7, -8][i % 6] +
              '%)">' +
              sprite("topping-" + id) +
              "</span>",
          )
          .join("")) +
    "</span>"
  );
}
