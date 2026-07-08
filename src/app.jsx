// localStorage shim for standalone hosting (replaces Claude's window.storage)
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      return v == null ? null : { key, value: v };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true };
    },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix };
    },
  };
}
import React, { useState, useEffect, useRef, useContext, createContext } from "react";

/* ============ THE YARDAGE BOOK v4 — iOS native, light/dark ============ */

const LIGHT = {
  mode: "light",
  bg: "#F2F2F7", card: "#FFFFFF", fill: "#E9E9EB", line: "#E5E5EA",
  label: "#1C1C1E", secondary: "#8E8E93", tertiary: "#C7C7CC",
  blue: "#007AFF", red: "#FF3B30", green: "#34C759", orange: "#FF9500", teal: "#30B0C7",
  chrome: "rgba(249,249,249,0.94)",
};
const DARK = {
  mode: "dark",
  bg: "#000000", card: "#1C1C1E", fill: "#2C2C2E", line: "#38383A",
  label: "#FFFFFF", secondary: "#98989F", tertiary: "#48484A",
  blue: "#0A84FF", red: "#FF453A", green: "#30D158", orange: "#FF9F0A", teal: "#40C8E0",
  chrome: "rgba(22,22,24,0.94)",
};
const ThemeCtx = createContext(LIGHT);
const useTheme = () => useContext(ThemeCtx);
const SYS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif";

const STORE_KEY = "yardage-book-v1";
const APP_NAME = "The Ledger";
const APP_BYLINE = "by Aaron Galloway";
const TEE_CLUBS = ["DR", "3W", "HY", "IRON"];
const DEFAULT_BAG = [
  { name: "Driver", tee: true, appr: false },
  { name: "3W", tee: true, appr: true },
  { name: "3h", tee: true, appr: true },
  { name: "4i", tee: true, appr: true },
  { name: "5i", tee: true, appr: true },
  { name: "6i", tee: false, appr: true },
  { name: "7i", tee: false, appr: true },
  { name: "8i", tee: false, appr: true },
  { name: "9i", tee: false, appr: true },
  { name: "43", tee: false, appr: true },
  { name: "48", tee: false, appr: true },
  { name: "52", tee: false, appr: true },
  { name: "58", tee: false, appr: true },
];
const TEE_RESULTS = [
  { k: "FWY", label: "Fairway", good: true },
  { k: "L", label: "Miss L" }, { k: "R", label: "Miss R" },
  { k: "BUNK", label: "Bunker" },
  { k: "PEN", label: "Penalty", bad: true }, { k: "OB", label: "OB", bad: true },
];
const APP_DISTS = [
  { k: "<100", label: "<100" }, { k: "100-150", label: "100–150" }, { k: "150+", label: "150+" },
];
const APP_RESULTS = [
  { k: "GRN", label: "Green", good: true },
  { k: "SHORT", label: "Short" }, { k: "LONG", label: "Long" },
  { k: "LEFT", label: "Left" }, { k: "RIGHT", label: "Right" },
  { k: "BUNK", label: "Bunker", sand: true },
  { k: "PEN", label: "Penalty", bad: true },
];
const SAND_OUTCOME = [
  { k: "P4", label: "Inside 4 ft", on: true, good: true },
  { k: "P10", label: "4–10 ft", on: true },
  { k: "P10+", label: "10+ ft", on: true },
  { k: "SHORT", label: "Out, short", miss: true },
  { k: "LONG", label: "Out, long", miss: true },
  { k: "IN", label: "Stayed in", bad: true },
];
const MISS_PROX = [
  { k: "<10", label: "Chippable · <10 yd" }, { k: "10-30", label: "10–30 yd" }, { k: "30+", label: "30+ yd" },
];
const CHIP_PROX = [
  { k: "P4", label: "Inside 4 ft", on: true, good: true },
  { k: "P10", label: "4–10 ft", on: true },
  { k: "P10+", label: "10+ ft", on: true },
  { k: "MISS", label: "Missed green", miss: true },
  { k: "CHUNK", label: "Chunked", bad: true },
  { k: "BLADE", label: "Bladed", bad: true },
];
const PUTT_FIRST = [
  { k: "SHORT", label: "Short · <8 ft" }, { k: "MID", label: "Mid · 8–20" }, { k: "LAG", label: "Lag · 20+" },
];
const MADE_FROM = [
  { k: "TAP", label: "Tap-in" }, { k: "3-4", label: "3–4 ft" }, { k: "5-8", label: "5–8 ft" },
  { k: "9-15", label: "9–15 ft" }, { k: "16+", label: "16+ ft" },
];
const MISTAKE_CATS = ["Tee", "Approach", "Chipping", "Putting", "Mental"];

const emptyHole = (par) => ({
  par,
  tee: { club: null, result: null },
  app: { dist: null, result: null, missProx: null, club: null },
  dec: { choice: null, worked: null },
  chip: { prox: null, bunker: false },
  sand: { outcome: null },
  putts: { count: null, first: null, lagged: null, missedShort: false, madeFrom: null },
  mistakes: [],
  note: "",
  score: null,
});

const uid = () => Math.random().toString(36).slice(2, 9);
const fmtToPar = (n) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

/* ---------- storage + migration from v1/v2 shapes ---------- */
function migrateHole(h) {
  const out = { ...emptyHole(h.par), ...h };
  // old putts.first buckets -> new
  const map = { "<6": "SHORT", "6-20": "MID", "20+": "LAG" };
  if (h.putts) out.putts = {
    count: h.putts.count ?? null,
    first: map[h.putts.first] || (["SHORT","MID","LAG"].includes(h.putts.first) ? h.putts.first : null),
    lagged: h.putts.lagged ?? null,
    missedShort: h.putts.missedShort ?? false,
    madeFrom: h.putts.madeFrom ?? null,
  };
  if (h.sg && !h.chip) out.chip = { prox: null, bunker: !!h.sg.bunker };
  const chipMap = { "<4": "P4", "4-10": "P10", "10+": "P10+", "CHUNK": "CHUNK" };
  if (out.chip && out.chip.prox && chipMap[out.chip.prox]) out.chip.prox = chipMap[out.chip.prox];
  let sandOutcome = h.sand?.outcome ?? null;
  if (sandOutcome == null && h.sand) {
    if (h.sand.escaped === false) sandOutcome = "IN";
    else if (h.sand.prox === "<4") sandOutcome = "P4";
    else if (h.sand.prox === "4-10") sandOutcome = "P10";
    else if (h.sand.prox === "10+") sandOutcome = "P10+";
  }
  out.sand = { outcome: sandOutcome };
  if (h.app) out.app = { dist: h.app.dist ?? null, result: h.app.result ?? null, missProx: h.app.missProx ?? null, club: h.app.club ?? null };
  // old mistake cat rename
  out.mistakes = (h.mistakes || []).map((c) => (c === "Short game" ? "Chipping" : c));
  delete out.sg;
  return out;
}
async function loadData() {
  try {
    const r = await window.storage.get(STORE_KEY);
    if (r && r.value) {
      const d = JSON.parse(r.value);
      const fix = (rd) => rd ? { ...rd, holes: rd.holes.map(migrateHole) } : rd;
      return { courses: d.courses || [], rounds: (d.rounds || []).map(fix), activeRound: fix(d.activeRound),
        theme: d.theme || "light", bag: (d.bag && d.bag.length) ? d.bag : DEFAULT_BAG };
    }
  } catch (e) { /* first run */ }
  return { courses: [], rounds: [], activeRound: null, theme: "light", bag: DEFAULT_BAG };
}
async function saveData(data) {
  try { await window.storage.set(STORE_KEY, JSON.stringify(data)); }
  catch (e) { console.error("save failed", e); }
}

/* ---------- handicap (WHS + 9-hole pairing) ---------- */
/* how many differentials WHS actually uses for a given count, and whether it's provisional */
function handicapBasis(n) {
  if (n < 3) return { used: 0, provisional: true };
  const table = { 3:1,4:1,5:1,6:2,7:2,8:2,9:3,10:3,11:3,12:4,13:4,14:4,15:5,16:5,17:6,18:6,19:7,20:8 };
  const used = n >= 20 ? 8 : table[n];
  return { used, provisional: n < 20 };
}

function whsIndex(diffs) {
  const d = [...diffs].sort((a, b) => a - b);
  const n = d.length;
  if (n < 3) return null;
  const avg = (k) => d.slice(0, k).reduce((s, x) => s + x, 0) / k;
  let idx;
  if (n === 3) idx = avg(1) - 2;
  else if (n === 4) idx = avg(1) - 1;
  else if (n === 5) idx = avg(1);
  else if (n === 6) idx = avg(2) - 1;
  else if (n <= 8) idx = avg(2);
  else if (n <= 11) idx = avg(3);
  else if (n <= 14) idx = avg(4);
  else if (n <= 16) idx = avg(5);
  else if (n <= 18) idx = avg(6);
  else if (n === 19) idx = avg(7);
  else idx = avg(8);
  return Math.round(idx * 10) / 10;
}
function buildDifferentials(rounds) {
  // Each round yields one 18-hole-equivalent score differential.
  // 18-hole: (gross - rating) * 113 / slope
  // 9-hole:  scaled to 18 by doubling the 9-hole differential (9-hole rating ≈ rating/2)
  const diffs = [];
  rounds.forEach((r) => {
    const played = r.holes.filter((h) => h.score != null);
    if (!played.length || !r.rating || !r.slope) return;
    const gross = played.reduce((s, h) => s + h.score, 0);
    let diff = null;
    if (played.length === 18) {
      diff = (gross - r.rating) * 113 / r.slope;
    } else if (played.length === 9) {
      const nineDiff = (gross - r.rating / 2) * 113 / r.slope; // 9-hole differential
      diff = nineDiff * 2;                                     // 18-hole equivalent
    }
    if (diff != null) diffs.push(Math.round(diff * 10) / 10);
  });
  return { diffs: diffs.slice(-20), pending9: false };
}

/* ---------- stats engine ---------- */
const hasGIRData = (h) => h.score != null && h.putts.count != null;
const isGIR = (h) => h.score - h.putts.count <= h.par - 2;

/* per-round stat summary, normalized to rates so 9s and 18s compare */
function roundStats(r) {
  const played = r.holes.filter((h) => h.score != null);
  if (!played.length) return null;
  const gross = played.reduce((s, h) => s + h.score, 0);
  const par = played.reduce((s, h) => s + h.par, 0);
  const girH = played.filter(hasGIRData);
  const girs = girH.filter(isGIR).length;
  const tee = played.filter((h) => h.par > 3 && h.tee.result);
  const fw = tee.filter((h) => h.tee.result === "FWY").length;
  const trouble = tee.filter((h) => ["PEN", "OB"].includes(h.tee.result)).length;
  const scrambleH = girH.filter((h) => !isGIR(h));
  const scrambles = scrambleH.filter((h) => h.score <= h.par).length;
  const puttH = played.filter((h) => h.putts.count != null);
  const putts = puttH.reduce((s, h) => s + h.putts.count, 0);
  const mistakes = played.reduce((s, h) => s + h.mistakes.length, 0);
  return {
    holes: played.length, gross, par, toPar: gross - par,
    girPct: girH.length ? girs / girH.length : null, girs, girN: girH.length,
    fwPct: tee.length ? fw / tee.length : null, fw, fwN: tee.length,
    scramblePct: scrambleH.length ? scrambles / scrambleH.length : null, scrambles, scrambleN: scrambleH.length,
    puttsPerHole: puttH.length ? putts / puttH.length : null, putts, puttN: puttH.length,
    trouble, mistakes,
  };
}

