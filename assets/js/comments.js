// 글 아래의 댓글.
// 댓글은 사이트 파일이 아니라 Firebase(Firestore)에 넣고 글을 열 때마다 불러온다. 그래서 쓰는 즉시 보인다.
// 누구나 이름과 내용만 적으면 쓸 수 있다 (가입·승인 없음).
//   저장 자리: pages/<글 파일 경로를 글자로 바꾼 것>/comments/<자동 id> = { name, text, uid, pw(비밀번호 있음), edited }
//   쓴 시각은 Firestore 가 매긴다.
//
// 고치기·지우기 (설정에 Firebase 웹 API 키가 있을 때):
//   - 댓글을 처음 쓸 때 그 브라우저에 이름 없는 계정(익명 로그인)이 하나 생기고, 댓글에 그 계정 번호(uid)가 적힌다.
//     같은 브라우저에서는 자기가 쓴 댓글을 고치거나 지울 수 있다.
//   - 댓글을 쓸 때 비밀번호를 적어 두면 다른 기기·다른 브라우저에서도 그 비밀번호로 고치거나 지울 수 있다.
//     비밀번호는 그대로 보내지 않고 바꾼 값(SHA-256)만 보낸다. 저장되는 자리는 아무도 읽을 수 없고(…/secret/key),
//     맞는 비밀번호를 넣은 브라우저는 그 댓글에 확인 기록(…/claims/<계정 번호>)이 생겨 고치고 지울 수 있게 된다.
//   - 글쓴이는 글 쓰기 쪽에서 '댓글 관리 로그인'을 하면 모든 댓글을 지울 수 있고, 글쓴이의 댓글에는 '글쓴이' 표시가 붙는다.
//   누가 무엇을 할 수 있는지는 Firestore 규칙이 정한다 (README 의 '댓글'). 여기서는 단추만 보여 준다.
(function () {
  var body = document.body;
  var project = body.dataset.commentsProject;
  if (!project) return;
  var apiKey = body.dataset.commentsKey || '';     // Firebase 웹 API 키 (공개해도 되는 값)
  var ownerUid = body.dataset.commentsOwner || ''; // 글쓴이 계정 번호
  var AUTH_KEY = 'comment-auth';

  // ── 이 브라우저의 계정 ──
  // 저장 모양: { uid, refresh, token, until(ms), owner }
  function readAuth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch (e) { return null; }
  }
  function keepAuth(auth) {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch (e) { /* 기억하지 못하면 이번에만 쓴다 */ }
    return auth;
  }
  function forgetAuth() {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) { /* 없다 */ }
  }
  function post(url, data, form) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? data : JSON.stringify(data)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          var err = new Error((j.error && j.error.message) || String(r.status));
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }
  function fromLogin(j, owner) {
    return keepAuth({ uid: j.localId, refresh: j.refreshToken, token: j.idToken, until: Date.now() + (Number(j.expiresIn) - 60) * 1000, owner: owner });
  }
  // 쓸 수 있는 로그인 표를 돌려준다. 없으면 만들고(익명), 오래됐으면 새로 받는다
  function signedIn(create) {
    var auth = readAuth();
    if (auth && auth.token && Date.now() < auth.until) return Promise.resolve(auth);
    var fresh = auth && auth.refresh
      ? post('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(apiKey),
        'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refresh), true).then(function (j) {
        return keepAuth({ uid: j.user_id, refresh: j.refresh_token, token: j.id_token, until: Date.now() + (Number(j.expires_in) - 60) * 1000, owner: auth.owner });
      }, function (err) {
        if (err.status !== 400) throw err;
        forgetAuth();  // 계정이 없어졌거나 로그인이 끝났다
        return null;
      })
      : Promise.resolve(null);
    return fresh.then(function (got) {
      if (got || !create) return got;
      return post('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + encodeURIComponent(apiKey), { returnSecureToken: true })
        .then(function (j) { return fromLogin(j, false); });
    });
  }
  // 글 쓰기 쪽의 '댓글 관리 로그인'이 쓰는 것
  window.siteComments = {
    ready: !!apiKey,
    who: function () { return readAuth(); },
    isOwner: function () { var a = readAuth(); return !!(a && ownerUid && a.uid === ownerUid); },
    signIn: function (email, password) {
      return post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(apiKey),
        { email: email, password: password, returnSecureToken: true }).then(function (j) { return fromLogin(j, true); });
    },
    signOut: forgetAuth
  };

  var box = document.getElementById('comments');
  if (!box) return;

  var NAME_MAX = 30;
  var TEXT_MAX = 2000;
  var PASS_MIN = 4;
  var WAIT_MS = 5000;  // 한 사람이 연달아 올릴 때 두는 간격
  var list = document.getElementById('comment-list');
  var count = document.getElementById('comment-count');
  var empty = document.getElementById('comment-empty');
  var form = document.getElementById('comment-form');
  var nameBox = document.getElementById('comment-name');
  var textBox = document.getElementById('comment-text');
  var trap = document.getElementById('comment-url');
  var hint = document.getElementById('comment-hint');
  var send = form.querySelector('button[type="submit"]');
  var passBox = document.getElementById('comment-pass');

  // ── 댓글 비밀번호 ──
  // 글자를 SHA-256 으로 바꿔 16진 글자로 돌려준다 (https 가 아니면 쓸 수 없어 비밀번호 칸을 감춘다)
  var canHash = !!(apiKey && window.crypto && window.crypto.subtle && window.TextEncoder);
  function sha(s) {
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    });
  }
  // 보내는 값: 댓글마다 다르게 바꾼 비밀번호. 저장되는 값은 이것을 한 번 더 바꾼 것
  function passKey(id, pass) { return sha('comment:' + id + ':' + pass); }
  function newId() {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var nums = window.crypto.getRandomValues(new Uint8Array(20));
    var id = '';
    for (var i = 0; i < nums.length; i++) id += letters[nums[i] % letters.length];
    return id;
  }
  // 비밀번호를 맞혀 본 댓글 (이 브라우저의 계정으로). 다음부터는 묻지 않는다
  var CLAIM_KEY = 'comment-claims';
  function readClaims() {
    try { return JSON.parse(localStorage.getItem(CLAIM_KEY)) || {}; } catch (e) { return {}; }
  }
  function hasClaim(id) {
    var me = readAuth();
    return !!(me && readClaims()[id] === me.uid);
  }
  function keepClaim(id, uid) {
    var all = readClaims();
    all[id] = uid;
    try { localStorage.setItem(CLAIM_KEY, JSON.stringify(all)); } catch (e) { /* 기억하지 못하면 다음에 다시 묻는다 */ }
  }
  if (canHash && passBox) {
    document.getElementById('comment-pass-box').hidden = false;
    document.getElementById('comment-note').textContent += ' 비밀번호를 적어 두면 다른 기기에서도 그 비밀번호로 고치거나 지울 수 있습니다.';
  }

  // 글 파일 경로를 Firestore 문서 이름으로 쓸 수 있는 글자로 바꾼다 ('/' 를 쓸 수 없어서)
  function pageId(path) {
    var bytes = new TextEncoder().encode(path);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  var root = 'projects/' + project + '/databases/(default)/documents';
  var here = root + '/pages/' + pageId(box.dataset.page) + '/comments';
  var base = 'https://firestore.googleapis.com/v1/' + here;

  // Firestore 에 요청한다. auth 가 있으면 그 계정으로
  function store(method, url, data, auth) {
    var headers = {};
    if (data) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = 'Bearer ' + auth.token;
    return fetch(url, { method: method, headers: headers, body: data ? JSON.stringify(data) : undefined }).then(function (r) {
      if (!r.ok) {
        var err = new Error(String(r.status));
        err.status = r.status;
        throw err;
      }
      return r.status === 204 ? {} : r.json();
    });
  }
  function field(doc, name) {
    var f = doc.fields && doc.fields[name];
    return f ? (f.stringValue !== undefined ? f.stringValue : f.booleanValue) : undefined;
  }
  function setCount(n) {
    count.textContent = String(n);
    if (n === 0) {
      empty.textContent = '아직 댓글이 없습니다. 첫 댓글을 남겨 보세요.';
      empty.hidden = false;
    } else {
      empty.hidden = true;
    }
  }
  function button(label, run) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', run);
    return b;
  }

  // 댓글 하나를 그린다. 내가 쓴 것이면 고치기·지우기, 글쓴이로 로그인했으면 지우기를 단다
  function show(doc) {
    var li = document.createElement('li');
    var docUrl = 'https://firestore.googleapis.com/v1/' + doc.name;
    var uid = field(doc, 'uid');

    var head = document.createElement('p');
    head.className = 'comment-head';
    var who = document.createElement('span');
    who.className = 'who';
    who.textContent = field(doc, 'name') || '익명';
    if (uid && ownerUid && uid === ownerUid) {
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '글쓴이';
      who.appendChild(badge);
    }
    var when = document.createElement('time');
    when.dateTime = doc.createTime;
    when.textContent = new Date(doc.createTime).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      + (field(doc, 'edited') ? ' (고침)' : '');
    head.appendChild(who);
    head.appendChild(when);

    var text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = field(doc, 'text') || '';  // 글자로만 넣는다 (태그는 그대로 글자로 보인다)
    li.appendChild(head);
    li.appendChild(text);

    var id = doc.name.slice(doc.name.lastIndexOf('/') + 1);
    var me = readAuth();
    var mine = !!(me && uid && me.uid === uid) || hasClaim(id);
    var asOwner = !!(me && ownerUid && me.uid === ownerUid);
    var byPass = canHash && field(doc, 'pw') === true && !mine && !asOwner;  // 비밀번호를 넣으면 고치고 지울 수 있는 댓글
    if (apiKey && (mine || asOwner || byPass)) {
      var tools = document.createElement('p');
      tools.className = 'comment-tools';
      var note = document.createElement('span');
      note.className = 'hint';
      note.setAttribute('role', 'status');
      function rest() {
        tools.textContent = '';
        if (mine || byPass) tools.appendChild(button('고치기', function () { if (mine) startEdit(); else askPass('고치기', startEdit); }));
        tools.appendChild(button('지우기', function () { if (mine || asOwner) askRemove(); else askPass('지우기', remove); }));
        tools.appendChild(note);
      }
      function failed(err) {
        rest();
        note.textContent = err && err.status === 403 ? '이 댓글은 이 브라우저에서 바꿀 수 없습니다' : '하지 못했습니다. 잠시 뒤 다시 해 주세요';
      }
      function remove() {
        note.textContent = '지우는 중입니다…';
        signedIn(false).then(function (auth) { return store('DELETE', docUrl, null, auth); }).then(function () {
          li.remove();
          setCount(list.children.length);
        }, failed);
      }
      function askRemove() {
        tools.textContent = '';
        note.textContent = '이 댓글을 지울까요?';
        tools.appendChild(note);
        tools.appendChild(button('지우기', remove));
        tools.appendChild(button('취소', function () { note.textContent = ''; rest(); }));
      }
      // 다른 브라우저에서 쓴 댓글: 비밀번호를 받아 맞으면 이 브라우저를 쓴 사람으로 확인해 두고 이어서 한다
      function askPass(label, then) {
        tools.textContent = '';
        note.textContent = '';
        var pass = document.createElement('input');
        pass.type = 'password';
        pass.maxLength = 50;
        pass.autocomplete = 'off';
        pass.placeholder = '댓글 비밀번호';
        pass.setAttribute('aria-label', '댓글 비밀번호');
        var busy = false;
        function go() {
          if (busy) return;
          if (!pass.value) { note.textContent = '비밀번호를 적어 주세요'; pass.focus(); return; }
          busy = true;
          note.textContent = '확인하는 중입니다…';
          signedIn(true).then(function (auth) {
            return passKey(id, pass.value).then(function (k) {
              return store('POST', docUrl + '/claims?documentId=' + encodeURIComponent(auth.uid), { fields: { k: { stringValue: k } } }, auth);
            }).catch(function (err) {
              if (err.status !== 409) throw err;  // 이 브라우저는 전에 이미 확인받았다
            }).then(function () { keepClaim(id, auth.uid); });
          }).then(function () {
            mine = true;
            byPass = false;
            note.textContent = '';
            then();
          }, function (err) {
            busy = false;
            note.textContent = err && err.status === 403 ? '비밀번호가 맞지 않습니다' : '확인하지 못했습니다. 잠시 뒤 다시 해 주세요';
            pass.select();
          });
        }
        pass.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); go(); }
        });
        tools.appendChild(pass);
        tools.appendChild(button(label, go));
        tools.appendChild(button('취소', function () { note.textContent = ''; rest(); }));
        tools.appendChild(note);
        pass.focus();
      }
      function startEdit() {
        var area = document.createElement('textarea');
        area.rows = 4;
        area.maxLength = TEXT_MAX;
        area.value = text.textContent;
        area.setAttribute('aria-label', '댓글 고치기');
        text.hidden = true;
        li.insertBefore(area, tools);
        tools.textContent = '';
        tools.appendChild(button('저장', function () {
          var changed = area.value.trim();
          if (!changed) { note.textContent = '내용을 적어 주세요'; return; }
          note.textContent = '저장하는 중입니다…';
          signedIn(false).then(function (auth) {
            return store('PATCH', docUrl + '?updateMask.fieldPaths=text&updateMask.fieldPaths=edited',
              { fields: { text: { stringValue: changed }, edited: { booleanValue: true } } }, auth);
          }).then(function () {
            text.textContent = changed;
            if (when.textContent.indexOf('(고침)') === -1) when.textContent += ' (고침)';
            stop();
            note.textContent = '고쳤습니다';
          }, function (err) { stop(); failed(err); });
        }));
        tools.appendChild(button('취소', function () { note.textContent = ''; stop(); }));
        tools.appendChild(note);
        area.focus();
        function stop() {
          area.remove();
          text.hidden = false;
          rest();
        }
      }
      rest();
      li.appendChild(tools);
    }
    list.appendChild(li);
  }

  // 댓글을 모두 불러와 쓴 순서대로 보여 준다
  function load(token, got) {
    return store('GET', base + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '')).then(function (j) {
      got = got.concat(j.documents || []);
      return j.nextPageToken && got.length < 3000 ? load(j.nextPageToken, got) : got;
    });
  }
  empty.textContent = '댓글을 불러오는 중입니다…';
  empty.hidden = false;
  load('', []).then(function (docs) {
    docs.sort(function (a, b) { return a.createTime < b.createTime ? -1 : a.createTime > b.createTime ? 1 : 0; });
    docs.forEach(show);
    setCount(docs.length);
  }, function () {
    empty.textContent = '댓글을 불러오지 못했습니다. 잠시 뒤 새로 고쳐 보세요.';
  });

  try { nameBox.value = localStorage.getItem('comment-name') || ''; } catch (e) { /* 기억해 둔 이름이 없다 */ }
  if (!nameBox.value && window.siteComments.isOwner()) nameBox.value = (body.dataset.author || '').slice(0, NAME_MAX);

  var last = 0;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameBox.value.trim().slice(0, NAME_MAX);
    var text = textBox.value.trim();
    if (!text) {
      hint.textContent = '댓글 내용을 적어 주세요';
      textBox.focus();
      return;
    }
    if (text.length > TEXT_MAX) {
      hint.textContent = '댓글은 ' + TEXT_MAX + '자까지 쓸 수 있습니다 (지금 ' + text.length + '자)';
      return;
    }
    var pass = canHash && passBox ? passBox.value : '';
    if (pass && pass.length < PASS_MIN) {
      hint.textContent = '비밀번호는 ' + PASS_MIN + '자 이상으로 적어 주세요';
      passBox.focus();
      return;
    }
    if (Date.now() - last < WAIT_MS) {
      hint.textContent = '조금 뒤에 다시 올려 주세요';
      return;
    }
    if (trap.value) {
      // 사람 눈에 안 보이는 칸을 채웠으면 자동 프로그램이다. 올린 척만 한다
      textBox.value = '';
      hint.textContent = '댓글을 남겼습니다';
      return;
    }
    send.disabled = true;
    hint.textContent = '올리는 중입니다…';
    // API 키가 있으면 이 브라우저의 계정으로(없으면 익명 계정을 만들어) 쓴다. 그래야 나중에 고치거나 지울 수 있다.
    // 계정을 못 만들거나 계정으로 쓴 것이 거절되면 계정 없이 쓴다 (그 댓글은 글쓴이만 지울 수 있다)
    // 비밀번호가 있으면 댓글과 비밀 값을 한 묶음으로 저장한다 (둘 다 되거나 둘 다 안 되거나)
    var plain = { name: { stringValue: name }, text: { stringValue: text } };
    var signed = false;
    var locked = false;
    (apiKey ? signedIn(true).catch(function () { return null; }) : Promise.resolve(null)).then(function (auth) {
      if (!auth) return store('POST', base, { fields: plain });
      var fields = { name: plain.name, text: plain.text, uid: { stringValue: auth.uid } };
      function withAccount() {
        return store('POST', base, { fields: fields }, auth).then(function (doc) {
          signed = true;
          return doc;
        });
      }
      function withPass() {
        var id = newId();
        var docName = here + '/' + id;
        var both = { name: fields.name, text: fields.text, uid: fields.uid, pw: { booleanValue: true } };
        return passKey(id, pass).then(sha).then(function (hash) {
          return store('POST', 'https://firestore.googleapis.com/v1/' + root + ':commit', { writes: [
            { update: { name: docName, fields: both }, currentDocument: { exists: false } },
            { update: { name: docName + '/secret/key', fields: { hash: { stringValue: hash } } }, currentDocument: { exists: false } }
          ] }, auth);
        }).then(function (j) {
          signed = true;
          locked = true;
          return { name: docName, fields: both, createTime: j.commitTime };
        });
      }
      function unless403(next) {
        return function (err) {
          if (err.status !== 403) throw err;
          return next();
        };
      }
      return (pass ? withPass().catch(unless403(withAccount)) : withAccount())
        .catch(unless403(function () { return store('POST', base, { fields: plain }); }));
    }).then(function (doc) {
      last = Date.now();
      show(doc);
      setCount(list.children.length);
      textBox.value = '';
      if (passBox) passBox.value = '';
      hint.textContent = '댓글을 남겼습니다' + (locked ? '. 다른 기기에서는 비밀번호로 고치거나 지울 수 있습니다'
        : (pass ? '. 비밀번호는 저장하지 못했습니다' : '') + (signed ? '. 이 브라우저에서는 고치거나 지울 수 있습니다' : ''));
      try { localStorage.setItem('comment-name', name); } catch (e) { /* 기억하지 못해도 된다 */ }
    }, function () {
      hint.textContent = '댓글을 올리지 못했습니다. 잠시 뒤 다시 해 주세요';
    }).then(function () {
      send.disabled = false;
    });
  });
})();
