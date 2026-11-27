/* غزوة - core engine: state, economy, timers, missions. No DOM. Node-testable. */
(function (global) {
  'use strict';
  var DATA = (typeof module !== 'undefined') ? require('./data.js') : global.GhazwaData;
  var B = DATA.BUILDINGS, T = DATA.TROOPS;

  function now() { return Date.now(); }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  function newGame(name) {
    var s = {
      v: 1, name: name || 'غازي',
      res: { gold: DATA.START.gold, food: DATA.START.food },
      coins: DATA.START.coins,
      buildings: [], nextBId: 1,
      troops: { soldier: 5, archer: 0, knight: 0 },
      training: [],        // [{troop, count, readyAt}]
      missions: null,      // {day, items:[...]}
      bestStars: {},       // map entry id -> best star count
      stats: { gold_collected: 0, food_collected: 0, troops_trained: 0, buildings_done: 0, attacks: 0, stars_won: 0, gold_looted: 0, wins: 0 },
      lastTick: now()
    };
    // starter village: palace + one mine + one farm, ready
    addBuilding(s, 'palace', 6, 6, true);
    addBuilding(s, 'mine', 3, 3, true);
    addBuilding(s, 'farm', 11, 11, true);
    rollMissions(s, s.lastTick);
    return s;
  }

  function addBuilding(s, type, x, y, instant) {
    var b = { id: s.nextBId++, type: type, x: x, y: y, lvl: 1, readyAt: instant ? null : now() + B[type].levels[0].time * 1000, stored: 0 };
    s.buildings.push(b);
    if (instant) track(s, 'buildings_done', 1);
    return b;
  }

  function byId(s, id) { for (var i = 0; i < s.buildings.length; i++) if (s.buildings[i].id === id) return s.buildings[i]; return null; }
  function lvlOf(b) { return b.readyAt ? Math.max(1, b.lvl - 1) : b.lvl; } // while upgrading, old level applies
  function buildingReady(b) { return !b.readyAt; }
  function palaceLevel(s) { var p = s.buildings.filter(function (b) { return b.type === 'palace'; })[0]; return p ? lvlOf(p) : 1; }
  function maxLevelFor(s, type) { if (type === 'palace') return DATA.MAX_LEVEL; return palaceLevel(s); }

  function storageCap(s) {
    var cap = DATA.BASE_CAP;
    s.buildings.forEach(function (b) {
      if (b.type === 'storage' && buildingReady(b)) cap += B.storage.levels[lvlOf(b) - 1].cap;
    });
    return cap;
  }
  function armySpace(s) {
    var sp = DATA.BASE_ARMY;
    s.buildings.forEach(function (b) {
      if (b.type === 'camp' && buildingReady(b)) sp += B.camp.levels[lvlOf(b) - 1].space;
    });
    return sp;
  }
  function armyUsed(s) {
    var u = 0;
    for (var k in s.troops) u += s.troops[k] * T[k].space;
    return u;
  }
  function barracksSpeed(s) {
    var sp = 0;
    s.buildings.forEach(function (b) {
      if (b.type === 'barracks' && buildingReady(b)) sp = Math.max(sp, B.barracks.levels[lvlOf(b) - 1].speed);
    });
    return sp;
  }
  function hasBarracks(s) { return s.buildings.some(function (b) { return b.type === 'barracks' && buildingReady(b); }); }

  function footprintsOverlap(s, type, x, y, ignoreId) {
    var size = B[type].size;
    for (var i = 0; i < s.buildings.length; i++) {
      var b = s.buildings[i];
      if (ignoreId && b.id === ignoreId) continue;
      var bs = B[b.type].size;
      if (x < b.x + bs && x + size > b.x && y < b.y + bs && y + size > b.y) return true;
    }
    return false;
  }
  function canPlace(s, type, x, y) {
    var size = B[type].size;
    if (x < 0 || y < 0 || x + size > DATA.GRID || y + size > DATA.GRID) return false;
    if (B[type].unique && s.buildings.some(function (b) { return b.type === type; })) return false;
    return !footprintsOverlap(s, type, x, y);
  }
  function canAfford(s, cost) {
    if (!cost) return true;
    return (!cost.gold || s.res.gold >= cost.gold) && (!cost.food || s.res.food >= cost.food);
  }
  function pay(s, cost) {
    if (!canAfford(s, cost)) return false;
    if (cost) { s.res.gold -= (cost.gold || 0); s.res.food -= (cost.food || 0); }
    return true;
  }

  function placeBuilding(s, type, x, y) {
    if (!B[type]) return { ok: false, err: 'مبنى غير معروف' };
    if (!canPlace(s, type, x, y)) return { ok: false, err: 'المكان مش فاضي' };
    if (!pay(s, B[type].levels[0].cost)) return { ok: false, err: 'الموارد مش كفاية' };
    var b = addBuilding(s, type, x, y, false);
    return { ok: true, building: b };
  }
  function startUpgrade(s, id) {
    var b = byId(s, id);
    if (!b || b.readyAt) return { ok: false, err: 'المبنى مشغول' };
    var max = Math.min(B[b.type].levels.length, maxLevelFor(s, b.type));
    if (b.lvl >= max) return { ok: false, err: b.lvl >= B[b.type].levels.length ? 'أعلى مستوى' : 'طوّر القصر الأول' };
    var lv = B[b.type].levels[b.lvl]; // next level config (index = target lvl)
    if (!pay(s, lv.cost)) return { ok: false, err: 'الموارد مش كفاية' };
    b.lvl += 1;
    b.readyAt = now() + lv.time * 1000;
    return { ok: true };
  }
  function speedUpCost(readyAt, at) {
    var msLeft = Math.max(0, readyAt - at);
    var minutes = Math.ceil(msLeft / 60000);
    return Math.max(1, Math.ceil(minutes / DATA.COIN_MINUTE_CHUNK));
  }
  function speedUp(s, kind, id) {
    var t = now();
    var readyAt = null;
    if (kind === 'building') { var b = byId(s, id); if (!b || !b.readyAt) return { ok: false }; readyAt = b.readyAt; }
    else if (kind === 'training') { var q = s.training[id]; if (!q) return { ok: false }; readyAt = q.readyAt; }
    else return { ok: false };
    var cost = speedUpCost(readyAt, t);
    if (s.coins < cost) return { ok: false, err: 'الكوينز مش كفاية', cost: cost };
    s.coins -= cost;
    if (kind === 'building') byId(s, id).readyAt = t;
    else s.training[id].readyAt = t;
    tick(s, t);
    return { ok: true, cost: cost };
  }

  function collect(s, id) {
    var b = byId(s, id);
    if (!b || (b.type !== 'mine' && b.type !== 'farm') || !buildingReady(b)) return { ok: false };
    var lv = B[b.type].levels[b.lvl - 1];
    var amount = Math.floor(Math.min(b.stored, lv.store));
    if (amount <= 0) return { ok: false, err: 'فاضي' };
    b.stored -= amount;
    var cap = storageCap(s);
    var key = b.type === 'mine' ? 'gold' : 'food';
    var room = Math.max(0, cap - s.res[key]);
    var taken = Math.min(amount, room);
    s.res[key] += taken;
    track(s, key + '_collected', taken);
    return { ok: true, amount: taken, lost: amount - taken };
  }

  function train(s, troop, count) {
    if (!T[troop] || !hasBarracks(s)) return { ok: false, err: 'محتاج ثكنة' };
    count = Math.floor(count);
    if (count < 1) return { ok: false, err: 'العدد غلط' };
    var spaceLeft = armySpace(s) - armyUsed(s) - queuedSpace(s);
    if (T[troop].space * count > spaceLeft) return { ok: false, err: 'المعسكر مليان' };
    var costGold = (T[troop].cost.gold || 0) * count, costFood = (T[troop].cost.food || 0) * count;
    if (!pay(s, { gold: costGold, food: costFood })) return { ok: false, err: 'الموارد مش كفاية' };
    var spd = barracksSpeed(s) || 1;
    var t = now();
    var lastReady = s.training.length ? s.training[s.training.length - 1].readyAt : t;
    var start = Math.max(t, lastReady);
    var readyAt = start + Math.ceil(T[troop].time * count / spd) * 1000;
    s.training.push({ troop: troop, count: count, readyAt: readyAt });
    return { ok: true };
  }
  function queuedSpace(s) {
    var u = 0;
    s.training.forEach(function (q) { u += T[q.troop].space * q.count; });
    return u;
  }

  function track(s, metric, amount) {
    if (!amount) return;
    s.stats[metric] = (s.stats[metric] || 0) + amount;
    if (s.missions) s.missions.items.forEach(function (m) {
      if (m.metric === metric && !m.claimed) m.progress = Math.min(m.goal, m.progress + amount);
    });
  }
  function rollMissions(s, t) {
    var pool = DATA.MISSION_POOL.slice();
    var items = [];
    while (items.length < DATA.DAILY_MISSIONS && pool.length) {
      var i = Math.floor(Math.random() * pool.length);
      var m = pool.splice(i, 1)[0];
      items.push({ id: m.id, text: m.text, goal: m.goal, metric: m.metric, reward: m.reward, progress: 0, claimed: false });
    }
    s.missions = { day: dayKey(t), items: items };
  }
  function claimMission(s, id) {
    if (!s.missions) return { ok: false };
    for (var i = 0; i < s.missions.items.length; i++) {
      var m = s.missions.items[i];
      if (m.id === id && !m.claimed && m.progress >= m.goal) {
        m.claimed = true;
        s.coins += m.reward;
        return { ok: true, reward: m.reward };
      }
    }
    return { ok: false, err: 'لسه ما خلصتش' };
  }

  function tick(s, t) {
    t = t || now();
    var dt = Math.max(0, (t - s.lastTick) / 1000);
    // finish constructions/upgrades
    s.buildings.forEach(function (b) {
      if (b.readyAt && t >= b.readyAt) { b.readyAt = null; track(s, 'buildings_done', 1); }
    });
    // production accumulation (per minute rates)
    s.buildings.forEach(function (b) {
      if ((b.type === 'mine' || b.type === 'farm') && buildingReady(b)) {
        var lv = B[b.type].levels[b.lvl - 1];
        b.stored = Math.min(lv.store, (b.stored || 0) + lv.rate * dt / 60);
      }
    });
    // finish training queue
    for (var i = s.training.length - 1; i >= 0; i--) {
      if (t >= s.training[i].readyAt) {
        var q = s.training[i];
        s.troops[q.troop] += q.count;
        track(s, 'troops_trained', q.count);
        s.training.splice(i, 1);
      }
    }
    // new day -> new missions
    if (!s.missions || s.missions.day !== dayKey(t)) rollMissions(s, t);
    s.lastTick = t;
    return s;
  }

  var api = {
    newGame: newGame, tick: tick, dayKey: dayKey,
    placeBuilding: placeBuilding, startUpgrade: startUpgrade, speedUp: speedUp, speedUpCost: speedUpCost,
    collect: collect, train: train, track: track, claimMission: claimMission,
    storageCap: storageCap, armySpace: armySpace, armyUsed: armyUsed, queuedSpace: queuedSpace,
    palaceLevel: palaceLevel, maxLevelFor: maxLevelFor, canPlace: canPlace, canAfford: canAfford,
    hasBarracks: hasBarracks, buildingReady: buildingReady, byId: byId, lvlOf: lvlOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.GhazwaEngine = api;
})(typeof window !== 'undefined' ? window : this);