function computeStats(rounds) {
  const done = rounds.filter((r) => r.holes.some((h) => h.score != null));
  const nRounds = done.length;
  const holes = done.flatMap((r) => r.holes.filter((h) => h.score != null));
  const n18 = holes.length / 18;

  // tee
  const teeHoles = holes.filter((h) => h.par > 3 && h.tee.result);
  const tc = (k) => teeHoles.filter((h) => h.tee.result === k).length;
  const teeClubsUsed = [...new Set(teeHoles.map((h) => h.tee.club).filter(Boolean))];
  const byClub = teeClubsUsed.map((club) => {
    const hs = teeHoles.filter((h) => h.tee.club === club);
    return { club, n: hs.length, fw: hs.filter((h) => h.tee.result === "FWY").length };
  }).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);

  // approach + true GIR
  const girHoles = holes.filter(hasGIRData);
  const girs = girHoles.filter(isGIR).length;
  const appHoles = holes.filter((h) => h.app.result);
  const grid = {};
  APP_RESULTS.forEach(({ k }) => (grid[k] = appHoles.filter((h) => h.app.result === k).length));
  const girByDist = APP_DISTS.map(({ k, label }) => {
    const hs = girHoles.filter((h) => h.app.dist === k);
    return { k, label, n: hs.length, gir: hs.filter(isGIR).length };
  });
  const missHoles = appHoles.filter((h) => h.app.result !== "GRN" && h.app.missProx);
  const missProx = MISS_PROX.map(({ k, label }) => ({
    k, label, n: missHoles.filter((h) => h.app.missProx === k).length,
  }));
  const apprClubsUsedAgg = [...new Set(appHoles.map((h) => h.app.club).filter(Boolean))];
  const appByClub = apprClubsUsedAgg.map((club) => {
    const hs = appHoles.filter((h) => h.app.club === club);
    return { club, n: hs.length, gir: hs.filter(isGIR).length };
  }).sort((a, b) => b.n - a.n);

  // chipping (+ derived scrambling, sand saves)
  const chipHoles = holes.filter((h) => h.chip.prox);
  const chipDist = CHIP_PROX.map(({ k, label }) => ({
    k, label, n: chipHoles.filter((h) => h.chip.prox === k).length,
  }));
  const scrambleHoles = girHoles.filter((h) => !isGIR(h));
  const scrambles = scrambleHoles.filter((h) => h.score <= h.par).length;
  const sandHoles = holes.filter((h) => h.app.result === "BUNK" || (h.chip.bunker && hasGIRData(h)));
  const sandSaves = sandHoles.filter((h) => h.score <= h.par).length;
  const bunkerEscapeHoles = holes.filter((h) => h.app.result === "BUNK" && h.sand.outcome != null);
  const bunkerEscapes = bunkerEscapeHoles.filter((h) => h.sand.outcome !== "IN").length;

  // putting
  const puttHoles = holes.filter((h) => h.putts.count != null);
  const totalPutts = puttHoles.reduce((s, h) => s + h.putts.count, 0);
  const avgPerHole = puttHoles.length ? totalPutts / puttHoles.length : null;
  // per-round average over rounds that logged putts (normalized to the holes played that round)
  const roundPuttAvgs = done.map((r) => {
    const ph = r.holes.filter((h) => h.score != null && h.putts.count != null);
    return ph.length ? { putts: ph.reduce((s, h) => s + h.putts.count, 0), holes: ph.length } : null;
  }).filter(Boolean);
  const lagPutts = puttHoles.filter((h) => h.putts.first === "LAG" && h.putts.lagged != null);
  const lagOK = lagPutts.filter((h) => h.putts.lagged).length;
  const midPutts = puttHoles.filter((h) => h.putts.first === "MID" && h.putts.lagged != null);
  const midOK = midPutts.filter((h) => h.putts.lagged).length;
  const missedShort = holes.filter((h) => h.putts.missedShort).length;
  const madeBy = MADE_FROM.map(({ k, label }) => ({
    k, label, n: puttHoles.filter((h) => h.putts.madeFrom === k).length,
  }));
  const made34 = puttHoles.filter((h) => h.putts.madeFrom === "3-4").length;
  const shortMakeAtt = made34 + missedShort; // makes + misses from inside 4ft (excludes tap-ins)
  const threePuttBy = PUTT_FIRST.map(({ k, label }) => {
    const hs = puttHoles.filter((h) => h.putts.first === k);
    return { k, label, n: hs.length, three: hs.filter((h) => h.putts.count >= 3).length };
  });

  // decisions
  const decs = holes.filter((h) => h.dec.choice && h.dec.worked != null);
  const go = decs.filter((h) => h.dec.choice === "GO");
  const lay = decs.filter((h) => h.dec.choice === "LAY");

  // mistakes
  const mistakes = {};
  MISTAKE_CATS.forEach((c) => (mistakes[c] = 0));
  holes.forEach((h) => h.mistakes.forEach((c) => (mistakes[c] = (mistakes[c] || 0) + 1)));
  const totalMistakes = Object.values(mistakes).reduce((s, x) => s + x, 0);

  // trend + handicap
  const trend = done.map((r) => {
    const played = r.holes.filter((h) => h.score != null);
    const gross = played.reduce((s, h) => s + h.score, 0);
    const par = played.reduce((s, h) => s + h.par, 0);
    return { id: r.id, gross, par, toPar: gross - par, holes: played.length };
  });
  const { diffs, pending9 } = buildDifferentials(done);
  const index = whsIndex(diffs);

  return {
    nRounds, nHoles: holes.length, n18,
    tee: { n: teeHoles.length, fw: tc("FWY"), mL: tc("L"), mR: tc("R"), bunk: tc("BUNK"),
      trouble: tc("PEN") + tc("OB"), byClub },
    app: { n: appHoles.length, grid, girN: girHoles.length, girs, girByDist, missProx,
      missN: missHoles.length, byClub: appByClub },
    chip: { n: chipHoles.length, dist: chipDist,
      scrambleN: scrambleHoles.length, scrambles, sandN: sandHoles.length, sandSaves,
      bunkerEscapeN: bunkerEscapeHoles.length, bunkerEscapes },
    putt: { n: puttHoles.length, totalPutts, avgPerHole, roundPuttAvgs, lagN: lagPutts.length, lagOK,
      midN: midPutts.length, midOK, missedShort, threePuttBy,
      madeBy, made34, shortMakeAtt },
    dec: { go: { n: go.length, ok: go.filter((h) => h.dec.worked).length },
           lay: { n: lay.length, ok: lay.filter((h) => h.dec.worked).length } },
    mistakes, totalMistakes, trend, index, nDiffs: diffs.length, pending9,
  };
}

/* ---------- practice suggestion engine ---------- */
function computeSuggestions(s) {
  if (s.nRounds < 2 || s.nHoles < 18) return [{
    title: "Keep logging",
    why: "Two full rounds of data unlocks the practice plan.",
    drill: "Play, tap, repeat. The plan writes itself from your leaks.",
    cost: 0,
  }];
  const out = [];
  const per18 = (n) => n / s.n18;
  const rate = (n, d) => (d ? n / d : null);

  const msPer18 = per18(s.putt.missedShort);
  if (msPer18 >= 1) out.push({
    title: "Short putts under pressure",
    why: `You're missing about ${(s.putt.missedShort / Math.max(s.nRounds,1)).toFixed(1)} short putts a round — strokes handed back.`,
    drill: "Gate drill: two tees a ball-width past your putter head, 20 makes from 4 ft. Then a pressure ladder — 3, 4, 5, 6 ft, restart on any miss.",
    cost: msPer18,
  });

  const lagRate = rate(s.putt.lagOK, s.putt.lagN);
  if (s.putt.lagN >= 6 && lagRate < 0.6) out.push({
    title: "Lag putting distance control",
    why: `Only ${Math.round(lagRate * 100)}% of your 20+ footers finish inside 4 ft.`,
    drill: "Heads-up ladder: putt to 20, 30, 40 ft targets looking at the hole, not the ball. Score a point only inside 4 ft. 15 points to leave.",
    cost: (0.6 - lagRate) * per18(s.putt.lagN),
  });

  const lag3 = s.putt.threePuttBy.find((b) => b.k === "LAG");
  if (lag3 && lag3.n >= 6 && rate(lag3.three, lag3.n) > 0.25) out.push({
    title: "Eliminate the 3-putt",
    why: `${Math.round(rate(lag3.three, lag3.n) * 100)}% of long first putts become 3-putts.`,
    drill: "Two-putt circuit: 9 stations from 25–45 ft. Par is 18 putts; play it like a round.",
    cost: rate(lag3.three, lag3.n) * per18(lag3.n),
  });

  const chunkRate = rate((s.chip.dist.find((d) => d.k === "CHUNK")?.n || 0)
    + (s.chip.dist.find((d) => d.k === "BLADE")?.n || 0), s.chip.n);
  if (s.chip.n >= 8 && chunkRate > 0.12) out.push({
    title: "Chipping contact",
    why: `${Math.round(chunkRate * 100)}% of chips are chunked or bladed — each one is a full stroke.`,
    drill: "Low-point control: towel one grip-length behind the ball, brush the grass past it. 20 reps, then 10 chips landing on a towel target.",
    cost: chunkRate * per18(s.chip.n),
  });

  const sandRate = rate(s.chip.sandSaves, s.chip.sandN);
  if (s.chip.sandN >= 4 && sandRate != null && sandRate < 0.35) out.push({
    title: "Greenside bunkers",
    why: `Getting up and down from sand only ${Math.round(sandRate * 100)}% of the time.`,
    drill: "Draw a line in the sand, splash the sand (not the ball) — 15 reps hitting an inch behind. Then 10 shots to a target, aiming to two-putt-proof it inside 8 ft.",
    cost: (0.35 - sandRate) * per18(s.chip.sandN),
  });

  const scoringZone = s.app.girByDist.find((b) => b.k === "100-150");
  if (scoringZone && scoringZone.n >= 8 && rate(scoringZone.gir, scoringZone.n) < 0.45) out.push({
    title: "Scoring-zone wedges (100–150)",
    why: `Only ${Math.round(rate(scoringZone.gir, scoringZone.n) * 100)}% GIR from your no-excuses zone.`,
    drill: "Distance ladder: 5 balls each to 100 / 115 / 130 / 145 yd targets. Log carry distances — recalibrate the gaps, not the swing.",
    cost: (0.45 - rate(scoringZone.gir, scoringZone.n)) * per18(scoringZone.n) * 0.5,
  });

  const troublePer18 = per18(s.tee.trouble);
  if (troublePer18 >= 1.2) out.push({
    title: "Take the big number off the tee",
    why: `About ${(s.tee.trouble / Math.max(s.nRounds,1)).toFixed(1)} penalty or OB tee shots a round — at least a stroke each, usually two.`,
    drill: "Pick the club that finds grass, not the longest one. On range: 10-ball game, fairway-width gate, driver only counts if 7+ finish inside it.",
    cost: troublePer18 * 1.5,
  });

  const fwRate = rate(s.tee.fw, s.tee.n);
  if (s.tee.n >= 10 && fwRate < 0.45) {
    const side = s.tee.mL > s.tee.mR ? "left" : "right";
    out.push({
      title: `Start line — the ${side} miss`,
      why: `${Math.round(fwRate * 100)}% fairways, with the miss leaking ${side}.`,
      drill: `Alignment-stick gate 10 ft ahead of the ball. 20 drives; track how many start through the gate. Fix start line before fixing curve.`,
      cost: (0.45 - fwRate) * per18(s.tee.n) * 0.3,
    });
  }

  out.sort((a, b) => b.cost - a.cost);
  return out.length ? out.slice(0, 3) : [{
    title: "No glaring leaks",
    why: "Nothing in the data is screaming. Maintain, don't overhaul.",
    drill: "Spend practice on your scoring clubs: wedges and putter, 70/30.",
    cost: 0,
  }];
}

/* ---------- iOS UI primitives (themed) ---------- */
const ClubRail = ({ clubs, value, onChange }) => {
  const C = useTheme();
  return (
    <div style={{ position: "relative", margin: "0 -16px" }}>
      <div style={{
        display: "flex", gap: 9, overflowX: "auto", scrollbarWidth: "none",
        padding: "4px 16px 8px", WebkitOverflowScrolling: "touch",
      }}>
        <style>{`.ybrail::-webkit-scrollbar{display:none}`}</style>
        {clubs.map((c) => {
          const on = value === c;
          return (
            <button key={c} onClick={() => onChange(on ? null : c)} style={{
              fontFamily: SYS, fontSize: 17, fontWeight: 600, minHeight: 46,
              padding: "0 18px", borderRadius: 23, border: "none", cursor: "pointer",
              WebkitTapHighlightColor: "transparent", flexShrink: 0,
              background: on ? C.blue : C.fill,
              color: on ? "#fff" : C.label,
              transition: "background .12s",
            }}>{c}</button>
          );
        })}
      </div>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 24,
        background: `linear-gradient(to left, ${C.card}, transparent)`, pointerEvents: "none" }} />
    </div>
  );
};

const Chip = ({ on, tint = "blue", onClick, children }) => {
  const C = useTheme();
  return (
    <button onClick={onClick} style={{
      fontFamily: SYS, fontSize: 15, fontWeight: 500, padding: "8px 14px",
      borderRadius: 18, border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent",
      background: on ? C[tint === "gray" ? "label" : tint] : C.fill,
      color: on ? (C.mode === "dark" && tint === "gray" ? "#000" : "#fff") : C.label,
      transition: "background .12s",
    }}>{children}</button>
  );
};

const Header = ({ children }) => {
  const C = useTheme();
  return (
    <div style={{ fontFamily: SYS, fontSize: 13, color: C.secondary,
      textTransform: "uppercase", letterSpacing: "0.04em", margin: "22px 6px 8px" }}>
      {children}
    </div>
  );
};

const Card = ({ children, style, onClick }) => {
  const C = useTheme();
  return (
    <div onClick={onClick} style={{ background: C.card, borderRadius: 16, padding: 16,
      cursor: onClick ? "pointer" : "default", ...style }}>{children}</div>
  );
};

const Row = ({ children }) => (
  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{children}</div>
);

const useInputStyle = () => {
  const C = useTheme();
  return {
    width: "100%", boxSizing: "border-box", padding: "12px 13px", fontSize: 16,
    fontFamily: SYS, border: "none", borderRadius: 12, background: C.bg,
    color: C.label, outline: "none",
  };
};
const btn = (bg, color = "#fff") => ({
  width: "100%", padding: "15px", fontSize: 17, fontWeight: 600, borderRadius: 14,
  border: "none", cursor: "pointer", background: bg, color, fontFamily: SYS,
});

const BackBtn = ({ onClick, label = "Home" }) => {
  const C = useTheme();
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer",
      color: C.blue, fontSize: 17, fontFamily: SYS, padding: 0, display: "flex",
      alignItems: "center", gap: 2, marginBottom: 6 }}>
      <span style={{ fontSize: 22, lineHeight: 1, marginTop: -2 }}>‹</span> {label}
    </button>
  );
};

const Seg = ({ options, value, onChange }) => {
  const C = useTheme();
  return (
    <div style={{ display: "flex", background: C.fill, borderRadius: 10, padding: 2 }}>
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          flex: 1, padding: "7px 0", fontSize: 14, fontWeight: value === k ? 600 : 400,
          fontFamily: SYS, border: "none", borderRadius: 8, cursor: "pointer",
          background: value === k ? (C.mode === "dark" ? "#636366" : "#fff") : "transparent",
          color: C.label, boxShadow: value === k ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
        }}>{l}</button>
      ))}
    </div>
  );
};

