/* غزوة - AI opponents: names, village generator, kingdom map. Original content. */
(function (global) {
  'use strict';
  var DATA = (typeof module !== 'undefined') ? require('./data.js') : global.GhazwaData;
  var B = (typeof module !== 'undefined') ? require('./battle.js').mulberry32 : null;
  var mulberry32 = B || global.GhazwaBattle.mulberry32;

  var AI_NAMES = [
    'قلعة الصقر', 'حصن النمر', 'واحة النخيل', 'برج السلام', 'قرية الفجر',
    'حصاد الشرق', 'بوابة الصحراء', 'نجمة الليل', 'سيف الجبل', 'درع النيل',
    'عين الصقر', 'مملكة الرمال', 'حارس الوادي', 'قلعة الأمل', 'برق الجنوب',
    'سور العمالقة', 'تاج الملوك', 'رماح الفتح', 'نار الشمال', 'بحر الظلام',
    'أسد الحرب', 'فارس الغروب', 'درة المدائن', 'صخرة الزمن'
  ];

  // Build a plausible village for a given palace level using seeded RNG.
  function genVillage(seed, palaceLvl) {
    var rnd = mulberry32(seed >>> 0);
    var buildings = [];
    var occupied = {};
    function free(size) {
      for (var tries = 0; tries < 80; tries++) {
        var x = Math.floor(rnd() * (DATA.GRID - size));
        var y = Math.floor(rnd() * (DATA.GRID - size));
        var ok = true;
        for (var i = 0; i < buildings.length && ok; i++) {
          var b = buildings[i], bs = DATA.BUILDINGS[b.type].size;
          if (x < b.x + bs && x + size > b.x && y < b.y + bs && y + size > b.y) ok = false;
        }
        if (ok) return [x, y];
      }
      return null;
    }
    function put(type, lvl) {
      var pos = free(DATA.BUILDINGS[type].size);
      if (pos) buildings.push({ type: type, x: pos[0], y: pos[1], lvl: lvl });
    }
    // palace near center
    buildings.push({ type: 'palace', x: 6 + Math.floor(rnd() * 2), y: 6 + Math.floor(rnd() * 2), lvl: palaceLvl });
    function L() { return 1 + Math.floor(rnd() * palaceLvl); } // random level up to palace lvl
    put('mine', L()); put('farm', L());
    if (palaceLvl >= 2) { put('storage', L()); put('tower', L()); }
    if (palaceLvl >= 3) { put('mine', L()); put('tower', L()); put('barracks', L()); }
    if (palaceLvl >= 4) { put('farm', L()); put('tower', L()); put('wall', L()); put('wall', L()); }
    var lootBase = 400 * palaceLvl + Math.floor(rnd() * 300 * palaceLvl);
    return { buildings: buildings, loot: { gold: lootBase, food: lootBase } };
  }

  // Shared kingdom map: seeded positions on a 100x100 scrollable map.
  function genMap(mapSeed, playerName) {
    var rnd = mulberry32(mapSeed >>> 0);
    var names = AI_NAMES.slice();
    var entries = [];
    for (var i = 0; i < 24; i++) {
      var ni = Math.floor(rnd() * names.length);
      var name = names.splice(ni, 1)[0] || ('مملكة ' + (i + 1));
      var palaceLvl = 1 + Math.floor(rnd() * 4);
      entries.push({
        id: 'ai-' + i,
        kind: 'ai',
        name: name,
        x: Math.round(6 + rnd() * 88),
        y: Math.round(6 + rnd() * 88),
        palaceLvl: palaceLvl,
        villageSeed: (mapSeed * 31 + i * 7919) >>> 0
      });
    }
    // player city
    entries.push({ id: 'me', kind: 'player', name: playerName, x: 50, y: 50, palaceLvl: 0, villageSeed: 0 });
    return entries;
  }

  var api = { AI_NAMES: AI_NAMES, genVillage: genVillage, genMap: genMap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.GhazwaAI = api;
})(typeof window !== 'undefined' ? window : this);
