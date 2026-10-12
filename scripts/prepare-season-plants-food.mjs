import fs from "node:fs/promises";
import sharp from "sharp";
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const write = (file, data) =>
  fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
const manifest = await read("assets/manifest.json"),
  plantArt = await read("data/plant-art.json");
for (const id of ["sakura", "sunflower", "corn-butter"]) {
  const source = `sprites/sources/v3-${id === "sunflower" ? "sunflower-corrected" : id}-sheet.png`;
  const meta = await sharp("assets/" + source).metadata(),
    width = meta.width / 2,
    height = meta.height / 2;
  if (!meta.hasAlpha || !Number.isInteger(width) || !Number.isInteger(height))
    throw new Error("Invalid sheet: " + id);
  const poses =
    id === "corn-butter"
      ? [
          "ingredient-corn",
          "ingredient-butter",
          "topping-corn",
          "topping-butter",
        ]
      : ["sprout", "growing", "ripe", "wilted"];
  if (id !== "corn-butter") plantArt[id] = {};
  for (const [i, pose] of poses.entries()) {
    const asset = id === "corn-butter" ? pose : `v3-garden-${id}-${pose}`,
      file = `sprites/${asset.startsWith("v3-") ? asset : "v3-" + asset}.webp`;
    const cell = await sharp("assets/" + source)
      .extract({
        left: (i % 2) * width,
        top: Math.floor(i / 2) * height,
        width,
        height,
      })
      .png()
      .toBuffer();
    const size = id === "corn-butter" ? 256 : 512;
    let picture = sharp(cell);
    if (id === "corn-butter") picture = picture.trim();
    await picture
      .resize(size, size, { fit: "contain", background: "#00000000" })
      .webp({ quality: 90 })
      .toFile("assets/" + file);
    manifest.assets[asset] = {
      file,
      source,
      width: size,
      height: size,
      anchor: [0.5, id === "corn-butter" ? 0.5 : 1],
      transparent: true,
      status: "ready",
      artVersion: 3,
    };
    if (id !== "corn-butter") plantArt[id][pose] = asset;
  }
}
await write("assets/manifest.json", manifest);
await write("data/plant-art.json", plantArt);
const plants = await read("data/plants.json");
plants.sakura = { name: "Anh đào nhỏ", seasons: ["Xuân"], flower: true };
plants.sunflower = { name: "Hướng dương", seasons: ["Hạ"], flower: true };
await write("data/plants.json", plants);
const ingredients = await read("data/ingredients.json");
ingredients.corn = { name: "Bắp ngọt", kind: "cold", color: "#e2be58" };
ingredients.butter = { name: "Bơ", kind: "cold", color: "#f2dfb9" };
await write("data/ingredients.json", ingredients);
const toppings = await read("data/toppings.json");
for (const id of ["corn", "butter"])
  if (!toppings.includes(id)) toppings.push(id);
await write("data/toppings.json", toppings);
const balance = await read("config/balance.json");
Object.assign(balance.prices.plants, {
  sakura: { cost: 150, days: 3, yield: 1, level: 1 },
  sunflower: { cost: 130, days: 2, yield: 1, level: 2 },
});
Object.assign(balance.prices.ingredients, {
  corn: { cost: 30, life: 5 },
  butter: { cost: 40, life: 8 },
});
const recipes = await read("data/recipes.json");
const additions = {
  butterCorn: [
    "Udon bơ bắp",
    ["dashi", "soy", "mirin"],
    ["corn", "butter", "onion"],
    "hot",
    "Bắp ngọt và bơ tan trong nước dùng nhẹ, ấm như một buổi chiều mùa đông.",
    890,
    3200,
  ],
  butterBeef: [
    "Udon bò bơ bắp",
    ["dashi", "soy", "mirin"],
    ["beef", "corn", "butter"],
    "hot",
    "Thịt bò mềm bên bắp vàng, bơ làm tròn vị nước dùng.",
    1120,
    4600,
  ],
  misoCorn: [
    "Udon miso bắp",
    ["dashi", "miso", "mirin"],
    ["corn", "butter", "onion"],
    "hot",
    "Bắp ngọt gặp miso đậm đà, điểm chút bơ thơm.",
    990,
    3800,
  ],
  curryCorn: [
    "Udon cà ri bắp",
    ["dashi", "soy", "curry"],
    ["corn", "tofu", "onion"],
    "hot",
    "Bắp và đậu phụ trong cà ri vàng, dùng nóng khi trời se lạnh.",
    1030,
    4050,
  ],
  yakiCorn: [
    "Udon xào bắp nấm",
    ["dashi", "soy", "mirin"],
    ["corn", "shiitake", "onion"],
    "stirfry",
    "Đảo mì cùng nấm và bắp, vừa thơm vừa nhẹ bụng.",
    980,
    3650,
  ],
};
for (const [
  id,
  [name, broth, tops, kind, desc, price, unlock],
] of Object.entries(additions)) {
  recipes[id] = { name, jp: "Hương vị của tiệm", broth, tops, kind, desc };
  balance.prices.recipes[id] = { price, unlock };
}
await write("data/recipes.json", recipes);
await write("config/balance.json", balance);
console.log(
  "Packed twelve sprites, five noodle recipes and two seasonal flower species.",
);