/* ---------- home dashboard ---------- */
function BagSettings({ bag, onChange, onClose }) {
  const C = useTheme();
  const [list, setList] = useState(() => (bag && bag.length ? bag.map((c) => ({ ...c })) : DEFAULT_BAG.map((c) => ({ ...c }))));

  const toggle = (i, key) => setList((L) => L.map((c, j) => j === i ? { ...c, [key]: !c[key] } : c));
  const rename = (i, name) => setList((L) => L.map((c, j) => j === i ? { ...c, name } : c));
  const remove = (i) => setList((L) => L.filter((_, j) => j !== i));
  const add = () => setList((L) => [...L, { name: "", tee: false, appr: true }]);
  const reset = () => setList(DEFAULT_BAG.map((c) => ({ ...c })));
  const save = () => {
    onChange(list.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name));
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70,
      background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center",
      animation: "ybDim .2s ease-out" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, width: "100%", maxWidth: 480,
        borderRadius: "22px 22px 0 0", padding: "20px 16px", maxHeight: "88vh", overflowY: "auto",
        animation: "ybUp .28s cubic-bezier(.2,.9,.3,1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.label }}>My Bag</div>
          <button onClick={save} style={{ ...btn(C.blue), padding: "9px 18px", fontSize: 15, width: "auto" }}>Done</button>
        </div>
        <div style={{ fontSize: 13, color: C.secondary, marginBottom: 14 }}>
          Tap a name to edit it. Tag each club for tee, approach, or both.
        </div>

        <div style={{ display: "flex", gap: 8, fontSize: 11, color: C.tertiary, fontWeight: 600,
          padding: "0 4px 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div style={{ flex: 1 }}>Club</div>
          <div style={{ width: 56, textAlign: "center" }}>Tee</div>
          <div style={{ width: 56, textAlign: "center" }}>Appr</div>
          <div style={{ width: 30 }} />
        </div>

        {list.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.card,
            borderRadius: 12, padding: "8px 10px", marginBottom: 6 }}>
            <input value={c.name} placeholder="Club name"
              onChange={(e) => rename(i, e.target.value)}
              style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: C.label,
                background: "transparent", border: "none", outline: "none", fontFamily: SYS,
                padding: "6px 2px" }} />
            {["tee", "appr"].map((k) => (
              <button key={k} onClick={() => toggle(i, k)} style={{ width: 56, height: 34, borderRadius: 9,
                border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700, flexShrink: 0,
                background: c[k] ? (k === "tee" ? C.blue : C.green) : C.fill,
                color: c[k] ? "#fff" : C.tertiary }}>{c[k] ? "✓" : "–"}</button>
            ))}
            <button onClick={() => remove(i)} style={{ width: 30, height: 34, borderRadius: 9, border: "none",
              cursor: "pointer", background: "transparent", color: C.red, fontSize: 20, flexShrink: 0 }}>×</button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={add} style={{ ...btn(C.fill, C.blue), flex: 1, padding: 12, fontSize: 15 }}>+ Add club</button>
          <button onClick={reset} style={{ ...btn(C.fill, C.secondary), flex: 1, padding: 12, fontSize: 15 }}>Reset to default</button>
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function Home({ data, stats, onTeeOff, onResume, theme, onToggleTheme, goTrends, onImport, onOpenBag }) {
  const C = useTheme();
  const s = stats;
  const last = s.trend[s.trend.length - 1];
  const pct = (n, d) => (d ? Math.round((n / d) * 100) + "%" : "—");
  const active = data.activeRound;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "4px 2px 14px" }}>
        <div>
          <div style={{ fontFamily: SYS, fontSize: 32, fontWeight: 700, color: C.label }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onOpenBag} aria-label="Configure bag" style={{
            width: 36, height: 36, borderRadius: 18, border: "none", cursor: "pointer",
            background: C.fill, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.label} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {/* golf club: shaft + head */}
              <line x1="8" y1="2.5" x2="14" y2="15" />
              <path d="M14 15c0 2-1.4 3.4-3.2 3.4S7.6 17.2 7.6 15.4c0-.9.5-1.6 1.3-1.9" />
              <circle cx="8.4" cy="21" r="1" fill={C.label} stroke="none" />
            </svg>
          </button>
          <button onClick={onToggleTheme} aria-label="Toggle appearance" style={{
            width: 36, height: 36, borderRadius: 18, border: "none", cursor: "pointer",
            background: C.fill, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.label} strokeWidth="1.8" strokeLinecap="round">
              {theme === "dark"
                ? (<><circle cx="12" cy="12" r="4.5" /><line x1="12" y1="2.5" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21.5" /><line x1="2.5" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21.5" y2="12" /><line x1="5.3" y1="5.3" x2="7" y2="7" /><line x1="17" y1="17" x2="18.7" y2="18.7" /><line x1="5.3" y1="18.7" x2="7" y2="17" /><line x1="17" y1="7" x2="18.7" y2="5.3" /></>)
                : <path d="M20 13.5A8 8 0 0 1 10.5 4 6.8 6.8 0 1 0 20 13.5Z" />}
            </svg>
          </button>
        </div>
      </div>

      {/* hero: handicap + last round */}
      <Card onClick={goTrends}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: C.secondary, display: "flex", alignItems: "center", gap: 6 }}>
              Handicap index
              {s.index != null && handicapBasis(s.nDiffs).provisional && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff",
                  background: C.orange, padding: "2px 7px", borderRadius: 8 }}>PROVISIONAL</span>
              )}
            </div>
            <div style={{ fontSize: 42, fontWeight: 700, color: C.label, lineHeight: 1.1 }}>
              {s.index != null ? s.index.toFixed(1) : "—"}
            </div>
            <div style={{ fontSize: 12, color: C.secondary }}>
              {s.index != null
                ? (handicapBasis(s.nDiffs).provisional
                    ? `based on your best ${handicapBasis(s.nDiffs).used} of ${s.nDiffs} rounds`
                    : `best 8 of last 20 rounds`)
                : s.nRounds ? `${Math.max(0, 3 - s.nDiffs)} more rounds needed` : "Play a round to start"}
            </div>
          </div>
          {last && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: C.secondary }}>Last round</div>
              <div style={{ fontSize: 28, fontWeight: 700,
                color: last.toPar < 0 ? C.red : last.toPar === 0 ? C.green : C.label }}>
                {last.gross} <span style={{ fontSize: 15, fontWeight: 500, color: C.secondary }}>{fmtToPar(last.toPar)}</span>
              </div>
              <div style={{ fontSize: 12, color: C.secondary }}>{last.holes} holes</div>
            </div>
          )}
        </div>
      </Card>

      {/* quick stats strip */}
      {s.nRounds > 0 && (
        <Card style={{ marginTop: 10, display: "flex" }}>
          {[
            ["GIR", pct(s.app.girs, s.app.girN), C.green],
            ["Fairways", pct(s.tee.fw, s.tee.n), C.blue],
            ["Putts/hole", s.putt.avgPerHole != null ? s.putt.avgPerHole.toFixed(2) : "—", C.label],
            ["Scramble", pct(s.chip.scrambles, s.chip.scrambleN), C.orange],
          ].map(([l, v, tint]) => (
            <div key={l} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: tint }}>{v}</div>
              <div style={{ fontSize: 11, color: C.secondary }}>{l}</div>
            </div>
          ))}
        </Card>
      )}

      {/* tee off / resume */}
      <div style={{ marginTop: 14 }}>
        {active ? (
          <button onClick={onResume} style={btn(C.green)}>
            Resume Round — {active.courseName}
          </button>
        ) : (
          <button onClick={onTeeOff} style={btn(C.blue)}>Tee Off</button>
        )}
      </div>

      <Backup data={data} onImport={onImport} />
      <div style={{ textAlign: "center", fontSize: 11, color: C.tertiary, margin: "18px 0 4px" }}>
        {APP_NAME} · {APP_BYLINE}
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}

