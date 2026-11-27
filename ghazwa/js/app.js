/* غزوة - UI controller. */
(function () {
  'use strict';
  var D = window.GhazwaData, E = window.GhazwaEngine, BT = window.GhazwaBattle, AI = window.GhazwaAI;
  var $ = function (id) { return document.getElementById(id); };
  var SAVE_KEY = 'ghazwa-save-v1';
  var MAP_SEED = 20261127;

  var state = null;
  var tab = 'village';
  var placing = null; // building type being placed
  var battle = null;  // active battle replay

  // ---------- helpers ----------
  function fmt(n) { n = Math.floor(n); return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : '' + n; }
  function fmtTime(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h > 0) return h + ':' + ('' + (m % 60)).padStart(2, '0');
    return m + ':' + ('' + (s % 60)).padStart(2, '0');
  }
  function costText(cost) {
    if (!cost) return 'مجاني';
    var parts = [];
    if (cost.gold) parts.push('🪙' + fmt(cost.gold));
    if (cost.food) parts.push('🌾' + fmt(cost.food));
    return parts.join(' ');
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._h);
    toast._h = setTimeout(function () { t.classList.add('hidden'); }, 2200);
  }
  var NET = window.GhazwaNet;

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
    if (NET && NET.isReady()) NET.sync(state, D, E);
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) { state = JSON.parse(raw); return true; }
    } catch (e) {}
    return false;
  }
  function err(res) { if (res && res.err) toast(res.err); return res; }

  // ---------- modal ----------
  function openModal(html) {
    $('modal').innerHTML = html;
    $('modal-backdrop').classList.remove('hidden');
  }
  function closeModal() { $('modal-backdrop').classList.add('hidden'); }
  $('modal-backdrop').addEventListener('click', function (e) {
    if (e.target === $('modal-backdrop')) closeModal();
  });

  // ---------- HUD ----------
  function renderHud() {
    $('res-gold').textContent = fmt(state.res.gold) + '/' + fmt(E.storageCap(state));
    $('res-food').textContent = fmt(state.res.food);
    $('res-coins').textContent = state.coins;
  }

  // ---------- village ----------
  function renderVillage() {
    var grid = $('village-grid');
    grid.innerHTML = '';
    // cells
    for (var y = 0; y < D.GRID; y++) for (var x = 0; x < D.GRID; x++) {
      var c = document.createElement('div');
      c.className = 'cell';
      c.dataset.x = x; c.dataset.y = y;
      if (placing) {
        c.classList.add(E.canPlace(state, placing, x, y) ? 'place-ok' : 'place-no');
      }
      grid.appendChild(c);
    }
    // buildings
    var nowT = Date.now();
    state.buildings.forEach(function (b) {
      var cfg = D.BUILDINGS[b.type];
      var el = document.createElement('div');
      el.className = 'bld b-size' + cfg.size + (b.readyAt ? ' working' : '');
      el.style.gridColumn = (b.x + 1) + ' / span ' + cfg.size;
      el.style.gridRow = (b.y + 1) + ' / span ' + cfg.size;
      var lvl = E.lvlOf(b);
      var html = '<span class="b-emoji">' + cfg.emoji + '</span>';
      if (b.readyAt) {
        html += '<span class="b-timer">' + fmtTime(b.readyAt - nowT) + '</span>';
      } else if ((b.type === 'mine' || b.type === 'farm') && (b.stored || 0) >= 1) {
        html += '<span class="b-collect">' + (b.type === 'mine' ? '🪙' : '🌾') + '</span>';
      }
      el.innerHTML = html;
      el.title = cfg.name + ' ' + lvl;
      el.addEventListener('click', function () { if (!placing) buildingModal(b.id); });
      grid.appendChild(el);
    });
  }

  // grid click for placement
  $('village-grid').addEventListener('click', function (e) {
    if (!placing) return;
    var cell = e.target.closest('.cell');
    if (!cell) return;
    var x = +cell.dataset.x, y = +cell.dataset.y;
    var res = E.placeBuilding(state, placing, x, y);
    if (!res.ok) { err(res); return; }
    toast(D.BUILDINGS[placing].name + ' قيد البناء 🔨');
    placing = null;
    $('placement-banner').classList.add('hidden');
    save(); renderAll();
  });
  $('btn-cancel-place').addEventListener('click', function () {
    placing = null;
    $('placement-banner').classList.add('hidden');
    renderVillage();
  });

  function buildingModal(id) {
    var b = E.byId(state, id);
    if (!b) return;
    var cfg = D.BUILDINGS[b.type];
    var lvl = E.lvlOf(b);
    var lv = cfg.levels[lvl - 1];
    var nowT = Date.now();
    var html = '<div class="row-flex"><span class="big-emoji">' + cfg.emoji + '</span>' +
      '<div class="grow"><h3>' + cfg.name + ' <span class="pill">مس ' + lvl + '</span></h3>' +
      '<div class="muted">' + cfg.desc + '</div></div></div>';
    if (b.readyAt) {
      var cost = E.speedUpCost(b.readyAt, nowT);
      html += '<p style="margin-top:10px">⏳ جاهز بعد <b>' + fmtTime(b.readyAt - nowT) + '</b></p>' +
        '<div class="modal-actions"><button class="btn btn-gold" id="m-speed">إنهاء فوري 💎' + cost + '</button>' +
        '<button class="btn" id="m-close">رجوع</button></div>';
      openModal(html);
      $('m-speed').addEventListener('click', function () {
        var r = E.speedUp(state, 'building', id);
        if (r.ok) { toast('اتسرّع بالكوينز ⚡'); save(); closeModal(); renderAll(); } else err(r);
      });
      $('m-close').addEventListener('click', closeModal);
      return;
    }
    var actions = '';
    if ((b.type === 'mine' || b.type === 'farm') && (b.stored || 0) >= 1) {
      actions += '<button class="btn btn-primary" id="m-collect">تجميع (' + Math.floor(b.stored) + ' ' + (b.type === 'mine' ? '🪙' : '🌾') + ')</button>';
    }
    var maxL = Math.min(cfg.levels.length, E.maxLevelFor(state, b.type));
    if (b.lvl < maxL) {
      var next = cfg.levels[b.lvl];
      var afford = E.canAfford(state, next.cost);
      actions += '<button class="btn btn-primary" id="m-up" ' + (afford ? '' : 'disabled') + '>ترقية لمس ' + (b.lvl + 1) + ' (' + costText(next.cost) + ' · ' + fmtTime(next.time * 1000) + ')</button>';
      if (!afford) actions += '<div class="cost no" style="text-align:center">الموارد مش كفاية</div>';
    } else if (b.lvl >= cfg.levels.length) {
      actions += '<div class="muted" style="text-align:center">وصل لأعلى مستوى ⭐</div>';
    } else {
      actions += '<div class="muted" style="text-align:center">طوّر القصر الأول 🏰</div>';
    }
    actions += '<button class="btn" id="m-close">رجوع</button>';
    openModal(html + '<div class="modal-actions">' + actions + '</div>');
    if ($('m-collect')) $('m-collect').addEventListener('click', function () {
      var r = E.collect(state, id);
      if (r.ok) { toast('+' + r.amount + (b.type === 'mine' ? ' 🪙' : ' 🌾')); save(); closeModal(); renderAll(); }
    });
    if ($('m-up')) $('m-up').addEventListener('click', function () {
      var r = E.startUpgrade(state, id);
      if (r.ok) { toast('بدأت الترقية 🔨'); save(); closeModal(); renderAll(); } else { err(r); closeModal(); }
    });
    $('m-close').addEventListener('click', closeModal);
  }

  function buildMenu() {
    var html = '<h3>ابنِ مبنى جديد</h3><div class="modal-actions">';
    Object.keys(D.BUILDINGS).forEach(function (type) {
      var cfg = D.BUILDINGS[type];
      var owned = state.buildings.filter(function (b) { return b.type === type; }).length;
      if (cfg.unique && owned) return;
      var cost = cfg.levels[0].cost;
      var afford = E.canAfford(state, cost);
      html += '<div class="build-opt" data-type="' + type + '" ' + (afford ? '' : 'style="opacity:.45"') + '>' +
        '<span class="big-emoji">' + cfg.emoji + '</span>' +
        '<div class="grow"><b>' + cfg.name + '</b><div class="muted">' + cfg.desc + '</div></div>' +
        '<span class="cost' + (afford ? '' : ' no') + '">' + costText(cost) + '</span></div>';
    });
    html += '<button class="btn" id="m-close">رجوع</button></div>';
    openModal(html);
    $('modal').querySelectorAll('.build-opt').forEach(function (el) {
      el.addEventListener('click', function () {
        var type = el.dataset.type;
        var cfg = D.BUILDINGS[type];
        if (!E.canAfford(state, cfg.levels[0].cost)) { toast('الموارد مش كفاية'); return; }
        placing = type;
        closeModal();
        switchTab('village');
        $('placement-banner').classList.remove('hidden');
        renderVillage();
      });
    });
    $('m-close').addEventListener('click', closeModal);
  }

  // ---------- army ----------
  function renderArmy() {
    var used = E.armyUsed(state), sp = E.armySpace(state);
    $('army-space').textContent = 'سعة الجيش: ' + used + ' / ' + sp + (E.hasBarracks(state) ? '' : ' — ابنِ ثكنة للتدريب ⚔️');
    var list = $('army-list');
    list.innerHTML = '';
    Object.keys(D.TROOPS).forEach(function (k) {
      var t = D.TROOPS[k];
      var card = document.createElement('div');
      card.className = 'card troop-card';
      card.innerHTML = '<span class="big-emoji">' + t.emoji + '</span>' +
        '<div class="grow"><b>' + t.name + '</b><div class="muted">' + t.desc + '</div></div>' +
        '<span class="troop-count">×' + state.troops[k] + '</span>';
      list.appendChild(card);
    });
    var q = $('train-queue');
    q.innerHTML = '';
    var nowT = Date.now();
    state.training.forEach(function (item, i) {
      var t = D.TROOPS[item.troop];
      var div = document.createElement('div');
      div.className = 'queue-item';
      div.innerHTML = '<span>' + t.emoji + '</span><span class="grow">' + t.name + ' ×' + item.count + '</span>' +
        '<span>⏳ ' + fmtTime(item.readyAt - nowT) + '</span>' +
        '<button class="btn btn-small btn-gold" data-i="' + i + '">💎</button>';
      q.appendChild(div);
    });
    q.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = E.speedUp(state, 'training', +btn.dataset.i);
        if (r.ok) { toast('اتسرّع ⚡'); save(); renderAll(); } else err(r);
      });
    });
    var tl = $('train-list');
    tl.innerHTML = '';
    Object.keys(D.TROOPS).forEach(function (k) {
      var t = D.TROOPS[k];
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<div class="row-flex"><span class="big-emoji">' + t.emoji + '</span>' +
        '<div class="grow"><b>' + t.name + '</b><div class="cost">' + costText({ gold: (t.cost.gold || 0) * 5, food: (t.cost.food || 0) * 5 }) + ' / 5</div></div>' +
        '<div class="stepper"><button class="btn btn-small" data-k="' + k + '" data-n="1">+1</button>' +
        '<button class="btn btn-small btn-primary" data-k="' + k + '" data-n="5">+5</button></div></div>';
      tl.appendChild(card);
    });
    tl.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = E.train(state, btn.dataset.k, +btn.dataset.n);
        if (r.ok) { toast('في التدريب 🏋️'); save(); renderAll(); } else err(r);
      });
    });
  }

  // ---------- map ----------
  var mapEntries = null;
  var onlineEntries = [];
  function renderMap() {
    if (!mapEntries) mapEntries = AI.genMap(MAP_SEED, state.name);
    var list = $('map-list');
    list.innerHTML = '';
    if (NET && NET.isReady()) {
      NET.fetchKingdoms(function (real) {
        onlineEntries = real;
        renderMap();
      });
    }
    onlineEntries.forEach(function (e2) {
      var card = document.createElement('div');
      card.className = 'card kingdom';
      var st = '';
      for (var i = 0; i < 4; i++) st += i < e2.palaceLvl ? '★' : '☆';
      var loot = (e2.snapshot && e2.snapshot.res) ? e2.snapshot.res : { gold: 0, food: 0 };
      card.innerHTML = '<span class="k-emoji">👤</span>' +
        '<div class="grow"><b>' + e2.name + ' (لاعب حقيقي)</b><div class="stars">' + st + '</div>' +
        '<div class="muted">غنيمة متوقعة: 🪙' + fmt(loot.gold * D.LOOT_RATIO) + ' 🌾' + fmt(loot.food * D.LOOT_RATIO) + '</div></div>' +
        '<button class="btn btn-small btn-danger">غزوة ⚔️</button>';
      card.querySelector('button').addEventListener('click', function () { attackPrep(e2); });
      list.appendChild(card);
    });
    mapEntries.forEach(function (e2) {
      if (e2.kind === 'player') return;
      var v = AI.genVillage(e2.villageSeed, e2.palaceLvl, e2.arch);
      var card = document.createElement('div');
      card.className = 'card kingdom';
      var st = '';
      for (var i = 0; i < 4; i++) st += i < e2.palaceLvl ? '★' : '☆';
      var best = (state.bestStars || {})[e2.id] || 0;
      var bestTxt = best ? ' · أفضل نتيجة: ' + '⭐'.repeat(best) : '';
      card.innerHTML = '<span class="k-emoji">🏯</span>' +
        '<div class="grow"><b>' + e2.name + ' <span class="pill">' + AI.ARCHS[e2.arch].label + '</span></b><div class="stars">' + st + '</div>' +
        '<div class="muted">غنيمة متوقعة: 🪙' + fmt(v.loot.gold * D.LOOT_RATIO) + ' 🌾' + fmt(v.loot.food * D.LOOT_RATIO) + bestTxt + '</div></div>' +
        '<button class="btn btn-small btn-danger">غزوة ⚔️</button>';
      card.querySelector('button').addEventListener('click', function () { attackPrep(e2); });
      list.appendChild(card);
    });
  }

  // ---------- battle ----------
  function attackPrep(entry) {
    var used = E.armyUsed(state);
    if (used <= 0) { toast('جيشك فاضي، درّب جنود الأول ⚔️'); switchTab('army'); return; }
    var v = entry.kind === 'player'
      ? { buildings: entry.snapshot.buildings, loot: entry.snapshot.res || { gold: 0, food: 0 } }
      : AI.genVillage(entry.villageSeed, entry.palaceLvl, entry.arch);
    var html = '<h3>غزوة على ' + entry.name + '</h3>' +
      '<p class="muted">هتبعت كل جيشك الجاهز. اللي ينجو يرجع معاك.</p>' +
      '<div class="card"><div class="muted">الغنيمة عند التدمير الكامل:</div>' +
      '<b>🪙' + fmt(v.loot.gold * D.LOOT_RATIO) + ' · 🌾' + fmt(v.loot.food * D.LOOT_RATIO) + '</b></div>' +
      '<div class="modal-actions"><button class="btn btn-danger" id="m-attack">ابدأ الهجوم ⚔️</button>' +
      '<button class="btn" id="m-close">رجوع</button></div>';
    openModal(html);
    $('m-attack').addEventListener('click', function () {
      closeModal();
      startBattle(entry, v);
    });
    $('m-close').addEventListener('click', closeModal);
  }

  function startBattle(entry, village) {
    // deploy whole army along the west edge
    var deploy = [];
    var y = 1;
    Object.keys(state.troops).forEach(function (k) {
      for (var i = 0; i < state.troops[k]; i++) {
        deploy.push({ troop: k, x: 0.5, y: 0.5 + (y % (D.GRID - 1)) });
        y += 0.8;
      }
    });
    var sent = {};
    deploy.forEach(function (d) { sent[d.troop] = (sent[d.troop] || 0) + 1; });
    // remove sent troops now
    Object.keys(sent).forEach(function (k) { state.troops[k] -= sent[k]; });
    E.track(state, 'attacks', 1);

    var seed = (Date.now() % 2147483647) >>> 0;
    var defB = village.buildings.map(function (b) { return { type: b.type, x: b.x, y: b.y, lvl: b.lvl }; });
    var sim = BT.simulate(defB, deploy, village.loot, seed);

    battle = { sim: sim, frame: 0, entry: entry, deploy: deploy };
    showScreen('battle');
    $('battle-title').textContent = 'غزوة على ' + entry.name;
    renderBattleStart();
    var iv = setInterval(function () {
      if (!battle) { clearInterval(iv); return; }
      battle.frame++;
      if (battle.frame >= battle.sim.frames.length) {
        clearInterval(iv);
        endBattle();
        return;
      }
      renderBattleFrame();
    }, 300);
    battle.iv = iv;
  }

  function renderBattleStart() {
    var grid = $('battle-grid');
    grid.innerHTML = '';
    battle.els = { b: [], t: [] };
    battle.sim.buildings.forEach(function (b, i) {
      var cfg = D.BUILDINGS[b.type];
      var el = document.createElement('div');
      el.className = 'bb';
      el.style.left = (b.x / D.GRID * 100) + '%';
      el.style.top = (b.y / D.GRID * 100) + '%';
      el.style.width = (cfg.size / D.GRID * 100) + '%';
      el.style.height = (cfg.size / D.GRID * 100) + '%';
      el.innerHTML = cfg.emoji + '<span class="hpbar"><div style="width:100%"></div></span>';
      grid.appendChild(el);
      battle.els.b.push(el);
    });
    battle.deploy.forEach(function (d, i) {
      var el = document.createElement('div');
      el.className = 'bt';
      el.textContent = D.TROOPS[d.troop].emoji;
      el.style.left = (d.x / D.GRID * 100) + '%';
      el.style.top = (d.y / D.GRID * 100) + '%';
      grid.appendChild(el);
      battle.els.t.push(el);
    });
    renderBattleFrame();
  }

  function renderBattleFrame() {
    var f = battle.sim.frames[battle.frame];
    if (!f) return;
    f.troops.forEach(function (tr, i) {
      var el = battle.els.t[i];
      if (!el) return;
      el.style.left = (tr[0] / D.GRID * 100) + '%';
      el.style.top = (tr[1] / D.GRID * 100) + '%';
      el.classList.toggle('dead', !tr[2]);
    });
    f.bhp.forEach(function (hp, i) {
      var el = battle.els.b[i];
      var max = D.BUILDINGS[battle.sim.buildings[i].type].levels[(battle.sim.buildings[i].lvl || 1) - 1].hp;
      var bar = el.querySelector('.hpbar > div');
      if (bar) bar.style.width = Math.max(0, hp / max * 100) + '%';
      el.classList.toggle('destroyed', hp <= 0);
    });
    $('battle-timer').textContent = Math.max(0, D.BATTLE_SECONDS - f.t);
    // live pct from hp
    var tot = 0, left = 0;
    battle.sim.buildings.forEach(function (b, i) {
      var max = D.BUILDINGS[b.type].levels[(b.lvl || 1) - 1].hp;
      tot += max; left += Math.max(0, f.bhp[i]);
    });
    $('battle-pct').textContent = Math.round(100 * (1 - left / tot)) + '%';
  }

  function endBattle() {
    var r = battle.sim.result;
    clearInterval(battle.iv);
    // apply outcome
    // loot is capped by what the surviving army can carry (100 + 20 per survivor)
    var survivorCount = 0;
    Object.keys(r.survivors).forEach(function (k) { survivorCount += r.survivors[k]; state.troops[k] += r.survivors[k]; });
    var carry = 100 + survivorCount * 20;
    var gotGold = Math.min(r.loot.gold, carry), gotFood = Math.min(r.loot.food, carry);
    var cap = E.storageCap(state);
    state.res.gold = Math.min(cap, state.res.gold + gotGold);
    state.res.food = Math.min(cap, state.res.food + gotFood);
    E.track(state, 'gold_looted', gotGold);
    E.track(state, 'stars_won', r.stars);
    if (r.stars > 0) E.track(state, 'wins', 1);
    if (!state.bestStars) state.bestStars = {};
    if (battle.entry && r.stars > (state.bestStars[battle.entry.id] || 0)) state.bestStars[battle.entry.id] = r.stars;
    if (battle.entry && battle.entry.kind === 'player' && NET && NET.isReady()) {
      NET.reportAttack(battle.entry.id, state, r);
    }
    save();
    var stars = '';
    for (var i = 0; i < 3; i++) stars += i < r.stars ? '⭐' : '▫️';
    var html = '<h3 style="text-align:center">' + (r.stars > 0 ? 'نصر! 🎉' : 'هزيمة… 💀') + '</h3>' +
      '<div class="result-stars">' + stars + '</div>' +
      '<div class="result-line">التدمير: ' + r.pct + '%</div>' +
      '<div class="result-line">الغنيمة: 🪙' + gotGold + ' · 🌾' + gotFood + '</div>' +
      '<div class="modal-actions"><button class="btn btn-primary" id="m-back">ارجع للقرية 🏰</button></div>';
    battle = null;
    openModal(html);
    $('m-back').addEventListener('click', function () {
      closeModal();
      showScreen(tab === 'map' ? 'map' : 'village');
      renderAll();
    });
  }

  // ---------- missions ----------
  function renderMissions() {
    var list = $('mission-list');
    list.innerHTML = '';
    state.missions.items.forEach(function (m) {
      var card = document.createElement('div');
      card.className = 'card mission' + (m.progress >= m.goal && !m.claimed ? ' done' : '');
      var pctM = Math.min(100, Math.round(m.progress / m.goal * 100));
      card.innerHTML = '<div class="grow"><b>' + m.text + '</b>' +
        '<div class="row-flex" style="margin-top:6px"><div class="bar"><div style="width:' + pctM + '%"></div></div>' +
        '<span class="muted">' + Math.floor(m.progress) + '/' + m.goal + '</span></div></div>' +
        (m.claimed ? '<span class="pill">✅</span>' :
          '<button class="btn btn-small ' + (m.progress >= m.goal ? 'btn-gold' : '') + '" ' + (m.progress >= m.goal ? '' : 'disabled') + '>💎' + m.reward + '</button>');
      var btn = card.querySelector('button');
      if (btn) btn.addEventListener('click', function () {
        var r = E.claimMission(state, m.id);
        if (r.ok) { toast('+' + r.reward + ' كوينز 💎'); save(); renderAll(); } else err(r);
      });
      list.appendChild(card);
    });
  }

  // ---------- store ----------
  function storeModal() {
    var packs = [
      { n: 'كيس كوينز', c: 80, p: 'قريباً' },
      { n: 'صندوق كوينز', c: 500, p: 'قريباً' },
      { n: 'كنز الغازي', c: 1200, p: 'قريباً' }
    ];
    var html = '<h3>متجر الكوينز 💎</h3><p class="muted">اكسب كوينز مجانية من مهام اليوم 📜، أو اشترِ باقات لتسرّع تطويرك.</p><div class="modal-actions">';
    packs.forEach(function (p) {
      html += '<div class="build-opt" style="opacity:.6"><span class="big-emoji">💎</span>' +
        '<div class="grow"><b>' + p.n + '</b><div class="muted">' + p.c + ' كوينز</div></div>' +
        '<span class="pill">' + p.p + '</span></div>';
    });
    html += '<button class="btn" id="m-close">رجوع</button></div>';
    openModal(html);
    $('m-close').addEventListener('click', closeModal);
  }
  $('btn-store').addEventListener('click', storeModal);
  $('btn-skip').addEventListener('click', function () {
    if (battle) { clearInterval(battle.iv); battle.frame = battle.sim.frames.length - 1; endBattle(); }
  });

  // ---------- navigation ----------
  function showScreen(name) {
    ['start', 'village', 'army', 'map', 'missions', 'battle'].forEach(function (s) {
      $('screen-' + s).classList.toggle('hidden', s !== name);
    });
    $('hud').classList.toggle('hidden', name === 'start' || name === 'battle');
    $('tabbar').classList.toggle('hidden', name === 'start' || name === 'battle');
  }
  function switchTab(name) {
    tab = name;
    showScreen(name);
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    renderAll();
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { switchTab(t.dataset.tab); });
  });

  // build FAB on village screen (inside tab bar area: use long-press? no - add floating button)
  var fab = document.createElement('button');
  fab.id = 'btn-build';
  fab.className = 'btn btn-gold';
  fab.textContent = '🔨 ابنِ';
  fab.style.cssText = 'position:absolute;bottom:16px;left:16px;width:auto;padding:12px 22px;z-index:7;box-shadow:0 4px 12px rgba(0,0,0,.25)';
  fab.addEventListener('click', buildMenu);
  $('screen-village').appendChild(fab);

  // ---------- render loop ----------
  function renderAll() {
    if (!state) return;
    renderHud();
    if (tab === 'village') renderVillage();
    else if (tab === 'army') renderArmy();
    else if (tab === 'map') renderMap();
    else if (tab === 'missions') renderMissions();
  }

  setInterval(function () {
    if (!state || battle) return;
    E.tick(state);
    // light refresh for timers/collect badges
    renderHud();
    if (tab === 'village') renderVillage();
    if (tab === 'army') renderArmy();
  }, 1000);
  setInterval(save, 10000);

  // ---------- online boot ----------
  function netBoot() {
    if (!NET) return;
    NET.init(function (okNet) {
      if (!okNet) return;
      save();
      NET.applyIncoming(state, function (reports) {
        if (!reports.length) return;
        var g = 0, f = 0;
        reports.forEach(function (a) { g += a.lootGold || 0; f += a.lootFood || 0; });
        state.res.gold = Math.max(0, state.res.gold - g);
        state.res.food = Math.max(0, state.res.food - f);
        save(); renderAll();
        var last = reports[reports.length - 1];
        openModal('<h3 style="text-align:center">اتهاجمت! 🛡️</h3>' +
          '<p class="result-line">' + reports.length + ' غزوة على قريتك وانت مش موجود</p>' +
          '<p class="result-line">آخر مهاجم: ' + (last.name || 'مجهول') + ' (' + (last.pct || 0) + '%)</p>' +
          '<p class="result-line">خسرت: 🪙' + g + ' · 🌾' + f + '</p>' +
          '<div class="modal-actions"><button class="btn btn-primary" id="m-ok">فهمت</button></div>');
        $('m-ok').addEventListener('click', closeModal);
      });
    });
  }

  // ---------- boot ----------
  function boot() {
    var qs = new URLSearchParams(location.search);
    if (qs.get('demo')) {
      state = E.newGame(qs.get('demo'));
      state.res.gold = 9000; state.res.food = 9000;
      state.troops = { soldier: 8, archer: 6, knight: 2 };
      save();
      showScreen('village');
      switchTab(qs.get('tab') || 'village');
      if (qs.get('battle') === '1') {
        var entries = AI.genMap(MAP_SEED, state.name).filter(function (e2) { return e2.kind === 'ai'; });
        var en = entries[0];
        startBattle(en, AI.genVillage(en.villageSeed, en.palaceLvl, en.arch));
      }
      netBoot();
      return;
    }
    if (load() && state && state.name) {
      E.tick(state);
      showScreen('village');
      switchTab('village');
      netBoot();
    } else {
      showScreen('start');
    }
  }
  $('btn-start').addEventListener('click', function () {
    var name = ($('input-name').value || '').trim() || 'غازي';
    state = E.newGame(name);
    save();
    showScreen('village');
    switchTab('village');
    netBoot();
    toast('أهلاً يا ' + name + '! 🏰');
  });
  $('input-name').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('btn-start').click();
  });

  boot();
})();
