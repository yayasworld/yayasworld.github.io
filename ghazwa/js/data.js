/* ممالك النيل - static game data. Original content, no copied assets. */
(function (global) {
  'use strict';

  var BUILDINGS = {
    palace: {
      name: 'القصر', emoji: '🏰', size: 3, unique: true,
      desc: 'قلب قريتك. مستواه يحدد سقف باقي المباني.',
      levels: [
        { hp: 1500, cost: null, time: 0 },
        { hp: 2200, cost: { gold: 800 }, time: 120 },
        { hp: 3000, cost: { gold: 2500, food: 1500 }, time: 420 },
        { hp: 4000, cost: { gold: 7000, food: 4000 }, time: 900 }
      ]
    },
    mine: {
      name: 'منجم ذهب', emoji: '⛏️', size: 2,
      desc: 'ينتج ذهب مع الوقت. اضغط عليه للتجميع.',
      levels: [
        { hp: 400, cost: { food: 150 }, time: 30, rate: 6, store: 300 },
        { hp: 550, cost: { food: 600 }, time: 90, rate: 12, store: 800 },
        { hp: 750, cost: { food: 1800, gold: 500 }, time: 240, rate: 22, store: 1800 },
        { hp: 1000, cost: { food: 5000, gold: 2000 }, time: 600, rate: 38, store: 3500 }
      ]
    },
    farm: {
      name: 'مزرعة', emoji: '🌾', size: 2,
      desc: 'ينتج طعام للجنود والبناء.',
      levels: [
        { hp: 400, cost: { gold: 150 }, time: 30, rate: 6, store: 300 },
        { hp: 550, cost: { gold: 600 }, time: 90, rate: 12, store: 800 },
        { hp: 750, cost: { gold: 1800, food: 500 }, time: 240, rate: 22, store: 1800 },
        { hp: 1000, cost: { gold: 5000, food: 2000 }, time: 600, rate: 38, store: 3500 }
      ]
    },
    storage: {
      name: 'مخزن', emoji: '🏺', size: 2,
      desc: 'يزود سعة الذهب والطعام.',
      levels: [
        { hp: 600, cost: { gold: 200, food: 200 }, time: 45, cap: 2000 },
        { hp: 800, cost: { gold: 900, food: 900 }, time: 150, cap: 5000 },
        { hp: 1100, cost: { gold: 3000, food: 3000 }, time: 360, cap: 12000 },
        { hp: 1500, cost: { gold: 9000, food: 9000 }, time: 720, cap: 30000 }
      ]
    },
    barracks: {
      name: 'ثكنة', emoji: '⚔️', size: 2,
      desc: 'تفتح تدريب الجنود وتسرّعه.',
      levels: [
        { hp: 500, cost: { gold: 300, food: 300 }, time: 60, speed: 1 },
        { hp: 700, cost: { gold: 1200, food: 1200 }, time: 180, speed: 1.25 },
        { hp: 950, cost: { gold: 4000, food: 4000 }, time: 420, speed: 1.5 },
        { hp: 1300, cost: { gold: 10000, food: 10000 }, time: 840, speed: 1.8 }
      ]
    },
    camp: {
      name: 'معسكر', emoji: '⛺', size: 2,
      desc: 'يزود عدد الجيش اللي تقدر تحتفظ بيه.',
      levels: [
        { hp: 450, cost: { food: 250 }, time: 45, space: 15 },
        { hp: 650, cost: { food: 1000 }, time: 150, space: 30 },
        { hp: 900, cost: { food: 3500, gold: 1000 }, time: 360, space: 55 },
        { hp: 1200, cost: { food: 9000, gold: 4000 }, time: 720, space: 90 }
      ]
    },
    tower: {
      name: 'برج الحراسة', emoji: '🗼', size: 1,
      desc: 'يدافع عن قريتك وقت الهجوم.',
      levels: [
        { hp: 700, cost: { gold: 400 }, time: 90, dps: 18, range: 5 },
        { hp: 950, cost: { gold: 1600 }, time: 240, dps: 30, range: 5 },
        { hp: 1300, cost: { gold: 5000, food: 1500 }, time: 480, dps: 48, range: 6 },
        { hp: 1800, cost: { gold: 12000, food: 5000 }, time: 960, dps: 75, range: 6 }
      ]
    },
    wall: {
      name: 'سور', emoji: '🧱', size: 1,
      desc: 'يعطّل المهاجمين ويكسبك وقت.',
      levels: [
        { hp: 900, cost: { gold: 100 }, time: 15 },
        { hp: 1400, cost: { gold: 400 }, time: 30 },
        { hp: 2000, cost: { gold: 1500 }, time: 60 },
        { hp: 3000, cost: { gold: 5000 }, time: 120 }
      ]
    }
  };

  var TROOPS = {
    soldier: { name: 'جندي', emoji: '🗡️', hp: 110, dps: 22, speed: 1.1, range: 0.7, cost: { food: 25 }, time: 20, space: 1, desc: 'رخيص وسريع، عماد أي جيش.' },
    archer: { name: 'رامي سهام', emoji: '🏹', hp: 65, dps: 34, speed: 1.0, range: 3.2, cost: { food: 45 }, time: 35, space: 1, desc: 'يضرب من بعيد، بس هش.' },
    knight: { name: 'فارس', emoji: '🐎', hp: 340, dps: 50, speed: 1.9, range: 0.8, cost: { food: 130, gold: 40 }, time: 100, space: 3, desc: 'غالي، لكنه يكسر خطوط الدفاع.' }
  };

  var MISSION_POOL = [
    { id: 'collect_gold', text: 'اجمع 500 ذهب من المناجم', goal: 500, metric: 'gold_collected', reward: 5 },
    { id: 'collect_food', text: 'اجمع 500 طعام من المزارع', goal: 500, metric: 'food_collected', reward: 5 },
    { id: 'train_10', text: 'درّب 10 جنود', goal: 10, metric: 'troops_trained', reward: 5 },
    { id: 'build_1', text: 'ابنِ أو طوّر مبنى واحد', goal: 1, metric: 'buildings_done', reward: 8 },
    { id: 'attack_1', text: 'اشن غزوة واحدة', goal: 1, metric: 'attacks', reward: 10 },
    { id: 'attack_3', text: 'اشن 3 غزوات', goal: 3, metric: 'attacks', reward: 20 },
    { id: 'win_star', text: 'اكسب نجمة على الأقل في غزوة', goal: 1, metric: 'stars_won', reward: 10 },
    { id: 'loot_1000', text: 'انهب 1000 ذهب', goal: 1000, metric: 'gold_looted', reward: 12 }
  ];
  var DAILY_MISSIONS = 3;

  // Grid: 16x16 village. Palace footprint 3x3 at center.
  var GRID = 16;

  var DATA = {
    BUILDINGS: BUILDINGS, TROOPS: TROOPS,
    MISSION_POOL: MISSION_POOL, DAILY_MISSIONS: DAILY_MISSIONS,
    GRID: GRID,
    START: { gold: 800, food: 600, coins: 20 },
    BASE_CAP: 1500,          // resource cap before storage buildings
    BASE_ARMY: 10,           // army space before camps
    COIN_PER_MINUTE: 1,      // speed-up cost: 1 coin per started 2 minutes remaining
    COIN_MINUTE_CHUNK: 2,
    LOOT_RATIO: 0.3,         // share of defender stored resources lootable at 100% destruction
    BATTLE_SECONDS: 90,
    MAX_LEVEL: 4
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else global.GhazwaData = DATA;
})(typeof window !== 'undefined' ? window : this);