/* ---------- backup / restore ---------- */
function Backup({ data, onImport }) {
  const C = useTheme();
  const inputStyle = useInputStyle();
  const fileRef = useRef(null);
  const [fallback, setFallback] = useState(null); // null | 'export' | 'import'
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState("green");

  const payload = () => JSON.stringify({ app: "yardage-book", version: 4,
    exported: new Date().toISOString(), courses: data.courses, rounds: data.rounds });

  const note = (m, tone = "green") => { setMsg(m); setMsgTone(tone); };

  const doExport = () => {
    const str = payload();
    try {
      const blob = new Blob([str], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `yardage-book-${stamp}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      note(`Saved yardage-book-${stamp}.json — ${data.rounds.length} rounds.`);
    } catch (e) {
      // download blocked — fall back to copyable text
      setText(str); setFallback("export");
      try { navigator.clipboard.writeText(str); } catch (_) {}
      note("Download blocked here — copy the text below instead.", "red");
    }
  };

  const ingest = (str) => {
    try {
      const d = JSON.parse(str);
      if (!Array.isArray(d.rounds)) throw new Error("bad");
      onImport(d);
      note(`Restored ${d.rounds.length} rounds and ${d.courses?.length || 0} courses.`);
      setText(""); setFallback(null);
    } catch (e) {
      note("That file isn't a valid Yardage Book backup.", "red");
    }
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result));
    reader.onerror = () => note("Couldn't read that file.", "red");
    reader.readAsText(f);
    e.target.value = ""; // allow re-picking the same file
  };

  return (
    <div>
      <Header>Backup</Header>
      <Card>
        <div style={{ fontSize: 13, color: C.secondary, lineHeight: 1.45, marginBottom: 12 }}>
          Export saves all rounds and courses as a file you can keep in Files, iCloud, or email.
          Import restores from one of those files, replacing what's here. Back up before any major change.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={doExport} style={{ ...btn(C.blue), padding: 12, fontSize: 15 }}>Export to File</button>
          <button onClick={() => { setFallback(null); setMsg(""); fileRef.current && fileRef.current.click(); }}
            style={{ ...btn(C.fill, C.blue), padding: 12, fontSize: 15 }}>Import from File</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json"
          onChange={onFile} style={{ display: "none" }} />

        <button onClick={() => { setFallback(fallback ? null : "import"); setText(""); setMsg(""); }}
          style={{ background: "none", border: "none", color: C.secondary, fontSize: 13,
            fontFamily: SYS, cursor: "pointer", padding: "10px 0 0" }}>
          {fallback ? "Hide text option" : "Trouble with files? Use text instead"}
        </button>

        {fallback && (
          <div style={{ marginTop: 6 }}>
            {fallback === "export"
              ? <textarea value={text} readOnly style={{ ...inputStyle, height: 96, resize: "vertical",
                  fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
              : <>
                  <textarea value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="Paste backup text here" style={{ ...inputStyle, height: 96, resize: "vertical",
                    fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
                  <button onClick={() => ingest(text)} style={{ ...btn(C.red), padding: 11, fontSize: 15, marginTop: 8 }}>
                    Restore from Text — Replaces Current Data
                  </button>
                </>}
            {fallback === "export" && (
              <button onClick={() => setText(payload())} style={{ ...btn(C.fill, C.blue), padding: 10, fontSize: 14, marginTop: 8 }}>
                Show export text
              </button>
            )}
          </div>
        )}
        {msg && <div style={{ fontSize: 13, color: C[msgTone], marginTop: 10 }}>{msg}</div>}
      </Card>
    </div>
  );
}

/* ---------- celebrations ---------- */
const CONFETTI = ["#34C759", "#007AFF", "#FF9500", "#FF3B30", "#C9A24B", "#5B8DBE"];
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* reads everything logged on a hole and returns a contextual, witty reaction */
function holeStory(h) {
  const d = h.score - h.par;
  const tee = h.tee.result;
  const penalty = tee === "PEN" || tee === "OB" || h.app.result === "PEN";
  const teeBunk = tee === "BUNK";
  const fairway = tee === "FWY";
  const gir = hasGIRData(h) && isGIR(h);
  const missGreen = h.app.result && h.app.result !== "GRN";
  const chunk = h.chip.prox === "CHUNK" || h.chip.prox === "BLADE";
  const chipClose = h.chip.prox === "P4";
  const sand = h.chip.bunker || h.app.result === "BUNK";
  const putts = h.putts.count;
  const onePutt = putts === 1;
  const threePutt = putts != null && putts >= 3;
  const missedShort = h.putts.missedShort;
  const scrambled = missGreen && d <= 0;

  // tier sets the graphic, color, size, and headline
  let tier;
  if (d <= -2) tier = { key: "eagle", emoji: "🦅", head: d <= -3 ? "Albatross?!" : "Eagle", color: "green", big: true };
  else if (d === -1) tier = { key: "birdie", emoji: "🔥", head: "Birdie", color: "green", big: true };
  else if (d === 0) tier = { key: "par", emoji: "⛳", head: "Par", color: "blue", big: false };
  else if (d === 1) tier = { key: "bogey", emoji: "😮‍💨", head: "Bogey", color: "label", big: false };
  else if (d === 2) tier = { key: "double", emoji: "😅", head: "Double", color: "orange", big: false };
  else tier = { key: "blowup", emoji: "🙈", head: d >= 4 ? "Let's keep walking" : "Triple", color: "red", big: false };

  // build a pool of context-aware lines, most colorful first; pick the top applicable bucket
  let lines;
  if (tier.key === "eagle") {
    lines = onePutt ? ["Eagle, and you holed it. Print money.", "Two under on one hole. Outrageous."]
      : ["Eagle. Frame the scorecard.", "Two under par. Who hurt the course?"];
  } else if (tier.key === "birdie") {
    if (sand && d <= -1) lines = ["Birdie out of the sand. Absolutely filthy.", "Splash-and-dash for birdie. Showoff."];
    else if (onePutt && gir) lines = ["Green in reg and drained the putt. Textbook.", "Stuck it, made it. Birdie the easy way."];
    else if (chunk) lines = ["Chunked the chip and STILL made birdie? Unfair.", "Birdie despite the heavy chip. We won't ask."];
    else if (penalty) lines = ["Birdie after a wayward one off the tee. Resilient.", "Lost a ball, made a birdie. Golf is chaos."];
    else if (scrambled) lines = ["Missed the green, birdied it anyway. Houdini.", "Scrambled into a birdie. Cold-blooded."];
    else lines = ["Birdie. Stripe show.", "One under. Do it again.", "Birdie. The good kind of red number."];
  } else if (tier.key === "par") {
    if (scrambled && sand) lines = ["Up and down from the bunker for par. Clutch.", "Sand save par. The short game showed up."];
    else if (scrambled) lines = ["Missed the green, saved par. Houdini act.", "Scrambled to par. Grinders gonna grind."];
    else if (threePutt) lines = ["Three putts and still a par? Generous hole.", "Par, no thanks to the flat stick."];
    else if (penalty) lines = ["Par after a tee shot adventure. We'll take it.", "Survived the trouble for par. Bend, don't break."];
    else if (gir && onePutt) lines = ["Green in reg, easy two-putt — wait, one putt. Tidy.", "Routine par, executed cleanly."];
    else if (fairway && gir) lines = ["Fairway, green, par. Boring golf is good golf.", "Textbook par. Nothing to see here."];
    else lines = ["Par.", "Routine. Onward.", "Steady par. Keep stacking them."];
  } else if (tier.key === "bogey") {
    if (missedShort) lines = ["Bogey, and that short putt stung. Shake it off.", "The 4-footer got away. Bogey. Next."];
    else if (threePutt) lines = ["Three-jacked for bogey. The greens are winning.", "Bogey courtesy of the putter. It happens."];
    else if (penalty) lines = ["Bogey after the trouble. Could've been worse.", "Damage controlled to a bogey. Take it."];
    else if (chunk) lines = ["The chunked chip cost you one. Bogey. Move on.", "Heavy chip, bogey. We've all been there."];
    else lines = ["Bogey. We've seen worse.", "One over. No big deal, regroup.", "Bogey. Onward to the next tee."];
  } else if (tier.key === "double") {
    if (penalty) lines = ["Double after losing one. Breathe. Reset.", "The penalty bit hard. Double. Let it go."];
    else if (threePutt) lines = ["Double with a three-putt cherry on top. Ouch.", "Greens are being cruel. Double. Walk it off."];
    else lines = ["Double. Shake it off, the round's not over.", "Double bogey. Deep breath, next tee.", "Double. Even the pros make them."];
  } else {
    lines = penalty ? ["The course won that hole. Onto the next.", "Big number after the trouble. It's golf. Reset."]
      : ["That one stays in the vault. Keep walking.", "Scribble it down, don't dwell. Next tee.", "We don't talk about that hole. Onward."];
  }
  return { ...tier, d, line: pick(lines) };
}

function HoleReaction({ hole, onDone }) {
  const C = useTheme();
  const story = useState(() => holeStory(hole))[0];
  const big = story.big;
  const [pieces] = useState(() => big
    ? Array.from({ length: 26 }, () => ({
        left: 8 + Math.random() * 84, delay: Math.random() * 0.25,
        dur: 1.0 + Math.random() * 0.8, color: pick(CONFETTI),
        size: 7 + Math.random() * 7, drift: (Math.random() - 0.5) * 40,
      })) : []);

  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 55,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.28)", animation: "ybDim .2s ease-out" }}>
      {pieces.map((p, i) => (
        <div key={i} style={{ position: "absolute", top: "26%", left: `${p.left}%`,
          width: p.size, height: p.size * 1.4, background: p.color, borderRadius: 2,
          transform: `translateX(${p.drift}px)`,
          animation: `ybFall ${p.dur}s ${p.delay}s cubic-bezier(.3,.1,.3,1) forwards` }} />
      ))}
      <div style={{ background: C.card, color: C.label, textAlign: "center",
        border: `2.5px solid ${C[story.color] || C.label}`,
        padding: big ? "26px 30px 22px" : "22px 26px", borderRadius: 24,
        maxWidth: 320, margin: 20, boxShadow: "0 16px 50px rgba(0,0,0,0.4)",
        animation: "ybBounce .5s cubic-bezier(.2,1.4,.4,1)" }}>
        <div style={{ fontSize: big ? 68 : 52, lineHeight: 1, marginBottom: 8 }}>{story.emoji}</div>
        <div style={{ fontSize: big ? 30 : 25, fontWeight: 800, color: C[story.color] || C.label,
          marginBottom: 6 }}>
          {story.head}
          <span style={{ fontSize: 18, fontWeight: 600, color: C.secondary, marginLeft: 8 }}>
            {fmtToPar(story.d)}
          </span>
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.4, color: C.label }}>{story.line}</div>
        <div style={{ fontSize: 12, color: C.tertiary, marginTop: 14 }}>tap to continue</div>
      </div>
    </div>
  );
}

/* dry, encouraging tee-off line that references a real bright spot from the last round */
function teeQuip(rounds) {
  const generic = [
    "Find some fairways. Or don't. We'll log it either way.",
    "Let's go make the spreadsheet proud.",
    "Keep it in play and the rest sorts itself out.",
    "New round, clean scorecard. No mistakes yet — savor it.",
    "Eighteen fresh chances to disappoint the handicap. Go.",
  ];
  const done = rounds.map((r) => roundStats(r)).filter(Boolean);
  if (!done.length) return pick([
    "First one in the books starts now. No pressure.",
    "Tee it up. The data has to start somewhere.",
  ]);

  const last = done[done.length - 1];
  const lines = [];
  if (last.girPct != null && last.girPct >= 0.5)
    lines.push(`You hit ${Math.round(last.girPct * 100)}% of greens last time. The irons remember. Go again.`);
  if (last.puttsPerHole != null && last.puttsPerHole <= 1.72)
    lines.push(`${last.putts} putts over ${last.holes} last round — the flat stick was behaving. Bottle it.`);
  if (last.fwPct != null && last.fwPct >= 0.55)
    lines.push(`${Math.round(last.fwPct * 100)}% fairways last time. Boring and effective. Do it again.`);
  if (last.scramblePct != null && last.scramblePct >= 0.5)
    lines.push("Last round your short game bailed you out. Hopefully it shows up sober today.");
  if (last.toPar != null && last.toPar <= 3)
    lines.push(`Last card was ${fmtToPar(last.toPar)}. Pretend that wasn't a fluke.`);
  if (last.trouble === 0 && last.holes >= 9)
    lines.push("Zero balls lost last round. Let's keep the search parties home.");

  // if nothing was notably good, gently roast the leak instead
  if (!lines.length) {
    if (last.puttsPerHole != null && last.puttsPerHole >= 2.0)
      lines.push("The putter owes you from last time. Today it pays up.");
    else if (last.trouble >= 2)
      lines.push("Last round had a couple of adventures. Aim for the boring version.");
    else
      lines.push("Last round was fine. Fine is underrated. Go be fine again.");
  }

  // blend: usually the personalized line, occasionally a generic dry one
  return Math.random() < 0.75 ? pick(lines) : pick(generic);
}

function finishQuip(rs) {
  const lines = [];
  if (rs.puttsPerHole != null) {
    if (rs.puttsPerHole <= 1.6) lines.push("The putter cooperated for once.");
    else if (rs.puttsPerHole >= 2.05) lines.push(`${rs.putts} putts over ${rs.holes}. The greens won today.`);
  }
  if (rs.girPct != null && rs.girPct >= 0.5) lines.push("Greens in regulation like you meant it.");
  if (rs.scramblePct != null && rs.scramblePct >= 0.5) lines.push("Short game bailed you out. Again.");
  if (rs.trouble >= 2) lines.push("A couple balls donated to the course. It happens.");
  if (rs.fwPct != null && rs.fwPct >= 0.6) lines.push("Fairways found. Boring golf is good golf.");
  if (!lines.length) lines.push("Logged. Onto the next one.");
  return pick(lines);
}

function SignaturePad({ onSigned }) {
  const C = useTheme();
  const ref = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
    const ctx = cvs.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = C.blue;
    cvs._ctx = ctx; cvs._rect = rect;
  }, []);

  const pos = (e) => {
    const cvs = ref.current;
    const r = cvs.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = ref.current._ctx; const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p; dirty.current = true;
  };
  const end = () => { drawing.current = false; };

  return (
    <div>
      <div style={{ position: "relative", marginTop: 14 }}>
        <canvas ref={ref}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          style={{ width: "100%", height: 110, background: C.bg, borderRadius: 14,
            border: `1.5px dashed ${C.line}`, touchAction: "none", display: "block" }} />
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 30,
          borderBottom: `1px solid ${C.tertiary}`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 16, bottom: 12, fontSize: 11, color: C.tertiary,
          pointerEvents: "none" }}>✗ sign here</div>
      </div>
      <button onClick={() => onSigned()} style={{ ...btn(C.green), marginTop: 12 }}>
        Sign & Post Score
      </button>
    </div>
  );
}

