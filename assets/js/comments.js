// 글 아래의 댓글.
// 댓글은 사이트 파일이 아니라 Firebase(Firestore)에 넣고 글을 열 때마다 불러온다. 그래서 쓰는 즉시 보인다.
// 누구나 이름과 내용만 적으면 쓸 수 있다 (로그인·승인 없음). 지우는 것은 Firebase 화면에서 한다.
//   저장 자리: pages/<글 파일 경로를 글자로 바꾼 것>/comments/<자동 id> = { name, text }, 쓴 시각은 Firestore 가 매긴다
(function () {
  var box = document.getElementById('comments');
  if (!box || !box.dataset.project) return;

  var NAME_MAX = 30;
  var TEXT_MAX = 2000;
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

  // 글 파일 경로를 Firestore 문서 이름으로 쓸 수 있는 글자로 바꾼다 ('/' 를 쓸 수 없어서)
  function pageId(path) {
    var bytes = new TextEncoder().encode(path);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  var base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(box.dataset.project)
    + '/databases/(default)/documents/pages/' + pageId(box.dataset.page) + '/comments';

  var total = 0;
  function show(doc) {
    var fields = doc.fields || {};
    var li = document.createElement('li');
    var head = document.createElement('p');
    head.className = 'comment-head';
    var who = document.createElement('span');
    who.className = 'who';
    who.textContent = (fields.name && fields.name.stringValue) || '익명';
    var when = document.createElement('time');
    var at = new Date(doc.createTime);
    when.dateTime = doc.createTime;
    when.textContent = at.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    head.appendChild(who);
    head.appendChild(when);
    var body = document.createElement('p');
    body.className = 'comment-text';
    body.textContent = (fields.text && fields.text.stringValue) || '';  // 글자로만 넣는다 (태그는 그대로 글자로 보인다)
    li.appendChild(head);
    li.appendChild(body);
    list.appendChild(li);
    total += 1;
    count.textContent = String(total);
    empty.hidden = true;
  }

  // 댓글을 모두 불러와 쓴 순서대로 보여 준다
  function load(token, got) {
    return fetch(base + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''))
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (j) {
        got = got.concat(j.documents || []);
        return j.nextPageToken && got.length < 3000 ? load(j.nextPageToken, got) : got;
      });
  }
  empty.textContent = '댓글을 불러오는 중입니다…';
  empty.hidden = false;
  load('', []).then(function (docs) {
    docs.sort(function (a, b) { return a.createTime < b.createTime ? -1 : a.createTime > b.createTime ? 1 : 0; });
    empty.textContent = '아직 댓글이 없습니다. 첫 댓글을 남겨 보세요.';
    empty.hidden = docs.length > 0;
    count.textContent = String(docs.length);
    docs.forEach(show);
    total = docs.length;
  }, function () {
    empty.textContent = '댓글을 불러오지 못했습니다. 잠시 뒤 새로 고쳐 보세요.';
  });

  try { nameBox.value = localStorage.getItem('comment-name') || ''; } catch (e) { /* 기억해 둔 이름이 없다 */ }

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
    fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { name: { stringValue: name }, text: { stringValue: text } } })
    }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then(function (doc) {
      last = Date.now();
      show(doc);
      textBox.value = '';
      hint.textContent = '댓글을 남겼습니다';
      try { localStorage.setItem('comment-name', name); } catch (e) { /* 기억하지 못해도 된다 */ }
    }, function () {
      hint.textContent = '댓글을 올리지 못했습니다. 잠시 뒤 다시 해 주세요';
    }).then(function () {
      send.disabled = false;
    });
  });
})();
