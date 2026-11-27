/* ممالك النيل - online layer (Firebase Auth anonymous + Realtime Database).
   Loads only when a config is present; game works fully offline without it.
   Data model:
     /villages/{uid}            public village snapshot for attacks & map
     /attacks/{uid}/{pushId}    battle reports for the defender to apply
     /players/{uid}             name + lastActive
*/
(function (global) {
  'use strict';
  // filled after Firebase console setup (project: ghazwa, Yaya Google account)
  var CONFIG = {
    apiKey: 'AIzaSyBcNihvhcGLMhlqZc-RWdqEZyflzt_rPPA',
    authDomain: 'ghazwa-65255.firebaseapp.com',
    databaseURL: 'https://ghazwa-65255-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'ghazwa-65255',
    storageBucket: 'ghazwa-65255.firebasestorage.app',
    messagingSenderId: '103710511562',
    appId: '1:103710511562:web:96c820b598ad2e398c3f33'
  };

  var app = null, db = null, auth = null, uid = null, ready = false;
  var listeners = [];

  function init(onReady) {
    if (!CONFIG || !global.firebase) { if (onReady) onReady(false); return; }
    try {
      app = firebase.initializeApp(CONFIG);
      auth = firebase.auth();
      db = firebase.database();
      auth.signInAnonymously().then(function (cred) {
        uid = cred.user.uid;
        ready = true;
        db.ref('players/' + uid).update({ lastActive: firebase.database.ServerValue.TIMESTAMP });
        if (onReady) onReady(true);
      }).catch(function () { if (onReady) onReady(false); });
    } catch (e) { if (onReady) onReady(false); }
  }

  function villageSnapshot(state, D, E) {
    return {
      name: state.name,
      palaceLvl: E.palaceLevel(state),
      buildings: state.buildings.map(function (b) { return { type: b.type, x: b.x, y: b.y, lvl: b.lvl }; }),
      res: { gold: Math.floor(state.res.gold), food: Math.floor(state.res.food) },
      stats: { attacks: state.stats.attacks || 0, wins: state.stats.wins || 0, stars: state.stats.stars_won || 0 },
      createdAt: state.createdAt || null,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
  }

  var syncTimer = null;
  function sync(state, D, E) {
    if (!ready) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      try { db.ref('villages/' + uid).set(villageSnapshot(state, D, E)); } catch (e) {}
    }, 3000);
  }

  // fetch real players' villages for the kingdom map
  function fetchKingdoms(cb) {
    if (!ready) { cb([]); return; }
    db.ref('villages').limitToFirst(50).once('value').then(function (snap) {
      var out = [];
      snap.forEach(function (child) {
        if (child.key === uid) return;
        var v = child.val();
        if (!v || !v.buildings) return;
        out.push({ id: child.key, kind: 'player', name: v.name || 'لاعب', palaceLvl: v.palaceLvl || 1, snapshot: v });
      });
      cb(out);
    }).catch(function () { cb([]); });
  }

  // report an attack so the defender applies losses and sees it
  function reportAttack(defenderUid, state, result) {
    if (!ready || !defenderUid) return;
    try {
      db.ref('attacks/' + defenderUid).push({
        by: uid, name: state.name, pct: result.pct, stars: result.stars,
        lootGold: result.loot.gold, lootFood: result.loot.food,
        at: firebase.database.ServerValue.TIMESTAMP, seen: false
      });
    } catch (e) {}
  }

  // defender side: apply unseen attack losses once, return reports for UI
  function applyIncoming(state, cb) {
    if (!ready) { cb([]); return; }
    db.ref('attacks/' + uid).once('value').then(function (snap) {
      var reports = [];
      var updates = {};
      snap.forEach(function (child) {
        var a = child.val();
        if (a && !a.seen) {
          reports.push(a);
          updates[child.key + '/seen'] = true;
        }
      });
      if (Object.keys(updates).length) db.ref('attacks/' + uid).update(updates);
      cb(reports);
    }).catch(function () { cb([]); });
  }

  global.GhazwaNet = {
    init: init, sync: sync, fetchKingdoms: fetchKingdoms,
    reportAttack: reportAttack, applyIncoming: applyIncoming,
    isReady: function () { return ready; },
    getUid: function () { return uid; }
  };
})(typeof window !== 'undefined' ? window : this);