function RoundFlash({ flash, onDone }) {
  const C = useTheme();
  const big = flash.kind === "finish";
  const [pieces] = useState(() => big
    ? Array.from({ length: 30 }, () => ({
        left: 6 + Math.random() * 88, delay: Math.random() * 0.4,
        dur: 1.1 + Math.random() * 0.9, color: pick(CONFETTI),
        size: 7 + Math.random() * 8, drift: (Math.random() - 0.5) * 50,
      })) : []);
  return (
    <div onClick={big ? undefined : onDone} style={{ position: "fixed", inset: 0, zIndex: 60,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
      animation: "ybDim .25s ease-out", padding: 24 }}>
      {pieces.map((p, i) => (
        <div key={i} style={{ position: "absolute", top: "18%", left: `${p.left}%`,
          width: p.size, height: p.size * 1.4, background: p.color, borderRadius: 2,
          transform: `translateX(${p.drift}px)`,
          animation: `ybFall ${p.dur}s ${p.delay}s cubic-bezier(.3,.1,.3,1) forwards` }} />
      ))}
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, borderRadius: 26, padding: big ? "34px 28px 26px" : "30px 30px 24px",
        textAlign: "center", maxWidth: 380, width: "100%", boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
        animation: "ybBounce .55s cubic-bezier(.2,1.4,.4,1)" }}>
        <div style={{ fontSize: big ? 64 : 52, lineHeight: 1, marginBottom: 10 }}>{flash.emoji}</div>
        <div style={{ fontSize: 13, color: C.secondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {flash.eyebrow}
        </div>
        <div style={{ fontSize: big ? 56 : 30, fontWeight: 800, color: C.label,
          lineHeight: 1.1, margin: "6px 0 4px" }}>
          {flash.title}
          {flash.toPar != null && (
            <span style={{ fontSize: 24, fontWeight: 700, marginLeft: 8,
              color: flash.toPar < 0 ? C.red : flash.toPar === 0 ? C.green : C.secondary }}>
              {fmtToPar(flash.toPar)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.4, color: C.label, marginTop: 8 }}>{flash.sub}</div>
        {big ? (
          <SignaturePad onSigned={onDone} />
        ) : (
          <div style={{ fontSize: 12, color: C.tertiary, marginTop: 16 }}>tap to dismiss</div>
        )}
      </div>
    </div>
  );
}

/* ---------- round setup ---------- */
function RoundSetup({ courses, onStart, onSaveCourse, onUpdateCourse, onDeleteCourse, onBack }) {
  const C = useTheme();
  const inputStyle = useInputStyle();
  const [mode, setMode] = useState(courses.length ? "pick" : "new");
  const [holesType, setHolesType] = useState("18");
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [rating, setRating] = useState("72.0");
  const [slope, setSlope] = useState("125");
  const [pars, setPars] = useState(Array(18).fill(4));
  const [confirmDel, setConfirmDel] = useState(false);

  const cyclePar = (i) => setPars((p) => p.map((v, j) => (j === i ? (v === 5 ? 3 : v + 1) : v)));
  const totalPar = pars.reduce((s, x) => s + x, 0);

  const startEdit = (c) => {
    setEditingId(c.id); setName(c.name); setRating(String(c.rating));
    setSlope(String(c.slope)); setPars([...c.pars]); setConfirmDel(false); setMode("new");
  };
  const resetForm = () => {
    setEditingId(null); setName(""); setRating("72.0"); setSlope("125");
    setPars(Array(18).fill(4)); setConfirmDel(false);
  };
  const save = () => {
    const course = { id: editingId || uid(), name: name.trim() || "New course",
      rating: parseFloat(rating) || 72, slope: parseInt(slope) || 113, pars: [...pars] };
    if (editingId) { onUpdateCourse(course); resetForm(); setMode("pick"); }
    else { onSaveCourse(course); onStart(course, holesType); }
  };

  return (
    <div>
      <BackBtn onClick={onBack} />
      <div style={{ fontFamily: SYS, fontSize: 28, fontWeight: 700, color: C.label, margin: "0 2px 12px" }}>
        New Round
      </div>
      <Header>Holes</Header>
      <Card><Seg options={[["F9", "Front 9"], ["B9", "Back 9"], ["18", "Full 18"]]} value={holesType} onChange={setHolesType} /></Card>

      {courses.length > 0 && (<>
        <Header>Course</Header>
        <Card><Seg options={[["pick", "Saved"], ["new", editingId ? "Edit course" : "New course"]]} value={mode}
          onChange={(k) => { if (k === "new" && mode === "pick") resetForm(); setMode(k); }} /></Card>
      </>)}

      {mode === "pick" ? (
        <Card style={{ marginTop: 8, padding: 0, overflow: "hidden" }}>
          {courses.map((c, idx) => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", padding: "11px 16px",
              borderBottom: idx < courses.length - 1 ? `0.5px solid ${C.line}` : "none",
            }}>
              <div onClick={() => onStart(c, holesType)} style={{ flex: 1, cursor: "pointer" }}>
                <div style={{ fontSize: 16, color: C.label }}>{c.name}</div>
                <div style={{ fontSize: 13, color: C.secondary }}>
                  Par {c.pars.reduce((s, x) => s + x, 0)} · {c.rating} / {c.slope}
                </div>
              </div>
              <button onClick={() => startEdit(c)} style={{ background: "none", border: "none",
                color: C.blue, fontSize: 15, fontFamily: SYS, cursor: "pointer", padding: "8px 10px" }}>
                Edit
              </button>
              <span onClick={() => onStart(c, holesType)} style={{ color: C.tertiary, fontSize: 20, cursor: "pointer" }}>›</span>
            </div>
          ))}
        </Card>
      ) : (
        <Card style={{ marginTop: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name" style={inputStyle} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input value={rating} onChange={(e) => setRating(e.target.value)} inputMode="decimal" placeholder="Rating" style={inputStyle} />
            <input value={slope} onChange={(e) => setSlope(e.target.value)} inputMode="numeric" placeholder="Slope" style={inputStyle} />
          </div>
          <div style={{ fontSize: 13, color: C.secondary, margin: "14px 0 6px" }}>
            Pars — tap to cycle 3·4·5 (total {totalPar})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 5 }}>
            {pars.map((p, i) => (
              <button key={i} onClick={() => cyclePar(i)} style={{
                fontFamily: SYS, fontSize: 15, fontWeight: 600, padding: "10px 0",
                borderRadius: 10, border: "none", cursor: "pointer", background: C.bg,
                color: p === 3 ? C.blue : p === 5 ? C.orange : C.label,
              }}>{p}</button>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={save} style={btn(C.blue)}>
              {editingId ? "Save Changes" : "Save & Tee Off"}
            </button>
            {editingId && (confirmDel
              ? <button onClick={() => { onDeleteCourse(editingId); resetForm(); setMode("pick"); }}
                  style={btn(C.red)}>Confirm Delete Course</button>
              : <button onClick={() => setConfirmDel(true)}
                  style={btn(C.fill, C.red)}>Delete Course</button>)}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- hole logger ---------- */
function HoleLogger({ round, onUpdate, onFinish, onBack, isEdit, bag }) {
  const teeClubs = (bag || DEFAULT_BAG).filter((c) => c.tee).map((c) => c.name);
  const apprClubs = (bag || DEFAULT_BAG).filter((c) => c.appr).map((c) => c.name);
  const C = useTheme();
  const inputStyle = useInputStyle();
  const [i, setI] = useState(() => {
    const idx = round.holes.findIndex((h) => h.score == null);
    return idx === -1 ? round.holes.length - 1 : idx;
  });
  const [showDec, setShowDec] = useState(false);
  const [reaction, setReaction] = useState(null);
  const h = round.holes[i];
  const holeNum = (round.startHole || 1) + i;
  const par3 = h.par === 3;

  const set = (patch) => onUpdate({ ...round, holes: round.holes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setSub = (key, patch) => set({ [key]: { ...h[key], ...patch } });

  const played = round.holes.filter((x) => x.score != null);
  const runToPar = played.reduce((s, x) => s + (x.score - x.par), 0);
  const score = h.score ?? h.par;
  const decRelevant = h.par === 5 || showDec || h.dec.choice;
  const missedGreen = h.app.result && h.app.result !== "GRN";
  const approachBunker = h.app.result === "BUNK";
  const lagRelevant = h.putts.first === "MID" || h.putts.first === "LAG";
  const toggleMistake = (cat) =>
    set({ mistakes: h.mistakes.includes(cat) ? h.mistakes.filter((c) => c !== cat) : [...h.mistakes, cat] });
  useEffect(() => {
    setShowDec(false);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
  }, [i]);

  const stepBtn = {
    width: 54, height: 54, borderRadius: 27, fontSize: 26, fontWeight: 500, cursor: "pointer",
    border: "none", background: C.fill, color: C.blue, fontFamily: SYS,
  };

  return (
    <div>
      {reaction && <HoleReaction key={reaction.key} hole={reaction.hole} onDone={() => setReaction(null)} />}
      <BackBtn onClick={onBack} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 2px" }}>
        <div style={{ fontFamily: SYS, fontSize: 28, fontWeight: 700, color: C.label }}>
          Hole {holeNum} <span style={{ fontSize: 17, fontWeight: 400, color: C.secondary }}>Par {h.par}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 600,
          color: runToPar < 0 ? C.red : runToPar === 0 ? C.green : C.label }}>
          {played.length ? `${fmtToPar(runToPar)} thru ${played.length}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 3, margin: "10px 2px 0" }}>
        {round.holes.map((x, j) => (
          <div key={j} onClick={() => setI(j)} style={{
            flex: 1, height: 4, borderRadius: 2, cursor: "pointer",
            background: j === i ? C.blue : x.score != null ? C.green : C.fill,
          }} />
        ))}
      </div>

      {!par3 && (<>
        <Header>Off the Tee</Header>
        <Card>
          <div style={{ fontSize: 13, color: C.secondary, margin: "0 0 6px" }}>Club</div>
          <ClubRail clubs={teeClubs} value={h.tee.club}
            onChange={(club) => setSub("tee", { club })} />
          <div style={{ height: 4 }} />
          <div style={{ fontSize: 13, color: C.secondary, margin: "0 0 6px" }}>Result</div>
          <Row>{TEE_RESULTS.map((r) => (
            <Chip key={r.k} tint={r.bad ? "red" : r.good ? "green" : "blue"} on={h.tee.result === r.k}
              onClick={() => setSub("tee", { result: h.tee.result === r.k ? null : r.k })}>{r.label}</Chip>
          ))}</Row>
        </Card>
      </>)}

      <Header>Approach{par3 ? " (tee shot)" : ""}</Header>
      <Card>
        <div style={{ fontSize: 13, color: C.secondary, margin: "0 0 6px" }}>Club</div>
        <ClubRail clubs={apprClubs} value={h.app.club}
          onChange={(club) => setSub("app", { club })} />
        <div style={{ height: 4 }} />
        <div style={{ fontSize: 13, color: C.secondary, margin: "0 0 6px" }}>Distance</div>
        <Row>{APP_DISTS.map((d) => (
          <Chip key={d.k} on={h.app.dist === d.k}
            onClick={() => setSub("app", { dist: h.app.dist === d.k ? null : d.k })}>{d.label}</Chip>
        ))}</Row>
        <div style={{ height: 10 }} />
        <div style={{ fontSize: 13, color: C.secondary, margin: "0 0 6px" }}>Result</div>
        <Row>{APP_RESULTS.map((r) => (
          <Chip key={r.k} tint={r.bad ? "red" : r.good ? "green" : r.sand ? "orange" : "blue"} on={h.app.result === r.k}
            onClick={() => setSub("app", { result: h.app.result === r.k ? null : r.k, missProx: r.k === "GRN" ? null : h.app.missProx })}>{r.label}</Chip>
        ))}</Row>
        {missedGreen && !approachBunker && (<>
          <div style={{ fontSize: 13, color: C.secondary, margin: "12px 0 6px" }}>How close did it finish?</div>
          <Row>{MISS_PROX.map((m) => (
            <Chip key={m.k} on={h.app.missProx === m.k}
              onClick={() => setSub("app", { missProx: h.app.missProx === m.k ? null : m.k })}>{m.label}</Chip>
          ))}</Row>
        </>)}
      </Card>

      {decRelevant ? (<>
        <Header>Decision</Header>
        <Card>
          <Row>
            <Chip on={h.dec.choice === "GO"} onClick={() => setSub("dec", { choice: h.dec.choice === "GO" ? null : "GO" })}>Go for it</Chip>
            <Chip on={h.dec.choice === "LAY"} onClick={() => setSub("dec", { choice: h.dec.choice === "LAY" ? null : "LAY" })}>Lay up</Chip>
            {h.dec.choice && (<>
              <Chip tint="green" on={h.dec.worked === true} onClick={() => setSub("dec", { worked: h.dec.worked === true ? null : true })}>Worked</Chip>
              <Chip tint="red" on={h.dec.worked === false} onClick={() => setSub("dec", { worked: h.dec.worked === false ? null : false })}>Didn't</Chip>
            </>)}
          </Row>
        </Card>
      </>) : (
        <button onClick={() => setShowDec(true)} style={{
          margin: "14px 2px 0", background: "none", border: "none", color: C.blue,
          fontSize: 15, fontFamily: SYS, cursor: "pointer", padding: 0,
        }}>+ Log a risk/lay-up decision</button>
      )}

      {approachBunker && (<>
        <Header>Sand Shot</Header>
        <Card>
          <div style={{ fontSize: 13, color: C.secondary, margin: "0 0 6px" }}>How did the sand shot finish?</div>
          <Row>{SAND_OUTCOME.map((o) => (
            <Chip key={o.k} tint={o.good ? "green" : o.bad ? "red" : o.miss ? "orange" : "blue"}
              on={h.sand.outcome === o.k}
              onClick={() => setSub("sand", { outcome: h.sand.outcome === o.k ? null : o.k })}>{o.label}</Chip>
          ))}</Row>
        </Card>
      </>)}

      {missedGreen && !approachBunker && (<>
        <Header>Chipping</Header>
        <Card>
          <Row>{CHIP_PROX.map((p) => (
            <Chip key={p.k} tint={p.good ? "green" : p.bad ? "red" : p.miss ? "orange" : "blue"} on={h.chip.prox === p.k}
              onClick={() => setSub("chip", { prox: h.chip.prox === p.k ? null : p.k })}>{p.label}</Chip>
          ))}</Row>
          <div style={{ height: 8 }} />
          <Row><Chip on={h.chip.bunker} onClick={() => setSub("chip", { bunker: !h.chip.bunker })}>From bunker</Chip></Row>
        </Card>
      </>)}

      <Header>Putting</Header>
      <Card>
        <Row>
          {[0, 1, 2, 3, 4].map((n) => (
            <Chip key={n} tint={n >= 3 ? "red" : "blue"} on={h.putts.count === n}
              onClick={() => setSub("putts", { count: h.putts.count === n ? null : n })}>{n}</Chip>
          ))}
        </Row>
        <div style={{ fontSize: 13, color: C.secondary, margin: "12px 0 6px" }}>First putt distance</div>
        <Row>{PUTT_FIRST.map((d) => (
          <Chip key={d.k} on={h.putts.first === d.k}
            onClick={() => setSub("putts", { first: h.putts.first === d.k ? null : d.k, lagged: d.k === "SHORT" ? null : h.putts.lagged })}>{d.label}</Chip>
        ))}</Row>
        {lagRelevant && (<>
          <div style={{ fontSize: 13, color: C.secondary, margin: "12px 0 6px" }}>Left it inside 4 ft?</div>
          <Row>
            <Chip tint="green" on={h.putts.lagged === true} onClick={() => setSub("putts", { lagged: h.putts.lagged === true ? null : true })}>Yes</Chip>
            <Chip tint="red" on={h.putts.lagged === false} onClick={() => setSub("putts", { lagged: h.putts.lagged === false ? null : false })}>No</Chip>
          </Row>
        </>)}
        <div style={{ fontSize: 13, color: C.secondary, margin: "12px 0 6px" }}>Holed the putt from</div>
        <Row>{MADE_FROM.map((m) => (
          <Chip key={m.k} tint="green" on={h.putts.madeFrom === m.k}
            onClick={() => setSub("putts", { madeFrom: h.putts.madeFrom === m.k ? null : m.k })}>{m.label}</Chip>
        ))}</Row>
        <div style={{ height: 10 }} />
        <Chip tint="red" on={h.putts.missedShort}
          onClick={() => setSub("putts", { missedShort: !h.putts.missedShort })}>Missed one inside 4 ft</Chip>
      </Card>

      <Header>Mistake?</Header>
      <Card>
        <Row>{MISTAKE_CATS.map((c) => (
          <Chip key={c} tint="red" on={h.mistakes.includes(c)} onClick={() => toggleMistake(c)}>{c}</Chip>
        ))}</Row>
        {h.mistakes.length > 0 && (
          <input value={h.note} onChange={(e) => set({ note: e.target.value })}
            placeholder="What happened?" style={{ ...inputStyle, marginTop: 10 }} />
        )}
      </Card>

      <Header>Score</Header>
      <Card>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { label: h.par === 3 ? "Birdie" : "Birdie", v: h.par - 1, tint: "green" },
            { label: "Par", v: h.par, tint: "blue" },
            { label: "Bogey", v: h.par + 1, tint: "gray" },
            { label: "Double", v: h.par + 2, tint: "red" },
          ].map((b) => (
            <button key={b.label} onClick={() => set({ score: b.v })} style={{
              flex: 1, padding: "11px 4px", borderRadius: 12, border: "none", cursor: "pointer",
              fontFamily: SYS, fontSize: 14, fontWeight: 600,
              background: h.score === b.v ? C[b.tint === "gray" ? "label" : b.tint] : C.fill,
              color: h.score === b.v ? (b.tint === "gray" && C.mode === "dark" ? "#000" : "#fff") : C.label,
            }}>{b.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <button onClick={() => set({ score: Math.max(1, score - 1) })} style={stepBtn}>−</button>
          <div style={{ textAlign: "center", minWidth: 80 }}>
            <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.05,
              color: h.score == null ? C.tertiary : score - h.par < 0 ? C.red : score - h.par === 0 ? C.green : C.label }}>
              {score}
            </div>
            <div style={{ fontSize: 13, color: C.secondary }}>
              {h.score == null ? "tap a button, or + / −" : fmtToPar(score - h.par)}
            </div>
          </div>
          <button onClick={() => set({ score: score + 1 })} style={stepBtn}>+</button>
        </div>
        {h.score != null && h.putts.count != null && (
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, fontWeight: 600,
            color: isGIR(h) ? C.green : C.secondary }}>
            {isGIR(h)
              ? "✓ Green in regulation"
              : `GIR missed${h.app.missProx ? ` — finished ${h.app.missProx === "<10" ? "chippable" : h.app.missProx + " yd off"}` : ""}`}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", gap: 8, margin: "16px 0 0" }}>
        {i > 0 && (
          <button onClick={() => setI(i - 1)} style={{ ...btn(C.fill, C.blue), flex: 1 }}>‹ {holeNum - 1}</button>
        )}
        {i < round.holes.length - 1
          ? <button onClick={() => {
              if (h.score != null) setReaction({ hole: h, key: Date.now() });
              setI(i + 1);
            }} style={{ ...btn(C.blue), flex: 2 }}>Hole {holeNum + 1} ›</button>
          : <button onClick={onFinish} style={{ ...btn(C.green), flex: 2 }}>{isEdit ? "Save Round" : "Finish Round"}</button>}
      </div>
      {isEdit && i < round.holes.length - 1 && (
        <button onClick={onFinish} style={{ ...btn(C.fill, C.green), marginTop: 8 }}>
          Save Round
        </button>
      )}
    </div>
  );
}

/* ---------- trends ---------- */
const StatLine = ({ label, num, den, tintKey = "blue", last }) => {
  const C = useTheme();
  const pct = den ? Math.round((num / den) * 100) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
      borderBottom: last ? "none" : `0.5px solid ${C.line}` }}>
      <div style={{ flex: 1, fontSize: 15, color: C.label }}>{label}</div>
      <div style={{ width: 76, height: 5, background: C.bg, borderRadius: 3 }}>
        <div style={{ width: `${pct ?? 0}%`, height: "100%", background: C[tintKey], borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.label, width: 44, textAlign: "right" }}>
        {pct == null ? "—" : pct + "%"}
      </div>
      <div style={{ fontSize: 12, color: C.secondary, width: 42, textAlign: "right" }}>{num}/{den}</div>
    </div>
  );
};

const BigStat = ({ value, label, tint }) => {
  const C = useTheme();
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: tint || C.label }}>{value}</div>
      <div style={{ fontSize: 12, color: C.secondary, marginTop: 1 }}>{label}</div>
    </div>
  );
};

function HotSpotGrid({ grid, total }) {
  const C = useTheme();
  const greenRGB = C.mode === "dark" ? "48,209,88" : "52,199,89";
  const redRGB = C.mode === "dark" ? "255,69,58" : "255,59,48";
  const cell = (k, label, area) => {
    const n = grid[k] || 0;
    const pct = total ? n / total : 0;
    const isGreen = k === "GRN";
    return (
      <div key={k} style={{
        gridArea: area, borderRadius: isGreen ? "50%" : 12,
        background: isGreen ? `rgba(${greenRGB},${0.14 + pct * 0.55})` : `rgba(${redRGB},${0.07 + pct * 0.8})`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 8, minHeight: 60,
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.label }}>
          {total ? Math.round(pct * 100) + "%" : "—"}
        </div>
        <div style={{ fontSize: 11, color: C.secondary }}>{label}</div>
      </div>
    );
  };
  return (
    <div style={{ display: "grid", gap: 6, gridTemplateAreas: `". long ." "left grn right" ". short ."`,
      gridTemplateColumns: "1fr 1.2fr 1fr" }}>
      {cell("LONG", "Long", "long")}
      {cell("LEFT", "Left", "left")}
      {cell("GRN", "On green", "grn")}
      {cell("RIGHT", "Right", "right")}
      {cell("SHORT", "Short", "short")}
    </div>
  );
}


const TREND_METRICS = [
  { k: "score", label: "Score", fmt: (v) => v.toFixed(1), suffix: " to par", lowerBetter: true, get: (rs) => rs.toPar },
  { k: "gir", label: "GIR", fmt: (v) => Math.round(v * 100) + "%", lowerBetter: false, get: (rs) => rs.girPct },
  { k: "fw", label: "Fairways", fmt: (v) => Math.round(v * 100) + "%", lowerBetter: false, get: (rs) => rs.fwPct },
  { k: "putt", label: "Putts", fmt: (v) => v.toFixed(2), suffix: " /hole", lowerBetter: true, get: (rs) => rs.puttsPerHole },
  { k: "scr", label: "Scramble", fmt: (v) => Math.round(v * 100) + "%", lowerBetter: false, get: (rs) => rs.scramblePct },
];

function TrendChart({ rounds }) {
  const C = useTheme();
  const [metric, setMetric] = useState("score");
  const m = TREND_METRICS.find((x) => x.k === metric);

  const series = rounds.map((r) => roundStats(r)).filter(Boolean)
    .map((rs) => ({ v: m.get(rs), holes: rs.holes })).filter((p) => p.v != null).slice(-15);

  return (
    <Card>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TREND_METRICS.map((x) => (
          <Chip key={x.k} on={metric === x.k} onClick={() => setMetric(x.k)}>{x.label}</Chip>
        ))}
      </div>
      {series.length < 2 ? (
        <div style={{ fontSize: 14, color: C.secondary, padding: "8px 0" }}>
          Need at least 2 rounds with this data to chart a trend.
        </div>
      ) : (() => {
        const vals = series.map((p) => p.v);
        const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
        const W = 320, H = 130, padL = 8, padR = 8, padT = 14, padB = 22;
        const x = (i) => padL + (i / (series.length - 1)) * (W - padL - padR);
        const y = (v) => padT + (1 - (v - min) / span) * (H - padT - padB);
        const path = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
        const n = series.length;
        const xs = series.map((_, i) => i);
        const mx = xs.reduce((a, b) => a + b, 0) / n;
        const mv = vals.reduce((a, b) => a + b, 0) / n;
        const slope = xs.reduce((a, xi, i) => a + (xi - mx) * (vals[i] - mv), 0) /
          (xs.reduce((a, xi) => a + (xi - mx) ** 2, 0) || 1);
        const improving = m.lowerBetter ? slope < -1e-9 : slope > 1e-9;
        const flat = Math.abs(slope) < 1e-9;
        const trendColor = flat ? C.secondary : improving ? C.green : C.red;
        const first = vals[0], lastV = vals[n - 1];
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: C.label }}>
                {m.fmt(lastV)}<span style={{ fontSize: 13, fontWeight: 400, color: C.secondary }}>{m.suffix || ""}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: trendColor }}>
                {flat ? "→ steady" : improving ? "↗ improving" : "↘ slipping"}
              </div>
            </div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
              <line x1={x(0)} y1={y(first)} x2={x(n - 1)} y2={y(first + slope * (n - 1))}
                stroke={trendColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <path d={path} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {series.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p.v)} r={p.holes === 9 ? 2.6 : 3.6}
                  fill={i === n - 1 ? C.red : C.blue}
                  stroke={p.holes === 9 ? C.card : "none"} strokeWidth="1" />
              ))}
            </svg>
            <div style={{ fontSize: 11, color: C.secondary, marginTop: 4 }}>
              Last {n} rounds · small dot = 9 holes · dashed line = direction
            </div>
          </div>
        );
      })()}
    </Card>
  );
}

function LastVsBaseline({ rounds }) {
  const C = useTheme();
  const all = rounds.map((r) => roundStats(r)).filter(Boolean);
  if (all.length < 2) return null;

  const last = all[all.length - 1];
  // baseline = up to 20 rounds before the last one (so it's "vs your norm", not including itself)
  const windowed = all.slice(0, -1).slice(-20);

  const avg = (sel) => {
    const vals = windowed.map(sel).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const metrics = [
    { label: "Score to par", get: (rs) => rs.toPar, fmt: (v) => fmtToPar(Math.round(v)), lowerBetter: true, dFmt: (d) => Math.abs(d).toFixed(1) },
    { label: "GIR", get: (rs) => rs.girPct, fmt: (v) => Math.round(v * 100) + "%", lowerBetter: false, dFmt: (d) => Math.round(Math.abs(d) * 100) + " pts" },
    { label: "Fairways", get: (rs) => rs.fwPct, fmt: (v) => Math.round(v * 100) + "%", lowerBetter: false, dFmt: (d) => Math.round(Math.abs(d) * 100) + " pts" },
    { label: "Putts / hole", get: (rs) => rs.puttsPerHole, fmt: (v) => v.toFixed(2), lowerBetter: true, dFmt: (d) => Math.abs(d).toFixed(2) },
    { label: "Scramble", get: (rs) => rs.scramblePct, fmt: (v) => Math.round(v * 100) + "%", lowerBetter: false, dFmt: (d) => Math.round(Math.abs(d) * 100) + " pts" },
  ];

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.label, marginBottom: 12 }}>
        Last round vs your last {windowed.length === 1 ? "round" : `${windowed.length} rounds`}
      </div>
      <div>
        <div style={{ display: "flex", fontSize: 11, color: C.secondary, padding: "0 0 6px" }}>
          <div style={{ flex: 1 }} />
          <div style={{ width: 60, textAlign: "right" }}>LAST</div>
          <div style={{ width: 60, textAlign: "right" }}>AVG</div>
          <div style={{ width: 70, textAlign: "right" }}>VS NORM</div>
        </div>
        {metrics.map((m, idx) => {
          const lv = m.get(last), av = avg(m.get);
          if (lv == null || av == null) return null;
          const d = lv - av;
          const better = m.lowerBetter ? d < 0 : d > 0;
          const flat = Math.abs(d) < (m.label === "Putts / hole" ? 0.005 : m.label === "Score to par" ? 0.5 : 0.005);
          const color = flat ? C.secondary : better ? C.green : C.red;
          return (
            <div key={m.label} style={{ display: "flex", alignItems: "center", padding: "9px 0",
              borderBottom: idx < metrics.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
              <div style={{ flex: 1, fontSize: 14, color: C.label }}>{m.label}</div>
              <div style={{ width: 60, textAlign: "right", fontSize: 15, fontWeight: 600, color: C.label }}>{m.fmt(lv)}</div>
              <div style={{ width: 60, textAlign: "right", fontSize: 14, color: C.secondary }}>{m.fmt(av)}</div>
              <div style={{ width: 70, textAlign: "right", fontSize: 13, fontWeight: 600, color }}>
                {flat ? "→ even" : `${better ? "↑" : "↓"} ${m.dFmt(d)}`}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: C.secondary, marginTop: 8 }}>
          Baseline = your {windowed.length} round{windowed.length > 1 ? "s" : ""} before this one (handicap window).
        </div>
      </div>
    </Card>
  );
}

/* score cell using standard golf conventions:
   circle = birdie, double circle = eagle+, square = bogey, double square = double+, plain = par */
/* tappable stat row that traces to the holes feeding it */
function TraceLine({ holes, startHole, label, universe, match, tintKey = "blue", last,
  activeLabel, onTrace, countOnly }) {
  const C = useTheme();
  const tint = { blue: C.blue, green: C.green, red: C.red, orange: C.orange }[tintKey] || C.blue;
  const uni = holes.map((h, i) => ({ h, i })).filter(({ h }) => universe(h));
  const num = uni.filter(({ h }) => match(h));
  const den = uni.length;
  const idxs = num.map(({ i }) => i);
  const holeNums = idxs.map((i) => startHole + i);
  const pctv = den ? Math.round((num.length / den) * 100) : null;
  const active = activeLabel === label;
  const disabled = idxs.length === 0;

  return (
    <div style={{ borderBottom: last ? "none" : `0.5px solid ${C.line}` }}>
      <div onClick={() => !disabled && onTrace(active ? null : { label, idxs })}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 0", cursor: disabled ? "default" : "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 15, color: C.label }}>{label}</span>
          {!disabled && (
            <span style={{ fontSize: 11, color: active ? tint : C.tertiary }}>
              {active ? "▾" : "›"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!countOnly && pctv != null && (
            <span style={{ fontSize: 13, color: C.tertiary }}>{num.length}/{den}</span>
          )}
          <span style={{ fontSize: 15, fontWeight: 700, color: tint, minWidth: 40, textAlign: "right" }}>
            {countOnly ? num.length : (pctv != null ? pctv + "%" : "—")}
          </span>
        </div>
      </div>
      {!countOnly && pctv != null && (
        <div style={{ height: 3, background: C.fill, borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
          <div style={{ width: `${pctv}%`, height: "100%", background: tint }} />
        </div>
      )}
      {active && (
        <div style={{ fontSize: 13, color: tint, padding: "0 0 11px", lineHeight: 1.5 }}>
          {holeNums.length ? <>Hole{holeNums.length > 1 ? "s" : ""} {holeNums.join(", ")}</> : "No holes"}
        </div>
      )}
    </div>
  );
}

function ScoreCell({ hole, num, highlight, dim }) {
  const C = useTheme();
  const h = hole;
  const has = h.score != null;
  const d = has ? h.score - h.par : null;
  const gir = hasGIRData(h) && isGIR(h);
  const scramble = hasGIRData(h) && !isGIR(h) && h.score <= h.par; // missed green, saved par+
  const fairway = h.par > 3 && h.tee.result === "FWY";
  const mistake = h.mistakes.length > 0;

  let shape = "none";
  if (d != null) {
    if (d <= -2) shape = "dcircle";
    else if (d === -1) shape = "circle";
    else if (d === 1) shape = "square";
    else if (d >= 2) shape = "dsquare";
  }
  const round = shape.includes("circle");
  const bordered = shape !== "none";
  const dbl = shape.startsWith("d");
  const dot = (color, key) => (
    <div key={key} style={{ width: 5, height: 5, borderRadius: 3, background: color }} />
  );

  return (
    <div style={{ textAlign: "center", paddingBottom: 3, position: "relative",
      borderRadius: 10, transition: "background .15s, opacity .15s",
      background: highlight ? C.blue : "transparent",
      opacity: dim ? 0.32 : 1 }}>
      <div style={{ fontSize: 9, color: highlight ? "#fff" : C.secondary }}>{num}</div>
      <div style={{ fontSize: 8, color: highlight ? "rgba(255,255,255,0.7)" : C.tertiary, marginTop: -1, marginBottom: 2 }}>P{h.par}</div>
      <div style={{ position: "relative", width: 30, height: 30, margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {bordered && (
          <div style={{ position: "absolute", inset: 3,
            border: `1.5px solid ${highlight ? "#fff" : C.label}`, borderRadius: round ? "50%" : 5 }} />
        )}
        {dbl && (
          <div style={{ position: "absolute", inset: 0,
            border: `1.5px solid ${highlight ? "#fff" : C.label}`, borderRadius: round ? "50%" : 6 }} />
        )}
        <span style={{ fontSize: 15, fontWeight: 700, color: highlight ? "#fff" : (has ? C.label : C.tertiary) }}>
          {h.score ?? "·"}
        </span>
      </div>
      <div style={{ height: 8, display: "flex", gap: 2.5, justifyContent: "center", alignItems: "center", marginTop: 1 }}>
        {fairway && dot(C.blue, "fw")}
        {gir && dot(C.green, "gir")}
        {scramble && dot(C.teal, "scr")}
        {mistake && dot(C.red, "mis")}
      </div>
    </div>
  );
}

const ScoreLegend = () => {
  const C = useTheme();
  const item = (shape, label) => {
    const round = shape.includes("circle");
    const dbl = shape.startsWith("d");
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ position: "relative", width: 18, height: 18 }}>
          <div style={{ position: "absolute", inset: 3, border: `1.4px solid ${C.label}`,
            borderRadius: round ? "50%" : 4 }} />
          {dbl && <div style={{ position: "absolute", inset: 0, border: `1.4px solid ${C.label}`,
            borderRadius: round ? "50%" : 5 }} />}
        </div>
        <span style={{ fontSize: 12, color: C.secondary }}>{label}</span>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 10 }}>
      {item("circle", "Birdie")}
      {item("dcircle", "Eagle+")}
      {item("square", "Bogey")}
      {item("dsquare", "Dbl+")}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: C.blue }} />
        <span style={{ fontSize: 12, color: C.secondary }}>Fairway</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: C.green }} />
        <span style={{ fontSize: 12, color: C.secondary }}>GIR</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: C.teal }} />
        <span style={{ fontSize: 12, color: C.secondary }}>Scramble</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: C.red }} />
        <span style={{ fontSize: 12, color: C.secondary }}>Mistake</span>
      </div>
    </div>
  );
};

function RoundDetail({ round: r, rounds, onEdit, onBack, titleText }) {
  const C = useTheme();
  const [trace, setTrace] = useState(null); // { label, idxs } | null
  const rs = roundStats(r);
  const startHole = r.startHole || 1;
  const pct = (n, d) => (d ? Math.round((n / d) * 100) + "%" : "—");
  const sug = computeSuggestions(computeStats(rounds.slice(-5)));
  const hl = trace ? new Set(trace.idxs) : null;
  const onTrace = (t) => setTrace(t);
  const shared = { holes: r.holes, startHole, activeLabel: trace?.label, onTrace };
  // shared predicates
  const par4plus = (h) => h.par > 3;
  const teeSet = (h) => h.par > 3 && h.tee.result != null;
  const girData = (h) => hasGIRData(h);
  const missedGreen = (h) => hasGIRData(h) && !isGIR(h);
  const sandHole = (h) => h.score != null && (h.app.result === "BUNK" || (h.chip.bunker && hasGIRData(h)));
  const teeClubsUsed = [...new Set(r.holes.filter((h) => h.par > 3 && h.tee.result && h.tee.club).map((h) => h.tee.club))];
  const apprClubsUsed = [...new Set(r.holes.filter((h) => h.app.club).map((h) => h.app.club))];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 2px 0" }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.blue,
            fontSize: 17, cursor: "pointer", padding: 0, fontFamily: SYS }}>‹ Back</button>
        )}
        <div style={{ fontFamily: SYS, fontSize: 32, fontWeight: 700, color: C.label }}>{titleText || "Last Round"}</div>
      </div>

      {/* summary header */}
      <Card style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.label }}>{r.courseName}</div>
            <div style={{ fontSize: 13, color: C.secondary }}>
              {r.date} · {r.holes.length === 9 ? (startHole === 10 ? "Back 9" : "Front 9") : "18 holes"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: C.label, lineHeight: 1 }}>{rs.gross}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: rs.toPar < 0 ? C.red : rs.toPar === 0 ? C.green : C.secondary }}>
              {fmtToPar(rs.toPar)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${C.line}` }}>
          {[["GIR", pct(rs.girs, rs.girN), C.green],
            ["Fairways", pct(rs.fw, rs.fwN), C.blue],
            ["Scramble", pct(rs.scrambles, rs.scrambleN), C.orange],
            ["Putts", rs.puttN ? rs.putts : "—", C.label]].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: C.secondary }}>{l}</div>
            </div>
          ))}
        </div>
        <button onClick={() => onEdit(r)} style={{ ...btn(C.fill, C.blue), marginTop: 14, padding: 11, fontSize: 15 }}>
          Edit this round
        </button>
      </Card>

      {/* scorecard — reflects the active trace */}
      <Header>Scorecard{trace ? ` — ${trace.label}` : ""}</Header>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}>
          {r.holes.map((h, j) => (
            <ScoreCell key={j} hole={h} num={startHole + j}
              highlight={hl ? hl.has(j) : false} dim={hl ? !hl.has(j) : false} />
          ))}
        </div>
        {trace && (
          <div style={{ fontSize: 12, color: C.secondary, marginTop: 8, textAlign: "center" }}>
            Tap the stat again to clear the highlight.
          </div>
        )}
        {r.holes.some((h) => h.note) && !trace && (
          <div style={{ fontSize: 13, color: C.red, margin: "10px 0 0" }}>
            {r.holes.map((h, j) => h.note ? <div key={j}>Hole {startHole + j}: {h.note}</div> : null)}
          </div>
        )}
        <ScoreLegend />
      </Card>

      {/* driving */}
      <Header>Driving</Header>
      <Card>
        <TraceLine {...shared} label="Fairways hit" tintKey="green" universe={teeSet} match={(h) => h.tee.result === "FWY"} />
        <TraceLine {...shared} label="Missed left" universe={teeSet} match={(h) => h.tee.result === "L"} />
        <TraceLine {...shared} label="Missed right" universe={teeSet} match={(h) => h.tee.result === "R"} />
        <TraceLine {...shared} label="Fairway bunker" tintKey="orange" universe={teeSet} match={(h) => h.tee.result === "BUNK"} />
        <TraceLine {...shared} label="Penalty / OB" tintKey="red" last universe={teeSet}
          match={(h) => h.tee.result === "PEN" || h.tee.result === "OB"} />
      </Card>
      {teeClubsUsed.length > 0 && (<>
        <Header>Tee — fairways by club</Header>
        <Card>
          {teeClubsUsed.map((club, i) => (
            <TraceLine key={club} {...shared} label={club} tintKey="green"
              last={i === teeClubsUsed.length - 1}
              universe={(h) => teeSet(h) && h.tee.club === club} match={(h) => h.tee.result === "FWY"} />
          ))}
        </Card>
      </>)}

      {/* approach */}
      <Header>Approach</Header>
      <Card>
        <TraceLine {...shared} label="Greens in regulation" tintKey="green" universe={girData} match={(h) => isGIR(h)} />
        {APP_DISTS.map((b, i) => (
          <TraceLine key={b.k} {...shared} label={`Green hit from ${b.label}`} tintKey="green"
            universe={(h) => girData(h) && h.app.dist === b.k} match={(h) => isGIR(h)} />
        ))}
        <TraceLine {...shared} label="Misses left chippable (<10 yd)" last universe={missedGreen}
          match={(h) => h.app.missProx === "<10"} />
      </Card>
      {apprClubsUsed.length > 0 && (<>
        <Header>Approach — greens by club</Header>
        <Card>
          {apprClubsUsed.map((club, i) => (
            <TraceLine key={club} {...shared} label={club} tintKey="green"
              last={i === apprClubsUsed.length - 1}
              universe={(h) => girData(h) && h.app.club === club} match={(h) => isGIR(h)} />
          ))}
        </Card>
      </>)}

      {/* short game (non-bunker) */}
      <Header>Short Game — off the turf</Header>
      <Card>
        <TraceLine {...shared} label="Chip up & down" tintKey="green"
          universe={(h) => missedGreen(h) && h.app.result !== "BUNK"} match={(h) => h.score <= h.par} />
        {CHIP_PROX.map((b, i) => (
          <TraceLine key={b.k} {...shared} label={b.on ? `On green · ${b.label}` : b.label} countOnly
            tintKey={b.good ? "green" : b.bad ? "red" : b.miss ? "orange" : "blue"}
            last={i === CHIP_PROX.length - 1}
            universe={(h) => h.chip.prox != null} match={(h) => h.chip.prox === b.k} />
        ))}
      </Card>

      {/* bunkers */}
      <Header>Bunkers — greenside</Header>
      <Card>
        <TraceLine {...shared} label="Approaches into a bunker" countOnly tintKey="orange"
          universe={(h) => h.score != null} match={sandHole} />
        <TraceLine {...shared} label="Sand saves (up & down)" tintKey="green"
          universe={sandHole} match={(h) => h.score <= h.par} />
        <TraceLine {...shared} label="Escaped first try" tintKey="green"
          universe={(h) => h.app.result === "BUNK" && h.sand.outcome != null}
          match={(h) => h.sand.outcome !== "IN"} />
        <TraceLine {...shared} label="Blow-ups (double+)" tintKey="red"
          universe={sandHole} match={(h) => h.score - h.par >= 2} />
        {SAND_OUTCOME.map((o, i) => (
          <TraceLine key={o.k} {...shared} label={o.on ? `On green · ${o.label}` : o.label} countOnly
            tintKey={o.good ? "green" : o.bad ? "red" : o.miss ? "orange" : "blue"}
            last={i === SAND_OUTCOME.length - 1}
            universe={(h) => h.app.result === "BUNK" && h.sand.outcome != null}
            match={(h) => h.sand.outcome === o.k} />
        ))}
      </Card>

      {/* putting */}
      <Header>Putting</Header>
      <Card>
        <div style={{ display: "flex", marginBottom: 8 }}>
          <BigStat value={rs.puttN ? rs.putts : "—"} label="Total putts" />
          <BigStat value={rs.puttsPerHole != null ? rs.puttsPerHole.toFixed(2) : "—"} label="Avg / hole" />
        </div>
        <TraceLine {...shared} label="Missed inside 4 ft" tintKey="red" countOnly
          universe={(h) => h.putts.count != null} match={(h) => h.putts.missedShort} />
        <TraceLine {...shared} label="Made from 3–4 ft" tintKey="green"
          universe={(h) => h.putts.madeFrom === "3-4" || h.putts.missedShort}
          match={(h) => h.putts.madeFrom === "3-4"} />
        <TraceLine {...shared} label="Lag (20+) to inside 4 ft" tintKey="green"
          universe={(h) => h.putts.first === "LAG" && h.putts.lagged != null}
          match={(h) => h.putts.lagged === true} />
        {PUTT_FIRST.map((b, i) => (
          <TraceLine key={b.k} {...shared} label={`3-putt from ${b.label}`} tintKey="red"
            universe={(h) => h.putts.first === b.k && h.putts.count != null}
            match={(h) => h.putts.count >= 3} />
        ))}
        {MADE_FROM.map((b, i) => (
          <TraceLine key={b.k} {...shared} label={`Holed from ${b.label}`} countOnly last={i === MADE_FROM.length - 1}
            universe={(h) => h.putts.madeFrom != null} match={(h) => h.putts.madeFrom === b.k} />
        ))}
      </Card>

      {/* mistakes traced */}
      <Header>Mistakes Flagged</Header>
      <Card>
        {MISTAKE_CATS.map((cat, i) => (
          <TraceLine key={cat} {...shared} label={cat} countOnly tintKey="red" last={i === MISTAKE_CATS.length - 1}
            universe={(h) => h.score != null} match={(h) => h.mistakes.includes(cat)} />
        ))}
      </Card>

      {/* practice focus (last 5 rounds) */}
      <Header>Practice Focus — last {Math.min(5, rounds.length)} rounds</Header>
      {sug.slice(0, 2).map((p, i) => (
        <Card key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            {i === 0 && sug.length > 1 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: C.red, padding: "2px 8px", borderRadius: 9 }}>TOP LEAK</span>
            )}
            <div style={{ fontSize: 16, fontWeight: 600, color: C.label }}>{p.title}</div>
          </div>
          <div style={{ fontSize: 14, color: C.secondary, lineHeight: 1.4 }}>{p.why}</div>
          <div style={{ fontSize: 14, color: C.label, lineHeight: 1.45, marginTop: 8,
            padding: "10px 12px", background: C.bg, borderRadius: 12 }}>{p.drill}</div>
        </Card>
      ))}
      <div style={{ height: 8 }} />
    </div>
  );
}

