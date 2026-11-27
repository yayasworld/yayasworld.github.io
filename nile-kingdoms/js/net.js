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

  var redirectError = null;

  function init(onReady) {
    if (!CONFIG || !global.firebase) { if (onReady) onReady(false); return; }
    try {
      app = firebase.initializeApp(CONFIG);
      auth = firebase.auth();
      db = firebase.database();
      var done = false;
      function finish(user) {
        if (done || !user) return;
        done = true;
        uid = user.uid;
        ready = true;
        db.ref('players/' + uid).update({ lastActive: firebase.database.ServerValue.TIMESTAMP });
        if (onReady) onReady(true);
      }
      function anon() {
        auth.signInAnonymously().then(function (cred) { finish(cred.user); })
          .catch(function () { if (onReady) onReady(false); });
      }
      auth.getRedirectResult().then(function (res) {
        if (res && res.user) { finish(res.user); return; }
        if (auth.currentUser) { finish(auth.currentUser); return; }
        anon();
      }).catch(function (e) {
        redirectError = (e && e.code) || 'err';
        if (auth.currentUser) { finish(auth.currentUser); return; }
        anon();
      });
    } catch (e) { if (onReady) onReady(false); }
  }

  function takeRedirectError() { var e = redirectError; redirectError = null; return e; }

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

  // ---------- social: friends, chat, block, report ----------
  function myCode() { return uid; }

  function signInGoogle(cb) {
    if (!auth) { cb && cb(false, 'net'); return; }
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider).catch(function (e) { cb && cb(false, (e && e.code) || 'err'); });
  }

  function linkGoogle(cb) {
    if (!auth || !auth.currentUser) { cb && cb(false, 'net'); return; }
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.currentUser.linkWithRedirect(provider).catch(function (e) { cb && cb(false, (e && e.code) || 'err'); });
  }

  function isAnonymous() { return auth && auth.currentUser ? auth.currentUser.isAnonymous : true; }

  function onRequests(cb) {
    if (!ready) return function () {};
    var ref = db.ref('friend_requests/' + uid);
    var h = ref.on('value', function (snap) {
      var out = [];
      snap.forEach(function (c) { out.push({ from: c.key, name: (c.val() && c.val().name) || 'لاعب', ts: (c.val() && c.val().ts) || 0 }); });
      cb(out);
    }, function () { cb([]); });
    return function () { ref.off('value', h); };
  }

  function onFriends(cb) {
    if (!ready) return function () {};
    var ref = db.ref('friends/' + uid);
    var h = ref.on('value', function (snap) {
      var out = [];
      snap.forEach(function (c) { out.push({ uid: c.key, name: (c.val() && c.val().name) || 'لاعب' }); });
      cb(out);
    }, function () { cb([]); });
    return function () { ref.off('value', h); };
  }

  function chatIdWith(other) { return [uid, other].sort().join('_'); }

  function sendFriendRequest(toUid, myName, cb) {
    if (!ready || !toUid || toUid === uid) { cb && cb({ ok: false, err: 'bad' }); return; }
    db.ref('villages/' + toUid + '/name').once('value').then(function (s) {
      if (!s.exists()) { cb && cb({ ok: false, err: 'no-player' }); return; }
      db.ref('friend_requests/' + toUid + '/' + uid).set({
        name: myName || 'لاعب', ts: firebase.database.ServerValue.TIMESTAMP
      }).then(function () { cb && cb({ ok: true, toName: s.val() }); })
        .catch(function () { cb && cb({ ok: false, err: 'denied' }); });
    }).catch(function () { cb && cb({ ok: false, err: 'net' }); });
  }

  function listRequests(cb) {
    if (!ready) { cb([]); return; }
    db.ref('friend_requests/' + uid).once('value').then(function (snap) {
      var out = [];
      snap.forEach(function (c) { out.push({ from: c.key, name: (c.val() && c.val().name) || 'لاعب', ts: (c.val() && c.val().ts) || 0 }); });
      cb(out);
    }).catch(function () { cb([]); });
  }

  function acceptRequest(fromUid, fromName, myName, cb) {
    if (!ready) { cb && cb(false); return; }
    var up = {};
    up['friends/' + uid + '/' + fromUid] = { name: fromName || 'لاعب', ts: firebase.database.ServerValue.TIMESTAMP };
    up['friends/' + fromUid + '/' + uid] = { name: myName || 'لاعب', ts: firebase.database.ServerValue.TIMESTAMP };
    up['friend_requests/' + uid + '/' + fromUid] = null;
    db.ref().update(up).then(function () { cb && cb(true); }).catch(function () { cb && cb(false); });
  }

  function declineRequest(fromUid, cb) {
    if (!ready) { cb && cb(false); return; }
    db.ref('friend_requests/' + uid + '/' + fromUid).remove()
      .then(function () { cb && cb(true); }).catch(function () { cb && cb(false); });
  }

  function listFriends(cb) {
    if (!ready) { cb([]); return; }
    db.ref('friends/' + uid).once('value').then(function (snap) {
      var out = [];
      snap.forEach(function (c) { out.push({ uid: c.key, name: (c.val() && c.val().name) || 'لاعب' }); });
      cb(out);
    }).catch(function () { cb([]); });
  }

  function sendChat(otherUid, text, cb) {
    if (!ready) { cb && cb(false); return; }
    db.ref('chats/' + chatIdWith(otherUid)).push({
      from: uid, text: String(text).slice(0, 500), ts: firebase.database.ServerValue.TIMESTAMP
    }).then(function () { cb && cb(true); }).catch(function () { cb && cb(false); });
  }

  function onChat(otherUid, cb) {
    if (!ready) return function () {};
    var ref = db.ref('chats/' + chatIdWith(otherUid)).limitToLast(50);
    var h = ref.on('value', function (snap) {
      var out = [];
      snap.forEach(function (c) { var m = c.val(); if (m) out.push({ from: m.from, text: m.text, ts: m.ts || 0 }); });
      out.sort(function (a, b) { return a.ts - b.ts; });
      cb(out, uid);
    }, function () { cb([], uid); });
    return function () { ref.off('value', h); };
  }

  function blockUser(otherUid, cb) {
    if (!ready) { cb && cb(false); return; }
    var up = {};
    up['blocks/' + uid + '/' + otherUid] = true;
    up['friends/' + uid + '/' + otherUid] = null;
    db.ref().update(up).then(function () { cb && cb(true); }).catch(function () { cb && cb(false); });
  }

  function reportUser(otherUid, reason, cb) {
    if (!ready) { cb && cb(false); return; }
    db.ref('modreports').push({
      reporter: uid, reported: otherUid, reason: String(reason).slice(0, 200),
      ts: firebase.database.ServerValue.TIMESTAMP
    }).then(function () { cb && cb(true); }).catch(function () { cb && cb(false); });
  }

  global.GhazwaNet = {
    init: init, sync: sync, fetchKingdoms: fetchKingdoms,
    reportAttack: reportAttack, applyIncoming: applyIncoming,
    isReady: function () { return ready; },
    getUid: function () { return uid; },
    myCode: myCode, chatIdWith: chatIdWith,
    sendFriendRequest: sendFriendRequest, listRequests: listRequests,
    acceptRequest: acceptRequest, declineRequest: declineRequest,
    listFriends: listFriends, sendChat: sendChat, onChat: onChat,
    blockUser: blockUser, reportUser: reportUser,
    signInGoogle: signInGoogle, linkGoogle: linkGoogle, isAnonymous: isAnonymous,
    takeRedirectError: takeRedirectError,
    onRequests: onRequests, onFriends: onFriends
  };
})(typeof window !== 'undefined' ? window : this);
