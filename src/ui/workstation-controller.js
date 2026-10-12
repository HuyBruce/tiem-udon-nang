import { createWashing } from "./washing.js";
import { DRINKS, DRINK_TOPPINGS, INGREDIENTS, TOPPINGS } from "../data.js";
import BROTH_INGREDIENTS from "../../data/broth-ingredients.json" with { type: "json" };
import { DRINK_METHODS } from "../systems/drinks.js";
import { availableDrinkToppings } from "../systems/drink-toppings.js";
import { brothBatchFor } from "../systems/cooking.js";
import { count } from "../systems/inventory.js";
import { foodIcon } from "./art.js";
import { workstationFocus } from "./workstation-focus.js";
import { selectNextCookable } from "./order-queue.js";
import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import {
  ingredientFlight,
  objectFeedback,
  touchFeedback,
  pourFeedback,
} from "./experience.js";
import {
  kitchenControls,
  drinkControls,
  workstationBench,
  updateWorkstationTimers,
  workstationTrash,
} from "./workstation-view.js";

// Selection and pointer state are disposable UI state, never added to a save.
export function createWorkstations(host) {
  const washing = createWashing(host);
  let held = null,
    focused = null,
    practiced = 0;
  const engine = () => host.getEngine();
  const state = () => engine().s;
  const direct = () =>
    !host.ui.panel && ["kitchen", "drinks"].includes(host.ui.scene);
  const fail = (message, target) => {
    host.audio.play("error");
    host.notify(message);
    if (state().settings.haptic) navigator.vibrate?.(18);
    if (host.animate() && target)
      target.animate(
        [{ translate: "-3px 0" }, { translate: "3px 0" }, { translate: "0 0" }],
        { duration: 180 },
      );
    return false;
  };
  const success = (result, origin, target, id, sound = "pour") => {
    if (!result) return false;
    if (host.animate()) {
      touchFeedback(origin);
      if (id) ingredientFlight(foodIcon(id), origin, target);
      objectFeedback(target);
    }
    host.audio.play(sound);
    practiced++;
    host.ui.workPracticed = practiced >= 6;
    held = null;
    host.render();
    return true;
  };
  function select(id, origin) {
    const s = state();
    let label = id;
    const [kind, item] = id.split(":");
    if (kind === "ingredient") {
      if (!count(s, item))
        return fail(
          `Hết ${INGREDIENTS[item]?.name || item} trong kho. Hãy nhập thêm nguyên liệu.`,
          origin,
        );
      label = INGREDIENTS[item].name;
    } else if (kind === "prepared") {
      if (!s.prepared[item])
        return fail(
          item === "egg"
            ? "Chưa có trứng chín. Chuẩn bị trứng trước khi mở cửa."
            : "Chưa có tempura chín. Chiên tôm với bột và dầu trước.",
          origin,
        );
      label = item === "egg" ? "Trứng chín" : "Tempura chín";
    } else if (id === "noodles") label = "Mì udon";
    else if (kind === "broth")
      label = item === "curry" ? "Nước dùng cà ri" : "Nước dùng";
    else if (id === "drink") label = "Ly đã pha";
    else if (kind === "tool")
      label =
        {
          water: "Nước nóng",
          whisk: "Chổi đánh trà",
          milk: "Sữa",
          ice: "Đá",
          garnish: "Trang trí",
        }[item] || item;
    held = held?.id === id ? null : { id, label, origin };
    if (held?.id === "ingredient:oil") host.notify(labels.work.oilHint);
    if (held?.id === "prepared:tempura") host.notify(labels.work.tempuraHint);
    host.render();
    return true;
  }
  function discard(source, origin) {
    if (!source) return fail(labels.work.trashEmpty, origin);
    if (!engine().discardFood(source))
      return fail(labels.work.trashInvalid, origin);
    held = null;
    if (source === `dish:${host.ui.selectedDish}`) host.ui.selectedDish = null;
    if (source === `dish:${host.ui.dishId}`) host.ui.dishId = null;
    host.notify(labels.work.trashDone);
    host.render();
    return true;
  }
  function drinkIngredient(id, origin) {
    const s = state(),
      d = s.drink;
    if (!d)
      return fail("Chọn món nước trước khi cho nguyên liệu vào ly.", origin);
    const step = DRINK_METHODS[d.id]?.[d.step];
    if (!step)
      return fail(
        "Ly đã pha xong. Thêm topping hoặc ghép vào món trên mâm.",
        origin,
      );
    if (!step.items?.includes(id))
      return fail(
        `Chưa dùng nguyên liệu này. Bước hiện tại: ${step.label}.`,
        origin,
      );
    const sound =
      id === "milk"
        ? "milk"
        : id === "soda"
          ? "soda"
          : id === "ramune"
            ? "bottle"
            : "ingredientDrop";
    return success(
      engine().drinkStep(step.action),
      origin,
      ".work-vessel",
      id,
      sound,
    );
  }
  function drinkAction(action, origin) {
    const d = state().drink,
      step = d && DRINK_METHODS[d.id]?.[d.step];
    if (!step)
      return fail("Chọn món nước và làm lần lượt các bước trước.", origin);
    if (action !== step.action || step.items)
      return fail(`Bước hiện tại: ${step.label}.`, origin);
    return success(
      engine().drinkStep(action),
      origin,
      ".work-vessel",
      null,
      action === "whisk" ? "whisk" : "pour",
    );
  }
  function apply(source, target, origin) {
    origin = document.querySelector(`[data-drag="${source}"]`) || origin;
    const e = engine(),
      s = e.s;
    const [kind, item] = source.split(":"),
      [destination, index] = target.split(":");
    const i = Number(index);
    if (target === "trash") return discard(source, origin);
    focused = destination;
    const targetSelector =
      destination === "broth"
        ? ".broth-label"
        : destination === "fryer"
          ? ".fryer-label"
          : destination === "pot"
            ? `[data-pot="${i}"]`
            : ".work-vessel";
    if (source === "noodles" && destination === "pot") {
      selectNextCookable(e);
      return success(
        e.noodles(i),
        origin,
        targetSelector,
        "noodles",
        "noodles",
      );
    }
    if (kind === "pot" && (target === "worktop" || destination === "bowl")) {
      if (!s.pots[Number(item)])
        return fail("Chưa có mì trong nồi để vớt.", origin);
      host.ui.pot = Number(item);
      return success(
        e.liftNoodles(Number(item)),
        origin,
        ".work-vessel",
        null,
        "lift",
      );
    }
    if (kind === "bowl" && target === "tray") {
      const result = e.tray(Number(item));
      if (result) {
        host.ui.selectedDish = null;
        selectNextCookable(e);
      }
      return success(result, origin, ".wooden-tray", null, "wood");
    }
    if (kind === "bowl" && destination === "customer") {
      if (!e.tray(Number(item))) return false;
      return success(
        e.serve(s.tray.at(-1).id, index),
        origin,
        ".customer",
        null,
        "bowl",
      );
    }
    if (
      kind === "ingredient" &&
      destination === "broth" &&
      !BROTH_INGREDIENTS.includes(item)
    )
      return fail(
        "Nguyên liệu này không dùng nấu nước dùng. Chọn dashi hoặc gia vị nước dùng trên kệ.",
        origin,
      );
    if (kind === "ingredient" && destination === "broth")
      return success(
        e.brothAdd(item, index),
        origin,
        targetSelector,
        item,
        "ingredientDrop",
      );
    if (kind === "broth" && destination === "bowl") {
      const result = e.pour(i, item);
      if (result && host.animate()) pourFeedback(".work-bowl");
      return success(result, origin, ".work-bowl", null, "broth");
    }
    if (
      (kind === "ingredient" || kind === "prepared") &&
      destination === "bowl"
    )
      return TOPPINGS.includes(item)
        ? success(e.topping(i, item), origin, ".work-bowl", item, "topping")
        : fail(
            "Đây không phải topping mì. Chọn hành, thịt, đậu phụ hoặc topping đã chuẩn bị.",
            origin,
          );
    if (kind === "ingredient" && destination === "fryer") {
      const f = s.fryer[i];
      const action =
        item === "shrimp" && !f
          ? "select"
          : item === "flour" && f?.stage === "raw"
            ? "batter"
            : item === "oil" && f?.stage === "battered"
              ? "oil"
              : null;
      if (!action)
        return fail(
          f?.stage === "frying"
            ? "Tempura đang chiên. Chờ đúng lúc rồi nhấc chảo."
            : "Chiên theo thứ tự: tôm → bột → dầu → nhấc khi chín.",
          origin,
        );
      return success(
        e.fry(action, i),
        origin,
        targetSelector,
        item,
        action === "batter"
          ? "batter"
          : action === "oil"
            ? "fry"
            : "ingredientDrop",
      );
    }
    if (kind === "fryer" && target === "worktop") {
      if (s.fryer[Number(item)]?.stage !== "frying")
        return fail("Cho tôm, bột và dầu vào chảo trước khi nhấc.", origin);
      return success(
        e.fry("lift", Number(item)),
        origin,
        ".fryer-label",
        null,
        "crisp",
      );
    }
    if (kind === "ingredient" && target === "cup")
      return drinkIngredient(item, origin);
    if (
      source === "tool:ice" &&
      target === "cup" &&
      s.drink?.step >= DRINKS[s.drink.id].steps
    ) {
      if (!e.drinkChill())
        return fail("Ly này chưa thể làm lạnh hoặc đã có đá.", origin);
      return success(true, origin, ".work-vessel", null, "ice");
    }
    if (kind === "tool" && target === "cup")
      return item === "milk"
        ? drinkIngredient("milk", origin)
        : drinkAction(item, origin);
    if (source === "drink" && destination === "dish")
      return success(e.attachDrink(index), origin, ".wooden-tray", null, "cup");
    if (kind === "prepared" && destination === "dish") {
      const d = s.tray.find((d) => d.id === index);
      if (!d || d.side)
        return fail("Món này đã có món kèm hoặc chưa nằm trên mâm.", origin);
      return success(e.side(index, item), origin, ".wooden-tray", item, "bowl");
    }
    return fail(
      "Đích chưa phù hợp. Chọn nồi, tô, ly hoặc món trên mâm đúng với vật đang cầm.",
      origin,
    );
  }
  function target(id, origin) {
    if (id === "trash") return discard(held?.id, origin);
    focused = id.split(":")[0];
    if (held) return apply(held.id, id, held.origin || origin);
    const s = state(),
      e = engine(),
      [kind, part] = id.split(":"),
      i = Number(part);
    if (kind === "pot") {
      host.ui.pot = i;
      const p = s.pots[i];
      if (!p)
        return success(
          e.burnerStep(i),
          origin,
          `[data-pot="${i}"]`,
          null,
          "water",
        );
      if (!p.lifted)
        return success(e.liftNoodles(i), origin, ".work-bowl", null, "lift");
      host.render();
      return true;
    }
    if (kind === "broth") {
      if (brothBatchFor(s, part).stage === "ready") return select(id, origin);
      if (brothBatchFor(s, part).stage === "cooking")
        return fail(
          "Nước dùng đang nấu. Chờ mẻ này chín trước khi rót.",
          origin,
        );
      return success(e.brothCook(part), origin, ".broth-label", null, "boil");
    }
    if (kind === "fryer") {
      if (s.fryer[i]?.stage === "frying")
        return success(e.fry("lift", i), origin, ".fryer-label", null, "crisp");
      if (!s.fryer.length && s.prepared.tempura)
        return select("prepared:tempura", origin);
      return fail("Chọn tôm rồi chạm chảo; tiếp theo là bột và dầu.", origin);
    }
    if (id === "board")
      return success(
        e.chop(1),
        origin,
        ".scene-sprite:has([data-chop])",
        null,
        "chop",
      );
    if (id === "sink") return washing.start();
    if (id === "fridge") {
      host.audio.play("fridge");
      host.ui.workPicker = "drink";
      host.render();
      return true;
    }
    if (id === "cup") {
      const d = s.drink,
        step = d && DRINK_METHODS[d.id]?.[d.step];
      if (d && d.step >= DRINKS[d.id].steps) return select("drink", origin);
      if (step && !step.items) return drinkAction(step.action, origin);
      return fail(
        step ? `Bước hiện tại: ${step.label}.` : "Chọn món nước trước.",
        origin,
      );
    }
    if (kind === "bowl") return select(id, origin);
    return fail("Thả hoặc chọn nồi mì để vớt lên bàn thao tác.", origin);
  }
  function handle(act, arg, origin) {
    if (act === "work-picker") {
      host.ui.workPicker = host.ui.workPicker === arg ? null : arg;
      (host.refresh || host.render)();
      return true;
    }
    if (act === "work-choice") {
      const split = arg.indexOf(":"),
        kind = arg.slice(0, split),
        value = arg.slice(split + 1);
      const trigger = document.querySelector(`[data-work-${kind}]`);
      host.ui.workPicker = null;
      if (trigger) {
        trigger.value = value;
        trigger.dispatchEvent(new Event("change", { bubbles: true }));
      }
      host.render();
      return true;
    }
    if (act === "work-trash") {
      const s = state();
      const source =
        held?.id ||
        (s.tray.some((d) => d.id === host.ui.selectedDish)
          ? `dish:${host.ui.selectedDish}`
          : host.ui.scene === "drinks" && s.drink
            ? "drink"
            : host.ui.scene === "kitchen" && s.pots[host.ui.pot]
              ? `pot:${host.ui.pot}`
              : null);
      discard(source, origin);
      return true;
    }
    if (act === "dish" && direct()) {
      if (held) apply(held.id, `dish:${arg}`, held.origin || origin);
      else {
        host.ui.selectedDish = arg;
        host.ui.dishId = arg;
        host.notify(
          "Món đã chọn. Chọn ly/món kèm để ghép, hoặc sang khu khách để giao.",
        );
        host.render();
      }
      return true;
    }
    if (!act.startsWith("work-")) return false;
    if (act === "work-source") select(arg, origin);
    else if (act === "work-target") target(arg, origin);
    else if (act === "work-action") {
      const s = state(),
        e = engine();
      if (arg === "cancel") {
        held = null;
        host.render();
      } else if (arg === "more-supplies") {
        const rail = origin
          .closest(".work-supplies")
          ?.querySelector(".work-supply-items");
        if (rail)
          rail.scrollTo({
            left:
              rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2
                ? 0
                : rail.scrollLeft + rail.clientWidth * 0.65,
            behavior: host.animate() ? "smooth" : "instant",
          });
      } else if (arg === "heat") {
        target(`pot:${host.ui.pot}`, origin);
      } else if (arg === "start-noodles") {
        apply("noodles", `pot:${host.ui.pot}`, origin);
      } else if (arg === "lift") {
        if (!s.pots[host.ui.pot] || s.pots[host.ui.pot].lifted)
          fail(
            "Chưa có mì đang luộc để vớt. Đun nước rồi thả mì vào nồi.",
            origin,
          );
        else target(`pot:${host.ui.pot}`, origin);
      } else if (arg === "tray") apply(`bowl:${host.ui.pot}`, "tray", origin);
      else if (arg === "eggs")
        success(e.prepareEgg(), origin, ".work-supplies", null, "bowl");
      else if (arg === "chill") {
        if (!e.drinkChill())
          fail("Pha xong ly nóng có tùy chọn lạnh trước khi thêm đá.", origin);
        else success(true, origin, ".work-vessel", null, "ice");
      } else if (arg === "attach") {
        const dish =
          s.tray.find((d) => d.id === host.ui.selectedDish) ||
          s.tray.find((d) => !d.drink);
        if (dish) apply("drink", `dish:${dish.id}`, origin);
        else fail("Đặt tô mì lên mâm trước, rồi ghép ly vào tô.", origin);
      } else if (arg === "drink-step") target("cup", origin);
    }
    return true;
  }
  function bind(app) {
    app.addEventListener("change", (event) => {
      const el = event.target,
        e = engine();
      if (
        host.animate() &&
        el.matches("select[data-work-detail],select[data-work-finish]")
      )
        touchFeedback(el);
      if (el.matches("[data-work-order]")) {
        const [id, index] = el.value.split(":");
        const customer = state().customers.find((c) => c.id === id);
        if (customer?.combo) e.selectPart(id, Number(index));
        else if (customer) {
          state().selectedOrder = id;
          state().selectedPart = 0;
          e.changed();
        }
        host.render();
      } else if (el.matches("[data-work-drink]")) {
        if (el.value && success(e.drinkStart(el.value), el, ".work-vessel"))
          host.notify(
            "Làm theo hướng dẫn trên ly: chọn nguyên liệu hoặc vuốt/chạm trực tiếp.",
          );
      } else if (el.matches("[data-work-detail]")) {
        held = null;
        if (el.value === "dish") {
          host.ui.dishId = host.ui.selectedDish || state().tray[0]?.id;
          if (!host.ui.dishId) return fail("Chưa có món trên mâm để xem.", el);
        }
        if (el.value) host.showPanel(el.value);
      } else if (el.matches("[data-work-finish]")) {
        if (["cold", "stirfry"].includes(el.value)) {
          if (
            !success(
              e.finishStyle(host.ui.pot, el.value),
              el,
              ".work-bowl",
              null,
              "fry",
            )
          )
            fail("Vớt mì trước; mì xào cần chan nước dùng trước khi xào.", el);
        } else if (["regular", "curry"].includes(el.value))
          success(e.selectBroth(el.value), el, ".broth-label");
        else if (el.value === "reset")
          success(e.brothReset(), el, ".broth-label");
        else if (el.value === "discard") {
          if (!success(e.discard(host.ui.pot), el, ".work-bowl"))
            fail("Chưa có tô đang làm để bỏ.", el);
        }
      } else if (el.matches("[data-work-drink-topping]")) {
        if (el.value && !e.drinkTopping(el.value))
          fail("Topping chưa phù hợp hoặc chưa có nguyên liệu.", el);
        else if (el.value)
          success(
            true,
            el,
            ".work-vessel",
            DRINK_TOPPINGS[el.value].ingredient,
          );
      }
    });
  }
  function update() {
    const game = document.querySelector(".game");
    if (game)
      game.dataset.holdingFood = String(
        Boolean(
          host.ui.selectedDish ||
          /^(dish:|bowl:|pot:|fryer:|prepared:|drink$)/.test(held?.id || ""),
        ),
      );
    washing.update();
    updateWorkstationTimers(state());
    for (const room of document.querySelectorAll(
      ".world-room.kitchen,.world-room.drinks",
    ))
      room.dataset.workFocus = workstationFocus(
        state(),
        room.dataset.worldRoom,
        host.ui.pot,
        focused,
      );
    const bench = document.querySelector(".direct-workbench");
    if (bench)
      bench.dataset.workFocus = workstationFocus(
        state(),
        host.ui.scene,
        host.ui.pot,
        focused,
      );
    document
      .querySelectorAll("[data-drag]")
      .forEach((el) =>
        el.classList.toggle("work-selected", el.dataset.drag === held?.id),
      );
    const select = document.querySelector("[data-work-drink-topping]"),
      d = state().drink;
    if (select?.tagName === "SELECT" && d && select.options.length === 1)
      for (const id of availableDrinkToppings(d.id, d.temperature, state().day))
        select.add(new Option(DRINK_TOPPINGS[id].name, id));
  }
  return {
    bind,
    handle,
    washed: washing.observe,
    frame: washing.frame,
    update,
    reset: () => {
      held = null;
      focused = null;
    },
    scene: (view = host.ui) =>
      view.scene === "kitchen"
        ? kitchenControls(state(), view)
        : drinkControls(state(), view),
    bench: () => workstationBench(state(), host.ui, held),
    trash: workstationTrash,
    drop: (source, target, origin) => {
      if (target === "trash" && !host.ui.panel) {
        discard(source, origin);
        return true;
      }
      const trayTarget =
        target?.startsWith("dish:") &&
        (source === "drink" || source.startsWith("prepared:"));
      if (
        host.ui.panel ||
        (!direct() && !trayTarget) ||
        source.startsWith("dish:")
      )
        return false;
      apply(source, target || "invalid", origin);
      return true;
    },
    craft: (action, origin) => drinkAction(action, origin),
    invalidTap: (origin) => {
      if (direct() && held)
        fail(
          "Chạm vào nồi, tô, ly hoặc món trên mâm phù hợp với vật đang chọn.",
          origin,
        );
    },
    chop: (accuracy, origin) =>
      success(
        engine().chop(accuracy),
        origin,
        ".scene-sprite:has([data-chop])",
        null,
        "chop",
      ),
    wash: (origin) => target("sink", origin),
  };
}