function LastRound({ rounds, onEdit }) {
  const C = useTheme();
  if (!rounds.length) return (
    <div>
      <div style={{ fontFamily: SYS, fontSize: 32, fontWeight: 700, color: C.label, margin: "4px 2px 0" }}>Last Round</div>
      <Card style={{ textAlign: "center", padding: 32, marginTop: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: C.label }}>No rounds yet</div>
        <div style={{ fontSize: 14, color: C.secondary, marginTop: 6 }}>Play a round and its full breakdown lands here.</div>
      </Card>
    </div>
  );
  return <RoundDetail round={rounds[rounds.length - 1]} rounds={rounds} onEdit={onEdit} titleText="Last Round" />;
}

function ClubStatRow({ club, made, attempts, tint, last }) {
  const C = useTheme();
  const thin = attempts < 3;
  const pctv = attempts ? Math.round((made / attempts) * 100) : 0;
  return (
    <div style={{ borderBottom: last ? "none" : `0.5px solid ${C.line}`, padding: "11px 0",
      opacity: thin ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.label }}>{club}</span>
          {thin && (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: "uppercase",
              letterSpacing: "0.05em" }}>Thin sample</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: C.tertiary }}>{made}/{attempts}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: tint, minWidth: 46, textAlign: "right" }}>
            {pctv}%
          </span>
        </div>
      </div>
      <div style={{ height: 3, background: C.fill, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
        <div style={{ width: `${pctv}%`, height: "100%", background: tint }} />
      </div>
    </div>
  );
}

