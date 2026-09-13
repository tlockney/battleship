import { assert, assertEquals } from "jsr:@std/assert@1";
type Msg = Record<string, unknown>;
import {
  canPlace,
  coordName,
  randomFleet,
  reduceLog,
  resolveShot,
  SHIPS,
} from "./game.js";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

Deno.test("randomFleet places every ship without overlap or overflow", () => {
  for (let s = 1; s < 50; s++) {
    const fleet = randomFleet(seeded(s));
    assertEquals(fleet.length, SHIPS.length);
    const seen = new Set<string>();
    for (const ship of fleet) {
      assertEquals(ship.cells.length, ship.len);
      for (const [r, c] of ship.cells) {
        assert(r >= 0 && r < 10 && c >= 0 && c < 10);
        assert(!seen.has(`${r},${c}`), "overlap");
        seen.add(`${r},${c}`);
      }
    }
  }
});

Deno.test("canPlace rejects off-board and occupied cells", () => {
  const occ = new Set(["0,0"]);
  assert(!canPlace(occ, { len: 2 }, 0, 0, true));
  assert(!canPlace(occ, { len: 5 }, 0, 6, true));
  assert(canPlace(occ, { len: 5 }, 0, 5, true));
});

Deno.test("resolveShot reports hit, sunk and game over", () => {
  const fleet = [
    { name: "Destroyer", len: 2, cells: [[0, 0], [0, 1]] },
    { name: "Cruiser", len: 3, cells: [[5, 5], [6, 5], [7, 5]] },
  ];
  assertEquals(resolveShot(fleet, new Set(), 9, 9), {
    hit: false,
    sunk: null,
    over: false,
  });
  assertEquals(resolveShot(fleet, new Set(), 0, 0), {
    hit: true,
    sunk: null,
    over: false,
  });
  assertEquals(resolveShot(fleet, new Set(["0,0"]), 0, 1), {
    hit: true,
    sunk: "Destroyer",
    over: false,
  });
  const prior = new Set(["0,0", "0,1", "5,5", "6,5"]);
  assertEquals(resolveShot(fleet, prior, 7, 5), {
    hit: true,
    sunk: "Cruiser",
    over: true,
  });
});

Deno.test("reduceLog: first joiner fires first, turn passes after a result", () => {
  const log: Msg[] = [
    { t: "join", p: "a", name: "Thomas" },
    { t: "join", p: "b", name: "B" },
    { t: "ready", p: "b" },
    { t: "ready", p: "a" },
  ];
  let s = reduceLog(log);
  assertEquals(s.phase, "playing");
  assertEquals(s.turn, "a");

  log.push({ t: "fire", p: "b", r: 0, c: 0 }); // out of turn: ignored
  s = reduceLog(log);
  assertEquals(s.pending, null);

  log.push({ t: "fire", p: "a", r: 3, c: 4 });
  s = reduceLog(log);
  assertEquals(s.pending, { p: "a", r: 3, c: 4 });
  assertEquals(s.turn, "a");

  log.push({
    t: "res",
    p: "b",
    r: 3,
    c: 4,
    hit: true,
    sunk: null,
    over: false,
  });
  s = reduceLog(log);
  assertEquals(s.pending, null);
  assertEquals(s.turn, "b");
  assertEquals(s.shots.a["3,4"], { hit: true, sunk: null });

  log.push({ t: "fire", p: "b", r: 1, c: 1 });
  log.push({
    t: "res",
    p: "a",
    r: 1,
    c: 1,
    hit: true,
    sunk: "Destroyer",
    over: true,
  });
  s = reduceLog(log);
  assertEquals(s.phase, "over");
  assertEquals(s.winner, "b");
});

Deno.test("reduceLog ignores a third joiner and repeated shots", () => {
  const log: Msg[] = [
    { t: "join", p: "a", name: "A" },
    { t: "join", p: "b", name: "B" },
    { t: "join", p: "c", name: "C" },
    { t: "ready", p: "a" },
    { t: "ready", p: "b" },
    { t: "fire", p: "a", r: 0, c: 0 },
    { t: "res", p: "b", r: 0, c: 0, hit: false, sunk: null, over: false },
    { t: "fire", p: "b", r: 0, c: 0 },
    { t: "res", p: "a", r: 0, c: 0, hit: false, sunk: null, over: false },
    { t: "fire", p: "a", r: 0, c: 0 }, // repeat: ignored
  ];
  const s = reduceLog(log);
  assertEquals(s.players.length, 2);
  assertEquals(s.pending, null);
  assertEquals(s.turn, "a");
});

Deno.test("coordName", () => {
  assertEquals(coordName(0, 0), "A1");
  assertEquals(coordName(9, 9), "J10");
});
