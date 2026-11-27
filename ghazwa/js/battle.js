/* غزوة - battle simulator. Deterministic given seed; produces replayable frames. No DOM. */
(function (global) {
  'use strict';
  var DATA = (typeof module !== 'undefined') ? require('./data.js') : global.GhazwaData;
  var B = DATA.BUILDINGS, T = DATA.TROOPS;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function distToRect(px, py, rx, ry, size) {
    var dx = Math.max(rx - px, 0, px - (rx + size));
    var dy = Math.max(ry - py, 0, py - (ry + size));
    return Math.sqrt(dx * dx + dy * dy);
  }

  // defBuildings: [{type,x,y,lvl}]  deploy: [{troop,x,y}]  lootPool: {gold,food}
  function simulate(defBuildings, deploy, lootPool, seed) {
    var rnd = mulberry32(seed >>> 0);
    var buildings = defBuildings.map(function (b, i) {
      var lv = B[b.type].levels[(b.lvl || 1) - 1];
      return {
        i: i, type: b.type, x: b.x, y: b.y, size: B[b.type].size,
        hp: lv.hp, maxHp: lv.hp, alive: true,
        dps: lv.dps || 0, range: lv.range || 0
      };
    });
    var totalHp = buildings.reduce(function (a, b) { return a + b.maxHp; }, 0);
    var troops = deploy.map(function (d, i) {
      var t = T[d.troop];
      return { i: i, troop: d.troop, x: d.x, y: d.y, hp: t.hp, alive: true, jitter: rnd() * 0.5 };
    });
    var sentByType = {};
    deploy.forEach(function (d) { sentByType[d.troop] = (sentByType[d.troop] || 0) + 1; });

    var dt = 0.25, frames = [], events = [];
    var t = 0, ticks = Math.floor(DATA.BATTLE_SECONDS / dt);
    for (var k = 0; k <= ticks; k++) {
      // troops act
      for (var i = 0; i < troops.length; i++) {
        var tr = troops[i];
        if (!tr.alive) continue;
        var cfg = T[tr.troop];
        // nearest alive building
        var best = null, bestD = 1e9;
        for (var j = 0; j < buildings.length; j++) {
          var b = buildings[j];
          if (!b.alive) continue;
          var d = distToRect(tr.x, tr.y, b.x, b.y, b.size) + tr.jitter;
          if (d < bestD) { bestD = d; best = b; }
        }
        if (!best) break;
        var realD = distToRect(tr.x, tr.y, best.x, best.y, best.size);
        if (realD <= cfg.range) {
          best.hp -= cfg.dps * dt;
          if (best.hp <= 0 && best.alive) {
            best.hp = 0; best.alive = false;
            events.push({ t: Math.round(t), kind: 'destroyed', building: best.i, type: best.type });
          }
        } else {
          // move toward building center
          var cx = best.x + best.size / 2, cy = best.y + best.size / 2;
          var dx = cx - tr.x, dy = cy - tr.y;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          var step = cfg.speed * dt;
          tr.x += (dx / len) * step;
          tr.y += (dy / len) * step;
        }
      }
      // defenses act
      for (var j2 = 0; j2 < buildings.length; j2++) {
        var bt = buildings[j2];
        if (!bt.alive || !bt.dps) continue;
        var tcx = bt.x + bt.size / 2, tcy = bt.y + bt.size / 2;
        var tgt = null, td = 1e9;
        for (var i2 = 0; i2 < troops.length; i2++) {
          var tr2 = troops[i2];
          if (!tr2.alive) continue;
          var d2 = Math.sqrt((tr2.x - tcx) * (tr2.x - tcx) + (tr2.y - tcy) * (tr2.y - tcy));
          if (d2 <= bt.range && d2 < td) { td = d2; tgt = tr2; }
        }
        if (tgt) {
          tgt.hp -= bt.dps * dt;
          if (tgt.hp <= 0 && tgt.alive) {
            tgt.alive = false;
            events.push({ t: Math.round(t), kind: 'troopDown', troop: tgt.i });
          }
        }
      }
      // record frame every second
      if (k % 4 === 0) {
        frames.push({
          t: Math.round(t),
          troops: troops.map(function (tr) { return [Math.round(tr.x * 10) / 10, Math.round(tr.y * 10) / 10, tr.alive ? 1 : 0]; }),
          bhp: buildings.map(function (b) { return Math.max(0, Math.round(b.hp)); })
        });
      }
      var anyTroop = troops.some(function (tr) { return tr.alive; });
      var anyBuilding = buildings.some(function (b) { return b.alive; });
      if (!anyTroop || !anyBuilding) break;
      t += dt;
    }

    var hpLeft = buildings.reduce(function (a, b) { return a + Math.max(0, b.hp); }, 0);
    var pct = totalHp ? Math.round(100 * (1 - hpLeft / totalHp)) : 100;
    var palaceDown = buildings.some(function (b) { return b.type === 'palace' && !b.alive; });
    var stars = (pct >= 50 ? 1 : 0) + (palaceDown ? 1 : 0) + (pct >= 100 ? 1 : 0);
    var lootGold = Math.round((lootPool.gold || 0) * DATA.LOOT_RATIO * pct / 100);
    var lootFood = Math.round((lootPool.food || 0) * DATA.LOOT_RATIO * pct / 100);
    var survivors = {};
    troops.forEach(function (tr) { if (tr.alive) survivors[tr.troop] = (survivors[tr.troop] || 0) + 1; });

    return {
      seed: seed, frames: frames, events: events,
      buildings: defBuildings, sent: sentByType,
      result: {
        pct: pct, stars: stars,
        loot: { gold: lootGold, food: lootFood },
        palaceDown: palaceDown,
        survivors: survivors,
        seconds: Math.round(t)
      }
    };
  }

  var api = { simulate: simulate, mulberry32: mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.GhazwaBattle = api;
})(typeof window !== 'undefined' ? window : this);