function Trends({ rounds }) {
  const C = useTheme();
  const full = computeStats(rounds);
  if (!full.nRounds) return (
    <Card style={{ textAlign: "center", padding: 32, marginTop: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: C.label }}>No rounds yet</div>
      <div style={{ fontSize: 14, color: C.secondary, marginTop: 6 }}>Log a round and the trends appear here.</div>
    </Card>
  );
  const teeByClub = full.tee.byClub || [];
  const appByClub = full.app.byClub || [];

  return (
    <div>
      <div style={{ fontFamily: SYS, fontSize: 32, fontWeight: 700, color: C.label, margin: "4px 2px 0" }}>Trends</div>

      <Header>Handicap</Header>
      <Card>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: C.blue }}>
            {full.index != null ? full.index.toFixed(1) : "—"}
          </div>
          {full.index != null && handicapBasis(full.nDiffs).provisional && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff",
              background: C.orange, padding: "2px 8px", borderRadius: 8 }}>PROVISIONAL</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.secondary, marginTop: 6 }}>
          {full.index != null
            ? (handicapBasis(full.nDiffs).provisional
                ? `Based on your best ${handicapBasis(full.nDiffs).used} of ${full.nDiffs} rounds. One strong round carries extra weight until you've logged 20.`
                : `Best 8 of your last 20 rounds.`)
            : `Needs ${Math.max(0, 3 - full.nDiffs)} more rounds to establish.`}
        </div>
      </Card>

      <Header>Round-by-Round Trend</Header>
      <TrendChart rounds={rounds} />

      <Header>Last Round vs Recent Average</Header>
      <LastVsBaseline rounds={rounds} />

      {teeByClub.length > 0 && (<>
        <Header>Tee — fairway % by club</Header>
        <Card>
          {teeByClub.map((c, i) => (
            <ClubStatRow key={c.club} club={c.club} made={c.fw} attempts={c.n}
              tint={C.blue} last={i === teeByClub.length - 1} />
          ))}
        </Card>
      </>)}

      {appByClub.length > 0 && (<>
        <Header>Approach — GIR % by club</Header>
        <Card>
          {appByClub.map((c, i) => (
            <ClubStatRow key={c.club} club={c.club} made={c.gir} attempts={c.n}
              tint={C.green} last={i === appByClub.length - 1} />
          ))}
        </Card>
      </>)}
      <div style={{ height: 8 }} />
    </div>
  );
}

