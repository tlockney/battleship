// Pure Battleship rules. No DOM, no network. Everything the page shows is
// derived from (a) the shared message log and (b) this player's private fleet.

export const SIZE = 10;
export const SHIPS = [
  { name: "Carrier", len: 5 },
  { name: "Battleship", len: 4 },
  { name: "Cruiser", len: 3 },
  { name: "Submarine", len: 3 },
  { name: "Destroyer", len: 2 },
];

export const key = (r, c) => `${r},${c}`;

/** Cells a ship covers when placed at (r,c). */
export function shipCells(ship, r, c, horizontal) {
  const cells = [];
  for (let i = 0; i < ship.len; i++) {
    cells.push(horizontal ? [r, c + i] : [r + i, c]);
  }
  return cells;
}

export function canPlace(occupied, ship, r, c, horizontal) {
  return shipCells(ship, r, c, horizontal).every(([rr, cc]) =>
    rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && !occupied.has(key(rr, cc))
  );
}

/**
 * Random legal fleet. Returns [{name, len, cells:[[r,c],...]}].
 * `rand` is injectable so tests are deterministic.
 */
export function randomFleet(rand = Math.random) {
  const occupied = new Set();
  const fleet = [];
  for (const ship of SHIPS) {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const horizontal = rand() < 0.5;
      const r = Math.floor(rand() * SIZE);
      const c = Math.floor(rand() * SIZE);
      if (!canPlace(occupied, ship, r, c, horizontal)) continue;
      const cells = shipCells(ship, r, c, horizontal);
      cells.forEach(([rr, cc]) => occupied.add(key(rr, cc)));
      fleet.push({ name: ship.name, len: ship.len, cells });
      break;
    }
  }
  if (fleet.length !== SHIPS.length) throw new Error("could not place fleet");
  return fleet;
}

/**
 * Resolve a shot against `fleet`, given every shot already taken (a Set of
 * keys, including this one is fine). Returns {hit, sunk, over}.
 */
export function resolveShot(fleet, priorShots, r, c) {
  const shots = new Set(priorShots);
  shots.add(key(r, c));
  const ship = fleet.find((s) =>
    s.cells.some(([rr, cc]) => rr === r && cc === c)
  );
  if (!ship) return { hit: false, sunk: null, over: false };
  const sunk = ship.cells.every(([rr, cc]) => shots.has(key(rr, cc)));
  const over = sunk &&
    fleet.every((s) => s.cells.every(([rr, cc]) => shots.has(key(rr, cc))));
  return { hit: true, sunk: sunk ? ship.name : null, over };
}

/**
 * Fold the shared message log into game state. Messages are plain objects:
 *   {t:"join",  p, name}
 *   {t:"ready", p}
 *   {t:"fire",  p, r, c}                  p = shooter
 *   {t:"res",   p, r, c, hit, sunk, over}  p = owner of the board that was hit
 * The first player to join fires first. A fire waits for its res before the
 * turn passes, so a player who is offline simply pauses the game.
 */
export function reduceLog(log) {
  const players = []; // [{id, name, ready}] in join order
  const byId = (id) => players.find((p) => p.id === id);
  /** @type {Record<string, Record<string, {hit:boolean, sunk:string|null}>>} */
  const shots = {}; // shooter id -> { "r,c": {hit, sunk} }
  let pending = null; // {p, r, c} fire awaiting a res
  let turnIndex = 0;
  let winner = null;

  for (const m of log) {
    if (!m || typeof m !== "object") continue;
    switch (m.t) {
      case "join": {
        if (byId(m.p)) {
          if (typeof m.name === "string") byId(m.p).name = m.name;
        } else if (players.length < 2) {
          players.push({
            id: m.p,
            name: String(m.name ?? "Player"),
            ready: false,
          });
          shots[m.p] = {};
        }
        break;
      }
      case "ready": {
        const p = byId(m.p);
        if (p) p.ready = true;
        break;
      }
      case "fire": {
        if (winner || pending || players.length < 2) break;
        if (!players.every((p) => p.ready)) break;
        if (players[turnIndex].id !== m.p) break;
        if (shots[m.p][key(m.r, m.c)]) break;
        pending = { p: m.p, r: m.r, c: m.c };
        break;
      }
      case "res": {
        if (!pending) break;
        const shooter = players[turnIndex];
        const owner = players[1 - turnIndex];
        if (m.p !== owner.id || m.r !== pending.r || m.c !== pending.c) break;
        shots[shooter.id][key(m.r, m.c)] = {
          hit: !!m.hit,
          sunk: m.sunk ?? null,
        };
        pending = null;
        if (m.over) winner = shooter.id;
        else turnIndex = 1 - turnIndex;
        break;
      }
    }
  }

  const phase = winner
    ? "over"
    : players.length < 2
    ? "waiting"
    : players.every((p) => p.ready)
    ? "playing"
    : "placing";

  return {
    players,
    shots,
    pending,
    turn: players.length === 2 ? players[turnIndex].id : null,
    winner,
    phase,
  };
}

export const ROWS = "ABCDEFGHIJ";
export const coordName = (r, c) => `${ROWS[r]}${c + 1}`;
