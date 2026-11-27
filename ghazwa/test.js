const DATA = require('/downloads/ghazwa/js/data.js');
const E = require('/downloads/ghazwa/js/engine.js');
const Battle = require('/downloads/ghazwa/js/battle.js');
const AI = require('/downloads/ghazwa/js/ai.js');

let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('FAIL:', msg); } else console.log('ok:', msg); }

// --- engine basics ---
let s = E.newGame('اختبار');
ok(s.buildings.length === 3, 'starter village has 3 buildings');
ok(s.res.gold === 800 && s.res.food === 600, 'starting resources');
ok(s.missions && s.missions.items.length === 3, '3 daily missions rolled');

// place barracks
let r = E.placeBuilding(s, 'barracks', 3, 6);
ok(r.ok, 'place barracks: ' + (r.err || ''));
ok(s.res.gold === 500 && s.res.food === 300, 'barracks cost deducted');
ok(!E.hasBarracks(s), 'barracks not ready yet');
E.tick(s, Date.now() + 61000);
ok(E.hasBarracks(s), 'barracks ready after time');
ok(s.stats.buildings_done >= 1, 'buildings_done tracked');

// overlap placement rejected
r = E.placeBuilding(s, 'mine', 3, 6);
ok(!r.ok, 'overlap rejected');

// gather resources from producers first
let mine0 = s.buildings.find(b => b.type === 'mine');
let farm0 = s.buildings.find(b => b.type === 'farm');
E.tick(s, Date.now() + 3600000); // 1h production
E.collect(s, mine0.id); E.collect(s, farm0.id);
ok(s.res.gold >= 500 && s.res.food >= 400, 'collected enough for training: ' + s.res.gold + '/' + s.res.food);

// train troops
E.tick(s);
r = E.train(s, 'soldier', 5);
ok(r.ok, 'train 5 soldiers: ' + (r.err || ''));
ok(s.troops.soldier === 5, 'starting army present, training queued');
E.tick(s, Date.now() + 200000);
ok(s.troops.soldier === 10, 'soldiers trained after time, got ' + s.troops.soldier);

// mine produces and collects
let mine = s.buildings.find(b => b.type === 'mine');
E.tick(s, Date.now() + 600000); // +10 min
ok(mine.stored >= 0, 'mine tracked: ' + Math.round(mine.stored));
let g0 = s.res.gold;
let c = E.collect(s, mine.id);
ok(c.ok && c.amount > 0, 'collected gold: ' + c.amount);
ok(s.res.gold > g0, 'gold increased');

// upgrade palace
r = E.startUpgrade(s, s.buildings.find(b => b.type === 'palace').id);
ok(r.ok, 'palace upgrade started: ' + (r.err || ''));
E.tick(s, Date.now() + 130000);
ok(E.palaceLevel(s) === 2, 'palace level 2 after upgrade');

// speed up with coins (collect a cycle first, palace ate the gold)
E.tick(s, Date.now() + 3600000);
E.collect(s, mine.id); E.collect(s, s.buildings.find(b => b.type === 'farm').id);
let sto = E.placeBuilding(s, 'storage', 11, 3).building;
ok(sto && sto.readyAt, 'storage under construction');
let coins0 = s.coins;
r = E.speedUp(s, 'building', sto.id);
ok(r.ok && s.coins < coins0, 'speed up cost coins: ' + r.cost);
ok(E.buildingReady(sto), 'storage ready after speed up');

// missions claim
s.missions.items[0].progress = s.missions.items[0].goal;
coins0 = s.coins;
r = E.claimMission(s, s.missions.items[0].id);
ok(r.ok && s.coins === coins0 + r.reward, 'mission claimed +' + r.reward);
r = E.claimMission(s, s.missions.items[0].id);
ok(!r.ok, 'double claim rejected');

// --- AI village + map ---
let v = AI.genVillage(12345, 2);
ok(v.buildings.length >= 4, 'AI village lvl2 buildings: ' + v.buildings.length);
let map = AI.genMap(777, 'اختبار');
ok(map.length === 25 && map.some(e => e.kind === 'player'), 'map has 24 AI + player');

// --- battle sim ---
let sim = Battle.simulate(v.buildings,
  [{ troop: 'soldier', x: 0.5, y: 8 }, { troop: 'soldier', x: 0.5, y: 7 }, { troop: 'archer', x: 0.5, y: 9 }],
  v.loot, 999);
ok(sim.frames.length > 5, 'battle frames: ' + sim.frames.length);
ok(sim.result.pct >= 0 && sim.result.pct <= 100, 'destruction pct: ' + sim.result.pct);
ok(sim.result.stars >= 0 && sim.result.stars <= 3, 'stars: ' + sim.result.stars);

// big army should destroy most of a lvl1 village
let v1 = AI.genVillage(42, 1);
let army = [];
for (let i = 0; i < 20; i++) army.push({ troop: 'soldier', x: 0.5, y: 1 + i * 0.7 });
let sim2 = Battle.simulate(v1.buildings, army, v1.loot, 7);
ok(sim2.result.pct >= 80, 'big army wrecks lvl1 village: ' + sim2.result.pct + '%');
ok(sim2.result.stars >= 2, 'stars for big win: ' + sim2.result.stars);

// determinism
let s1 = Battle.simulate(v.buildings, [{ troop: 'soldier', x: 0.5, y: 8 }], v.loot, 5);
let s2 = Battle.simulate(v.buildings, [{ troop: 'soldier', x: 0.5, y: 8 }], v.loot, 5);
ok(JSON.stringify(s1.result) === JSON.stringify(s2.result), 'deterministic same seed');

// no troops -> 0%
let s3 = Battle.simulate(v.buildings, [], v.loot, 5);
ok(s3.result.pct === 0 && s3.result.stars === 0, 'empty attack does nothing');

console.log(fails ? `\n${fails} FAILURES` : '\nALL TESTS PASSED');
process.exit(fails ? 1 : 0);