/* ---------- rounds list ---------- */
function RoundsList({ rounds, onDelete, onResume, onEdit, onOpenDetail, activeId }) {
  const C = useTheme();
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  return (
    <div>
      <div style={{ fontFamily: SYS, fontSize: 32, fontWeight: 700, color: C.label, margin: "4px 2px 12px" }}>Rounds</div>
      {!rounds.length ? (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: C.label }}>No rounds yet</div>
          <div style={{ fontSize: 14, color: C.secondary, marginTop: 6 }}>Finished scorecards live here.</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...rounds].reverse().map((r) => {
            const played = r.holes.filter((h) => h.score != null);
            const gross = played.reduce((s, h) => s + h.score, 0);
            const toPar = gross - played.reduce((s, h) => s + h.par, 0);
            const mist = r.holes.reduce((s, h) => s + h.mistakes.length, 0);
            const isOpen = open === r.id;
            const inProgress = r.id === activeId;
            const startHole = r.startHole || 1;
            return (
              <Card key={r.id} style={{ padding: 0, overflow: "hidden" }}>
                <div onClick={() => setOpen(isOpen ? null : r.id)} style={{ padding: 16, cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.label }}>
                      {r.courseName}
                      {inProgress && <span style={{ color: C.blue, fontSize: 13, fontWeight: 400 }}> · In progress</span>}
                    </div>
                    <div style={{ fontSize: 13, color: C.secondary }}>
                      {r.date} · {r.holes.length === 9 ? (startHole === 10 ? "Back 9" : "Front 9") : "18 holes"}
                      {mist ? ` · ${mist} mistake${mist > 1 ? "s" : ""}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.label }}>
                    {played.length ? gross : "—"}
                    <span style={{ fontSize: 13, fontWeight: 400, color: toPar < 0 ? C.red : C.secondary }}>
                      {" "}{played.length ? fmtToPar(toPar) : ""}
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}>
                      {r.holes.map((h, j) => (
                        <ScoreCell key={j} hole={h} num={startHole + j} />
                      ))}
                    </div>
                    {r.holes.some((h) => h.note) && (
                      <div style={{ fontSize: 13, color: C.red, margin: "10px 0 0" }}>
                        {r.holes.map((h, j) => h.note ? <div key={j}>Hole {startHole + j}: {h.note}</div> : null)}
                      </div>
                    )}
                    <ScoreLegend />
                    {(() => {
                      const rs = roundStats(r);
                      if (!rs) return null;
                      const pctOrDash = (v) => (v == null ? "—" : Math.round(v * 100) + "%");
                      const cells = [
                        ["GIR", pctOrDash(rs.girPct), C.green],
                        ["Fairways", pctOrDash(rs.fwPct), C.blue],
                        ["Scramble", pctOrDash(rs.scramblePct), C.orange],
                        ["Putts", rs.puttN ? rs.putts : "—", C.label],
                        ["Avg putt", rs.puttsPerHole != null ? rs.puttsPerHole.toFixed(2) : "—", C.label],
                        ["Penalties", rs.trouble, rs.trouble ? C.red : C.label],
                      ];
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
                          marginTop: 12, padding: "12px 8px", background: C.bg, borderRadius: 12 }}>
                          {cells.map(([l, v, tint]) => (
                            <div key={l} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: tint }}>{v}</div>
                              <div style={{ fontSize: 11, color: C.secondary }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div style={{ marginTop: 12 }}>
                      {confirm === r.id ? (
                        <div>
                          <div style={{ fontSize: 14, color: C.label, textAlign: "center", marginBottom: 8 }}>
                            Delete this round permanently?
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setConfirm(null)}
                              style={{ ...btn(C.fill, C.label), flex: 1, padding: 11, fontSize: 15 }}>Cancel</button>
                            <button onClick={() => { onDelete(r.id); setConfirm(null); }}
                              style={{ ...btn(C.red), flex: 1, padding: 11, fontSize: 15 }}>Delete Round</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <button onClick={() => onOpenDetail(r.id)}
                            style={{ ...btn(C.blue), width: "100%", padding: 11, fontSize: 15 }}>
                            View full breakdown ›
                          </button>
                          <div style={{ display: "flex", gap: 8 }}>
                            {inProgress
                              ? <button onClick={onResume} style={{ ...btn(C.fill, C.blue), flex: 1, padding: 11, fontSize: 15 }}>Resume</button>
                              : <button onClick={() => onEdit(r)} style={{ ...btn(C.fill, C.blue), flex: 1, padding: 11, fontSize: 15 }}>Edit</button>}
                            <button onClick={() => setConfirm(r.id)}
                              style={{ ...btn(C.fill, C.red), flex: 1, padding: 11, fontSize: 15 }}>Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- app shell ---------- */
export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("home");
  const [detailId, setDetailId] = useState(null); // round id shown in full-breakdown detail
  const [bagOpen, setBagOpen] = useState(false);
  const [screen, setScreen] = useState("dash"); // dash | setup | logger
  const [flash, setFlash] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => { loadData().then((d) => {
    if (!d.theme) d.theme = (typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    setData(d);
  }); }, []);
  useEffect(() => {
    if (!data) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData(data), 350);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  if (!data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F2F2F7", fontFamily: SYS, color: "#8E8E93" }}>Loading…</div>
  );

  const C = data.theme === "dark" ? DARK : LIGHT;
  const stats = computeStats(data.rounds);

  const startRound = (course, holesType) => {
    const startHole = holesType === "B9" ? 10 : 1;
    const pars = holesType === "18" ? course.pars
      : holesType === "F9" ? course.pars.slice(0, 9) : course.pars.slice(9);
    setData((d) => ({ ...d, activeRound: {
      id: uid(), courseId: course.id, courseName: course.name,
      rating: course.rating, slope: course.slope, startHole,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      holes: pars.map((p) => emptyHole(p)),
    }}));
    setScreen("logger");
    const teeEyebrows = ["Tee it up", "Round on", "Here we go", "Game time"];
    setFlash({ kind: "tee", emoji: "⛳",
      eyebrow: teeEyebrows[Math.floor(Math.random() * teeEyebrows.length)],
      title: course.name, sub: teeQuip(data.rounds) });
  };

  const goTab = (k) => { setTab(k); setDetailId(null); if (k === "home") setScreen("dash"); };
  const tabs = [["home", "Home"], ["last", "Last"], ["trends", "Trends"], ["rounds", "Rounds"]];
  const isEditing = data.activeRound && data.rounds.some((r) => r.id === data.activeRound.id);
  const listRounds = !data.activeRound
    ? data.rounds
    : isEditing
      ? data.rounds.map((r) => (r.id === data.activeRound.id ? data.activeRound : r))
      : [...data.rounds, data.activeRound];

  // commit the open round: replace in place if it already exists, else append
  const commitRound = (d) => {
    const inList = d.rounds.some((r) => r.id === d.activeRound.id);
    const rounds = inList
      ? d.rounds.map((r) => (r.id === d.activeRound.id ? d.activeRound : r))
      : [...d.rounds, d.activeRound];
    return { ...d, rounds, activeRound: null };
  };
  const editRound = (r) => {
    setData((d) => ({ ...d, activeRound: { ...r } }));
    setTab("home"); setScreen("logger");
  };

  return (
    <ThemeCtx.Provider value={C}>
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: SYS, color: C.label }}>
        <style>{`button:active{opacity:.7} input::placeholder{color:${C.tertiary}}
          @keyframes ybPop{0%{transform:scale(.7);opacity:0}45%{transform:scale(1.06);opacity:1}100%{transform:scale(1);opacity:1}}
          @keyframes ybBounce{0%{transform:scale(.5) translateY(20px);opacity:0}60%{transform:scale(1.08) translateY(0);opacity:1}100%{transform:scale(1);opacity:1}}
          @keyframes ybFall{0%{transform:translateY(-14px) rotate(0);opacity:1}100%{transform:translateY(210px) rotate(400deg);opacity:0}}
          @keyframes ybDim{from{opacity:0}to{opacity:1}}
          @keyframes ybUp{from{transform:translateY(60px);opacity:.4}to{transform:translateY(0);opacity:1}}
          @media (prefers-reduced-motion: reduce){*{transition:none!important;animation-duration:.01ms!important}}`}</style>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 16px 100px" }}>
          {tab === "home" && (screen === "dash" || (screen === "logger" && !data.activeRound)) && (
            <Home data={data} stats={stats} theme={data.theme}
              onToggleTheme={() => setData((d) => ({ ...d, theme: d.theme === "dark" ? "light" : "dark" }))}
              onOpenBag={() => setBagOpen(true)}
              onTeeOff={() => setScreen("setup")}
              onResume={() => setScreen("logger")}
              goTrends={() => setTab("trends")}
              onImport={(imp) => setData((d) => ({ ...d,
                courses: imp.courses || [],
                rounds: (imp.rounds || []).map((r) => ({ ...r, holes: r.holes.map(migrateHole) })),
              }))} />
          )}
          {tab === "home" && screen === "setup" && (
            <RoundSetup courses={data.courses} onStart={startRound} onBack={() => setScreen("dash")}
              onSaveCourse={(c) => setData((d) => ({ ...d, courses: [...d.courses, c] }))}
              onUpdateCourse={(c) => setData((d) => ({ ...d, courses: d.courses.map((x) => x.id === c.id ? c : x) }))}
              onDeleteCourse={(id) => setData((d) => ({ ...d, courses: d.courses.filter((x) => x.id !== id) }))} />
          )}
          {tab === "home" && screen === "logger" && data.activeRound && (
            <HoleLogger round={data.activeRound} isEdit={isEditing} bag={data.bag}
              onUpdate={(r) => setData((d) => ({ ...d, activeRound: r }))}
              onFinish={() => {
                const fr = data.activeRound;
                const rs = fr ? roundStats(fr) : null;
                setData(commitRound); setScreen("dash");
                if (rs) setFlash({ kind: "finish", eyebrow: "That's a wrap",
                  emoji: rs.toPar <= 0 ? "🏆" : rs.toPar <= 5 ? "🏁" : "💪",
                  title: String(rs.gross), toPar: rs.toPar, sub: finishQuip(rs) });
              }}
              onBack={() => {
                setData((d) => (d.activeRound && d.rounds.some((r) => r.id === d.activeRound.id))
                  ? commitRound(d)   // editing an existing round → save changes
                  : d);              // new in-progress round → keep it resumable
                setScreen("dash");
              }} />
          )}
          {tab === "trends" && <Trends rounds={data.rounds} />}
          {tab === "last" && <LastRound rounds={data.rounds}
            onEdit={(r) => { editRound(r); }} />}
          {tab === "rounds" && (() => {
            const detail = detailId != null ? data.rounds.find((r) => r.id === detailId) : null;
            if (detail) return (
              <RoundDetail round={detail} rounds={data.rounds} titleText="Round"
                onBack={() => setDetailId(null)}
                onEdit={(r) => { setDetailId(null); editRound(r); }} />
            );
            return (
              <RoundsList rounds={listRounds} activeId={data.activeRound?.id}
                onResume={() => { setTab("home"); setScreen("logger"); }}
                onEdit={editRound}
                onOpenDetail={(id) => setDetailId(id)}
                onDelete={(id) => setData((d) => ({
                  ...d, rounds: d.rounds.filter((r) => r.id !== id),
                  activeRound: d.activeRound?.id === id ? null : d.activeRound,
                }))} />
            );
          })()}
        </div>

        {flash && <RoundFlash flash={flash} onDone={() => setFlash(null)} />}
        {bagOpen && <BagSettings bag={data.bag} onClose={() => setBagOpen(false)}
          onChange={(bag) => setData((d) => ({ ...d, bag }))} />}

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0,
          background: C.chrome, borderTop: `0.5px solid ${C.line}`, backdropFilter: "blur(18px)" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", display: "flex" }}>
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => goTab(k)} style={{
                flex: 1, padding: "11px 0 20px", background: "none", border: "none", cursor: "pointer",
                fontFamily: SYS, fontSize: 11, fontWeight: 500,
                color: tab === k ? C.blue : C.secondary,
              }}>
                <div style={{ height: 24, marginBottom: 2, display: "flex", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke={tab === k ? C.blue : C.secondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {k === "home" && <path d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z" />}
                    {k === "last" && (<><line x1="6" y1="3" x2="6" y2="21" /><path d="M6 4 L17 7 L6 11 Z" /></>)}
                    {k === "trends" && <polyline points="3,17 9,11 13,14 21,6" />}
                    {k === "rounds" && (<><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></>)}
                  </svg>
                </div>
                {label}{k === "home" && data.activeRound ? " •" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
