// 왼쪽 항목 나무와 오른쪽 요약 목록을 잇는다.
//  - 어느 쪽에서든: 지금 쪽이 속한 항목을 나무에서 표시하고 거기까지 펼친다.
//  - Section 쪽에서: 주소의 #소주제id 에 속한 글만 요약 목록에 남긴다.
//  - 주인 전용 링크: 주소 끝에 ?write=on 을 붙여 한 번 들어온 브라우저에서만
//    글 쓰기·고치기·지우기, 항목 만들기·이름 바꾸기·지우기가 보인다 (?write=off 로 끈다).
//    보이기만 가리는 것이고, 저장 권한은 GitHub 가 따로 확인한다.
//  - GitHub 연결: 글 쓰기 쪽에서 이 저장소의 토큰을 넣어 두면(그 브라우저에만 저장) 주인으로 보고,
//    GitHub 화면으로 넘기던 일(만들기·바꾸기·옮기기·지우기·게시)을 GitHub API 로 바로 한다.
//    쓰기를 켠 브라우저에서는 요약 목록의 글을 왼쪽 나무의 항목으로 끌어다 놓아 옮길 수도 있고,
//    나무의 항목을 위아래로 끌어 순서를 바꿀 수도 있다.
//  - 글 쪽에서: 글 끝의 '링크 복사'·'공유' 단추, 본문을 복사해 갈 때 끝에 출처 붙이기.
(function () {
  var body = document.body;
  var nav = document.getElementById('side-nav');
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[data-key]'));

  // 나무에서 (key, sid) 항목을 표시하고 그 항목까지 펼친다. 찾은 링크를 돌려준다.
  function mark(key, sid) {
    var found = null;
    links.forEach(function (a) {
      if (a.dataset.key === key && a.dataset.sid === sid) {
        a.setAttribute('aria-current', 'true');
        found = a;
      } else {
        a.removeAttribute('aria-current');
      }
    });
    for (var el = found; el && el !== nav; el = el.parentElement) {
      if (el.tagName === 'DETAILS') el.open = true;
    }
    return found;
  }

  // 좁은 화면의 '항목' 단추
  var toggle = document.querySelector('.nav-toggle');
  function setNav(open) {
    nav.classList.toggle('open', open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
  }
  setNav(body.classList.contains('home'));
  if (toggle) {
    toggle.addEventListener('click', function () {
      setNav(!nav.classList.contains('open'));
    });
  }

  // ── 주인 전용 링크 ──
  var forced = body.dataset.owner === 'on';  // 미리보기용: 링크가 어떻게 보이는지 보여 줄 때만 쓴다
  var realOwner = false;
  try {
    var m = /[?&]write=(on|off)(&|$)/.exec(location.search);
    if (m) {
      if (m[1] === 'on') localStorage.setItem('write', 'on');
      else localStorage.removeItem('write');
      history.replaceState(null, '', location.pathname + location.hash);
    }
    realOwner = localStorage.getItem('write') === 'on';
  } catch (e) { /* 저장소를 못 쓰는 브라우저에서는 링크를 보이지 않는다 */ }
  var repo = body.dataset.repo;
  var branch = body.dataset.branch;

  // ── GitHub 연결 (토큰) ──
  // token: 이 저장소에 쓸 수 있는 토큰. who: 커밋에 적을 이름과 메일(필명과 GitHub 의 비공개용 주소)
  var TOKEN_KEY = 'gh-token';
  var WHO_KEY = 'gh-who';
  var token = null;
  var who = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    who = JSON.parse(localStorage.getItem(WHO_KEY));
  } catch (e) { /* 저장소를 못 쓰는 브라우저에서는 연결 없이 */ }
  var owner = forced || realOwner || !!token;
  var canWrite = owner && repo && branch;
  var direct = !!(token && repo && branch);  // 연결돼 있으면 GitHub 화면을 거치지 않고 바로 저장한다
  var repoPath = repo ? repo.replace(/^https:\/\/github\.com\//, '') : '';

  function gh(method, path, data, withToken) {
    return fetch('https://api.github.com' + path, {
      method: method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + (withToken || token),
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: data ? JSON.stringify(data) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { /* 본문이 없거나 JSON 이 아니다 */ }
        if (!r.ok) {
          var err = new Error((j && j.message) || String(r.status));
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }
  // 실패한 까닭을 사람이 읽을 말로
  function why(err) {
    if (err && err.status === 401) return '토큰이 만료됐거나 폐기됐습니다. 글 쓰기 쪽에서 다시 연결해 주세요';
    if (err && (err.status === 403 || err.status === 404)) return '토큰에 이 저장소의 쓰기 권한이 없습니다. 토큰을 만들 때 이 저장소를 고르고 Contents 를 Read and write 로 했는지 확인해 주세요';
    if (err && err.status === 422) return '같은 이름의 파일이 이미 있습니다. 이름을 바꿔 다시 해 주세요';
    if (err && err.status === 409) return '방금 다른 저장과 겹쳤습니다. 잠시 뒤 다시 해 주세요';
    return 'GitHub 에 닿지 못했습니다. 인터넷 연결을 확인하고 다시 해 주세요';
  }
  function bytesToBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function textToBase64(text) {
    return bytesToBase64(new TextEncoder().encode(text));
  }
  function contentsPath(path) {
    return '/repos/' + repoPath + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  }
  function signed(data) {
    if (who && who.email) data.committer = data.author = { name: who.name, email: who.email };
    return data;
  }
  // 저장은 한 번에 하나씩 (동시에 하면 GitHub 가 충돌로 거절한다)
  var chain = Promise.resolve();
  function inTurn(job) {
    var next = chain.then(job, job);
    chain = next.catch(function () {});
    return next;
  }
  // 파일을 새로 만든다. replace 가 참이면 이미 있는 파일을 통째로 바꾼다
  function putFile(path, base64, message, replace) {
    return inTurn(function () {
      var sha = replace
        ? gh('GET', contentsPath(path) + '?ref=' + encodeURIComponent(branch)).then(function (j) { return j.sha; })
        : Promise.resolve(null);
      return sha.then(function (found) {
        var data = signed({ message: message, content: base64, branch: branch });
        if (found) data.sha = found;
        return gh('PUT', contentsPath(path), data).then(awaitDeploy);
      });
    });
  }
  function removeFile(path, message) {
    return inTurn(function () {
      return gh('GET', contentsPath(path) + '?ref=' + encodeURIComponent(branch)).then(function (j) {
        return gh('DELETE', contentsPath(path), signed({ message: message, sha: j.sha, branch: branch })).then(awaitDeploy);
      });
    });
  }

  // ── 반영 기다리기 ──
  // 저장하면 GitHub 가 사이트를 다시 만든다(보통 1분쯤). 그동안 '반영하는 중'이라고 알리고,
  // 새로 만들어진 사이트가 올라오면(/version.json 의 만든 시각이 저장 시각보다 늦어지면) 화면을 새로 고친다.
  var DEPLOY_KEY = 'deploy-wait';
  var FRESH_KEY = 'fresh-until';
  var STALE_MS = 10 * 60 * 1000;  // GitHub Pages 는 브라우저가 화면을 10분 동안 기억하게 한다
  var deployBar = null;
  var deployTimer = null;
  function readWait() {
    try { return JSON.parse(localStorage.getItem(DEPLOY_KEY)); } catch (e) { return null; }
  }
  // 저장 응답에서 커밋 시각(GitHub 의 시계)을 적어 두고 지켜보기 시작한다
  function awaitDeploy(result) {
    var when = result && result.commit && result.commit.committer ? Date.parse(result.commit.committer.date) : NaN;
    try {
      localStorage.setItem(DEPLOY_KEY, JSON.stringify({ commit: Math.floor((isNaN(when) ? Date.now() : when) / 1000), saved: Date.now() }));
    } catch (e) { /* 적어 두지 못하면 알림 없이 */ }
    watchDeploy();
    return result;
  }
  function showDeploy(text, action) {
    if (!deployBar) {
      deployBar = document.createElement('div');
      deployBar.className = 'deploy-status';
      deployBar.setAttribute('role', 'status');
      document.body.appendChild(deployBar);
    }
    deployBar.textContent = text;
    if (action) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.addEventListener('click', action.run);
      deployBar.appendChild(button);
    }
    deployBar.hidden = false;
  }
  // 쓰던 것이 날아가지 않을 때만 알아서 새로 고친다
  function busy() {
    return !!document.querySelector('#writer:not([hidden]), #about-editor:not([hidden]), .item-form:not([hidden]), .move-bar:not([hidden]) .go');
  }
  function watchDeploy() {
    clearTimeout(deployTimer);
    var wait = readWait();
    if (!wait || !body.dataset.version) return;
    if (Date.now() - wait.saved > STALE_MS) {
      // 너무 오래 걸리면 그만 기다린다 (GitHub 쪽 빌드가 실패했을 수 있다)
      try { localStorage.removeItem(DEPLOY_KEY); } catch (e) { /* 없다 */ }
      showDeploy('반영이 늦어지고 있습니다. 조금 뒤 새로 고쳐 보세요.', { label: '닫기', run: function () { deployBar.hidden = true; } });
      return;
    }
    showDeploy('저장한 내용을 사이트에 반영하는 중입니다. 보통 1분쯤 걸립니다.');
    fetch(body.dataset.version + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        var now = readWait();
        if (!now) return;
        if (!v || !(v.built >= now.commit)) {
          deployTimer = setTimeout(watchDeploy, 5000);
          return;
        }
        try {
          localStorage.removeItem(DEPLOY_KEY);
          localStorage.setItem(FRESH_KEY, String(Date.now() + STALE_MS));
        } catch (e) { /* 적지 못해도 계속한다 */ }
        if (busy()) {
          showDeploy('저장한 내용이 사이트에 반영됐습니다.', { label: '새로 고침', run: function () { location.reload(); } });
        } else {
          try { sessionStorage.setItem('deployed', '1'); } catch (e) { /* 없어도 된다 */ }
          location.reload();
        }
      }, function () {
        deployTimer = setTimeout(watchDeploy, 5000);
      });
  }
  // 토큰을 확인하고 이 브라우저에 넣어 둔다. 이 저장소 주인의 토큰이어야 한다
  function connect(newToken) {
    return gh('GET', '/user', null, newToken).then(function (u) {
      if (u.login.toLowerCase() !== repoPath.split('/')[0].toLowerCase()) {
        var err = new Error('other-owner');
        err.other = u.login;
        throw err;
      }
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(WHO_KEY, JSON.stringify({
        login: u.login, name: body.dataset.author || u.login, email: u.id + '+' + u.login + '@users.noreply.github.com'
      }));
      return u.login;
    }, function (err) {
      // 계정 정보를 읽을 수 없는 토큰이면 저장소만 읽히는지 보고 받아들인다 (커밋에는 GitHub 의 기본 이름이 적힌다)
      if (err.status !== 403 && err.status !== 404) throw err;
      return gh('GET', '/repos/' + repoPath, null, newToken).then(function () {
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.removeItem(WHO_KEY);
        return '';
      });
    });
  }
  function disconnect() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(WHO_KEY);
    } catch (e) { /* 지울 것이 없다 */ }
  }
  // 저장소의 파일 경로로 커밋에 적을 말을 만든다
  function messageFor(path, removing) {
    var name = path.replace(/\.(md|yml|json)$/, '').split('/').slice(1).join('/');
    if (path.indexOf('_items/') === 0) return (removing ? '항목 지움: ' : '항목 만듦: ') + name;
    if (path.indexOf('sections/') === 0) return (removing ? 'Section 지움: ' : 'Section 만듦: ') + name;
    if (path.indexOf('_data/names/') === 0) return '항목 이름·설명 바꿈';
    if (path.indexOf('_data/order/') === 0) return '항목 순서 바꿈';
    if (path.indexOf('_data/moves/') === 0) return '글 옮김';
    if (path.indexOf('_data/itemmoves/') === 0) return '항목 옮김';
    if (path.indexOf('_data/site/') === 0) return '소개 문장 바꿈';
    if (path.indexOf('_data/about/') === 0) return '소개 글 고침';
    if (path.indexOf('_writing/') === 0) return (removing ? '글 지움: ' : '글 올림: ') + name;
    return (removing ? '지움: ' : '올림: ') + path;
  }
  // GitHub 화면으로 가는 주소가 하려는 일: 새 파일 만들기 또는 파일 지우기. 그 밖의 주소는 null
  function actionOf(href) {
    if (!repo || href.indexOf(repo + '/') !== 0) return null;
    var rest = href.slice(repo.length);
    var making = '/new/' + enc(branch) + '?';
    var removing = '/delete/' + enc(branch) + '/';
    if (rest.indexOf(making) === 0) {
      var q = new URLSearchParams(rest.slice(making.length));
      return q.get('filename') ? { put: q.get('filename'), text: q.get('value') || '' } : null;
    }
    if (rest.indexOf(removing) === 0) return { remove: decodeURIComponent(rest.slice(removing.length)) };
    return null;
  }

  function enc(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }
  // 글 쓰기 쪽 주소. dir('_writing/기술/…/')을 주면 그 항목에 새 글을 연다
  function writeUrl(dir) {
    return body.dataset.write + (dir ? '#new:' + encodeURIComponent(dir) : '');
  }
  // GitHub 에서 파일 하나를 고치는 화면의 주소
  function editUrl(path) {
    return repo + '/edit/' + enc(branch) + '/' + enc(path);
  }
  // GitHub 에서 파일 하나를 지우는 화면의 주소
  function deleteUrl(path) {
    return repo + '/delete/' + enc(branch) + '/' + enc(path);
  }
  function ownerLink(label) {
    var a = document.createElement('a');
    a.textContent = direct ? label.replace('GitHub 에서 ', '') : label;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }
  function newFileUrl(name, text) {
    return repo + '/new/' + enc(branch) + '?filename=' + encodeURIComponent(name) + '&value=' + encodeURIComponent(text);
  }
  // 클릭 안에서 바로 끝나는 복사 (새 탭이 열려도 끊기지 않게)
  function copyNow(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* 아래에서 다시 시도 */ }
    document.body.removeChild(ta);
    if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
    return ok;
  }
  // 새 파일을 GitHub 의 새 파일 화면으로 넘긴다. link 의 주소를 맞추고 'filled'·'copied'·'failed' 를 돌려준다.
  // 짧으면 내용을 주소에 채우고, 길면(주소에 다 담을 수 없어) 복사한 뒤 이름만 채운 빈 화면을 연다.
  var URL_LIMIT = 2000;
  function handOff(link, name, text) {
    var full = newFileUrl(name, text);
    if (full.length <= URL_LIMIT) {
      link.href = full;
      return 'filled';
    }
    link.href = newFileUrl(name, '');
    return copyNow(text) ? 'copied' : 'failed';
  }
  // 한국 시간의 지금 시각을 '260930-231205' 꼴로 (파일 이름에 쓴다)
  function stamp() {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date()).replace(/[-:]/g, '').replace(' ', '-');
  }
  // 나무에서의 위아래 관계는 화면의 나무로 본다 (옮긴 항목은 폴더 경로와 보이는 자리가 다르므로)
  function ownLink(li) {
    return li.querySelector(':scope > details > summary > a, :scope > .row > a');
  }
  // link 바로 아래 항목들의 링크. link 가 없으면 Section 들
  function kids(link) {
    var ul = link ? link.closest('li').querySelector(':scope > details > ul') : nav.querySelector('.tree');
    return ul ? Array.prototype.map.call(ul.children, ownLink) : [];
  }
  // 바로 위 항목의 링크. Section 이면 null
  function parentOf(link) {
    var up = ancestors(link);
    return up.length ? up[up.length - 1] : null;
  }
  // 항목의 폴더 이름 (보이는 이름을 바꿨어도 그대로인 이름)
  function itemName(link) {
    return link.dataset.sid === '' ? link.dataset.key : link.dataset.dir.replace(/\/$/, '').split('/').pop();
  }
  // parent 바로 아래에 name 이라는 이름(보이는 이름이든 폴더 이름이든)이 이미 있는가. except 는 빼고 본다
  function nameTaken(parent, name, except) {
    return kids(parent).some(function (a) {
      return a !== except && (a.textContent === name || itemName(a) === name);
    });
  }

  // 이름을 적으면 GitHub 의 새 파일 화면으로 가는 작은 양식. 여닫는 단추와 양식을 돌려준다.
  //   o.problem(name)  쓸 수 없는 이름이면 그 까닭, 괜찮으면 ''
  //   o.url(name)      그 이름으로 만들 파일의 GitHub 주소
  //   o.initial()      (있으면) 양식을 열 때 칸에 채울 이름
  //   o.note           이름이 괜찮을 때 보여 줄 안내
  //   o.free           참이면 이름이 아니라 자유로운 글 (글자 제한 없음)
  //   o.empty          참이면 비워서 보낼 수 있다 (설명 지우기)
  function itemForm(id, o) {
    var opener = document.createElement('button');
    opener.type = 'button';
    opener.textContent = o.open;
    opener.setAttribute('aria-expanded', 'false');
    opener.setAttribute('aria-controls', id + '-form');

    var form = document.createElement('form');
    form.className = 'item-form';
    form.id = id + '-form';
    form.hidden = true;
    var label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = o.field;
    var input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.autocomplete = 'off';
    var go = ownerLink(o.go);
    go.className = 'go';
    var hint = document.createElement('span');
    hint.className = 'hint';
    hint.setAttribute('role', 'status');
    [label, input, go, hint].forEach(function (el) { form.appendChild(el); });

    function refresh() {
      var name = input.value.trim();
      var problem = '';
      if (!o.free && /[\/\\#?%"<>|*:]/.test(name)) problem = '이름에 / \\ # ? % " < > | * : 는 쓸 수 없습니다';
      else if (!o.free && /^[._]/.test(name)) problem = '이름은 . 이나 _ 로 시작할 수 없습니다';
      else if (name || o.empty) problem = o.problem(name);
      if ((name || o.empty) && !problem) {
        go.href = o.url(name);
        go.removeAttribute('aria-disabled');
        hint.textContent = o.note;
      } else {
        go.removeAttribute('href');
        go.setAttribute('aria-disabled', 'true');
        hint.textContent = problem;
      }
    }
    function show(open) {
      form.hidden = !open;
      opener.setAttribute('aria-expanded', String(open));
      if (open) {
        if (o.initial) input.value = o.initial();
        refresh();
        input.focus();
        input.select();
      }
    }
    input.addEventListener('input', refresh);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (go.hasAttribute('href')) go.click();
    });
    opener.addEventListener('click', function () { show(form.hidden); });
    go.setAttribute('aria-disabled', 'true');  // 열기 전에는 눌리지 않는다. 열 때와 칠 때마다 다시 본다
    return { opener: opener, form: form, refresh: refresh, close: function () { show(false); } };
  }
  var COMMIT_NOTE = direct ? '누르면 바로 저장되고 1분쯤 뒤 사이트에 반영됩니다' : 'GitHub 화면에서 Commit changes 를 누르면 1~2분 뒤 반영됩니다';

  // head 아래에 주인 전용 줄을 만들고, 그 줄과 '이 항목에 글 쓰기' 링크를 돌려준다
  var newLink = null;
  var newDir = '';
  var current = null;   // Section 쪽에서 지금 고른 항목의 나무 링크
  var forms = [];
  function ownerBar(head) {
    var bar = document.createElement('p');
    bar.className = 'owner-bar';
    newLink = document.createElement('a');
    newLink.textContent = '이 항목에 글 쓰기';
    bar.appendChild(newLink);
    head.appendChild(bar);
    return bar;
  }
  // 고른 항목이 바뀌면 글 쓰기 링크를 고치고, 열려 있던 양식은 닫는다 (다른 항목의 이름이 남지 않게)
  function setCurrent(link, dir) {
    current = link;
    newDir = dir;
    if (newLink) newLink.href = writeUrl(dir);
    forms.forEach(function (f) { f.close(); });
  }
  // Section 쪽의 두 양식: 고른 항목 아래에 새 항목 만들기, 고른 항목의 이름 바꾸기
  function addItemForms(bar, head) {
    // 새 항목(아직 글이 없는 소주제): _items/ 에 이름표 파일을 만든다
    var add = itemForm('new-item', {
      open: '이 항목 아래에 새 항목 만들기', field: '새 항목 이름', go: 'GitHub 에서 만들기', note: COMMIT_NOTE,
      problem: function (name) {
        if (nameTaken(current, name, null)) return '이미 있는 항목입니다';
        // 이 폴더에서 다른 곳으로 옮겨 간 항목이 그 이름을 쓰고 있으면 폴더가 겹친다
        var dir = newDir + name + '/';
        return links.some(function (a) { return a.dataset.dir === dir; }) ? '다른 곳으로 옮긴 항목이 쓰던 이름이라 쓸 수 없습니다' : '';
      },
      url: function (name) {
        return newFileUrl('_items/' + newDir.replace(/^_writing\//, '') + name + '.md', '---\n---\n');
      }
    });
    // 이름 바꾸기: 보이는 이름만 바꾼다. _data/names/ 에 기록 파일을 하나 더 만든다 (폴더와 주소는 그대로)
    var rename = itemForm('rename-item', {
      open: '이 항목 이름 바꾸기', field: '바꿀 이름', go: 'GitHub 에서 바꾸기',
      note: '보이는 이름만 바뀌고 글 주소는 그대로입니다. ' + COMMIT_NOTE,
      initial: function () { return current ? current.textContent : ''; },
      problem: function (name) {
        if (!current) return '';
        if (name === current.textContent) return '지금 이름과 같습니다';
        return nameTaken(parentOf(current), name, current) ? '이미 있는 항목입니다' : '';
      },
      url: function (name) {
        var path = current.dataset.dir.replace(/^_writing\//, '');
        return newFileUrl('_data/names/' + stamp() + '.yml', 'path: "' + path + '"\nname: "' + name + '"\n');
      }
    });
    forms.push(add, rename);
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '이 항목 지우기';
    remove.addEventListener('click', function () { if (current) askDelete(current); });
    // 설명 고치기: 항목을 골랐을 때 제목 아래에 나오는 한두 문장. 비워서 보내면 설명이 없어진다
    var describe = itemForm('item-desc', {
      open: '이 항목 설명 고치기', field: '설명', go: 'GitHub 에서 바꾸기', note: COMMIT_NOTE, free: true, empty: true,
      initial: function () { return current ? current.dataset.desc : ''; },
      problem: function (text) { return current && text === current.dataset.desc ? '지금 설명과 같습니다' : ''; },
      url: function (text) {
        var path = current.dataset.dir.replace(/^_writing\//, '');
        return newFileUrl('_data/names/' + stamp() + '.yml', 'path: ' + yamlText(path) + '\ndescription: ' + yamlText(text) + '\n');
      }
    });
    forms.push(describe);
    bar.appendChild(add.opener);
    bar.appendChild(rename.opener);
    bar.appendChild(describe.opener);
    bar.appendChild(remove);
    head.appendChild(describe.form);
    head.appendChild(add.form);
    head.appendChild(rename.form);
  }
  // 새 Section 만들기: sections/ 에 이름·설명·순서를 적은 파일을 만든다
  if (canWrite) {
    var sideLinksForForm = nav.querySelector('.side-links');
    var secForm = itemForm('new-section', {
      open: '새 Section 만들기', field: '새 Section 이름', go: 'GitHub 에서 만들기', note: COMMIT_NOTE,
      problem: function (name) { return nameTaken(null, name, null) ? '이미 있는 항목입니다' : ''; },
      url: function (name) {
        var last = 0;
        links.forEach(function (a) { last = Math.max(last, parseInt(a.dataset.order, 10) || 0); });
        return newFileUrl('sections/' + name + '.md', '---\ntitle: "' + name + '"\ndescription: \norder: ' + (last + 1) + '\n---\n');
      }
    });
    if (sideLinksForForm) {
      var secItem = document.createElement('li');
      secItem.appendChild(secForm.opener);
      sideLinksForForm.appendChild(secItem);
      nav.insertBefore(secForm.form, nav.querySelector('.side-copy'));
    }
  }
  // ── 글 옮기기 (주인 전용) ──
  // 파일과 글 주소는 그대로 두고 나무에서 놓인 자리만 바꾼다: _data/moves/ 에 기록 파일을 하나 만든다.
  function yamlText(text) {
    return '"' + text.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  function moveUrl(path, link) {
    var to = link.dataset.dir.replace(/^_writing\//, '');
    return newFileUrl('_data/moves/' + stamp() + '.yml', 'post: ' + yamlText(path) + '\nto: ' + yamlText(to) + '\n');
  }
  // 'Section / 소주제 / …' 꼴의 항목 이름
  function itemLabel(link) {
    return ancestors(link).concat([link]).map(function (a) { return a.textContent; }).join(' / ');
  }
  var MOVE_NOTE = '놓인 자리만 바뀌고 글 주소는 그대로입니다. ' + COMMIT_NOTE;

  // 한 번 더 확인하는 줄: 하려는 일을 적고, GitHub 로 가는 링크(있으면)와 닫는 단추를 둔다
  var noticeBar = null;
  //   makeUrl(clicked)  링크의 주소. 누르는 순간(clicked = true)에 한 번 더 부른다
  //   onCancel          (있으면) 취소했을 때 할 일
  function notice(message, goLabel, makeUrl, noteText, onCancel) {
    if (!noticeBar) {
      noticeBar = document.createElement('div');
      noticeBar.className = 'move-bar';
      noticeBar.setAttribute('role', 'status');
      var main = document.querySelector('main');
      main.insertBefore(noticeBar, main.firstChild);
    }
    noticeBar.textContent = '';
    var text = document.createElement('p');
    text.textContent = message;
    var actions = document.createElement('p');
    actions.className = 'actions';
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = goLabel ? '취소' : '닫기';
    close.addEventListener('click', function () {
      noticeBar.hidden = true;
      if (onCancel) onCancel();
    });
    if (goLabel) {
      var go = ownerLink(goLabel);
      go.className = 'go';
      go.href = makeUrl(false);
      go.addEventListener('click', function () { go.href = makeUrl(true); });
      actions.appendChild(go);
    }
    actions.appendChild(close);
    if (noteText) {
      var note = document.createElement('span');
      note.className = 'note';
      note.textContent = noteText;
      actions.appendChild(note);
    }
    noticeBar.appendChild(text);
    noticeBar.appendChild(actions);
    noticeBar.hidden = false;
    noticeBar.scrollIntoView({ block: 'nearest' });
  }

  // 끌어다 놓은 뒤에 한 번 더 확인한다 (잘못 놓았을 때 취소할 수 있게)
  function askMove(path, title, link, same) {
    if (same) {
      notice('「' + title + '」 글은 이미 ' + itemLabel(link) + ' 항목에 있습니다.');
    } else {
      notice('「' + title + '」 글을 ' + itemLabel(link) + ' 항목으로 옮깁니다.', 'GitHub 에서 옮기기',
        function () { return moveUrl(path, link); }, MOVE_NOTE);
    }
  }

  // 항목 지우기: 글도 아래 항목도 없는 빈 항목만 지운다 (글이 함께 사라지는 일이 없게).
  // Section 은 sections/이름.md 를, 소주제는 _items/ 의 이름표를 지운다.
  function askDelete(link) {
    var label = itemLabel(link);
    var count = Number(link.dataset.count) || 0;
    var hasChildren = !!link.closest('li').querySelector(':scope > details');  // 아래 항목이 있으면 <details> 로 그려진다
    var isSection = link.dataset.sid === '';
    if (count > 0) {
      notice(label + ' 항목에는 글이 ' + count + '편 들어 있어 지울 수 없습니다. 글을 먼저 다른 항목으로 옮기거나 지워 주세요.');
    } else if (hasChildren) {
      notice(label + ' 항목에는 아래 항목이 있어 지울 수 없습니다. 아래 항목부터 지워 주세요.');
    } else if (!isSection && link.dataset.tag !== '1') {
      notice(label + ' 항목은 따로 지울 것이 없습니다. 들어 있던 글이 없어지면 저절로 사라집니다.');
    } else {
      var file = isSection
        ? 'sections/' + link.dataset.key + '.md'
        : '_items/' + link.dataset.dir.replace(/^_writing\//, '').replace(/\/$/, '') + '.md';
      notice(label + ' 항목을 지웁니다.', 'GitHub 에서 지우기',
        function () { return deleteUrl(file); },
        'GitHub 화면에서 Commit changes 를 누르면 1~2분 뒤 왼쪽 나무에서 사라집니다');
    }
  }

  // 요약 목록의 글을 끌 수 있게 하고, 나무의 항목을 놓을 자리로 만든다
  function setupDrag() {
    var dragged = null;
    var opening = null;
    function clearTargets() {
      clearTimeout(opening);
      Array.prototype.forEach.call(nav.querySelectorAll('.drop-target'), function (el) { el.classList.remove('drop-target'); });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.entries > .entry'), function (li) {
      li.draggable = true;
      li.addEventListener('dragstart', function (e) {
        dragged = li;
        li.classList.add('is-dragging');
        body.classList.add('dragging-post');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', li.dataset.title);
      });
      li.addEventListener('dragend', function () {
        dragged = null;
        li.classList.remove('is-dragging');
        body.classList.remove('dragging-post');
        clearTargets();
      });
    });
    links.forEach(function (a) {
      var row = a.parentElement;  // <summary> 또는 .row
      row.addEventListener('dragenter', function (e) {
        if (!dragged) return;
        e.preventDefault();
        clearTargets();
        row.classList.add('drop-target');
        // 접힌 항목 위에 잠시 머물면 펼쳐서 그 아래 항목에 놓을 수 있게 한다
        var details = row.tagName === 'SUMMARY' ? row.parentElement : null;
        if (details && !details.open) opening = setTimeout(function () { details.open = true; }, 700);
      });
      row.addEventListener('dragover', function (e) {
        if (!dragged) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      row.addEventListener('drop', function (e) {
        if (!dragged) return;
        e.preventDefault();
        clearTargets();
        var same = dragged.dataset.key === a.dataset.key && dragged.dataset.sid === a.dataset.sid;
        askMove(dragged.dataset.path, dragged.dataset.title, a, same);
      });
    });
  }

  // ── 항목 끌기 (주인 전용): 순서 바꾸기와 다른 항목 아래로 옮기기 ──
  // 나무의 항목을 끌어 같은 단계의 항목 위쪽·아래쪽 가장자리에 놓으면 순서가 바뀌고(_data/order/ 에 기록),
  // 다른 항목의 가운데에 놓으면 그 항목 아래로 들어간다(_data/itemmoves/ 에 기록: 원래 폴더 → 새 위 항목의 원래 폴더).
  // 어느 쪽이든 폴더와 글 주소는 그대로이고 보이는 자리만 바뀐다.
  function setupItemDrag() {
    var moving = null;       // 끌고 있는 항목의 <li>
    var movingLink = null;
    var before = new Map();  // 단계(ul)마다 놓기 전의 순서 (취소하면 되돌린다)
    var hoverRow = null;
    var opening = null;
    function clearMarks() {
      Array.prototype.forEach.call(nav.querySelectorAll('.drop-before, .drop-after, .drop-target'), function (el) {
        el.classList.remove('drop-before', 'drop-after', 'drop-target');
      });
    }
    // 마우스 아래의 항목과, 거기에 놓으면 무엇이 되는지: 'before'·'after'(순서 바꾸기), 'into'(그 항목 아래로 옮기기)
    function spotAt(e) {
      var row = e.target.closest ? e.target.closest('summary, .row') : null;
      if (!row || !nav.contains(row)) return null;
      var li = row.tagName === 'SUMMARY' ? row.parentElement.parentElement : row.parentElement;
      if (li === moving || moving.contains(li)) return null;      // 자기 자신이나 자기 아래로는 못 놓는다
      var link = ownLink(li);
      var sibling = li.parentElement === moving.parentElement;
      // Section 은 다른 항목 아래로 못 가고, 이미 그 항목 바로 아래면 옮길 것이 없다
      var canInto = movingLink.dataset.sid !== '' && parentOf(movingLink) !== link;
      var box = row.getBoundingClientRect();
      var y = (e.clientY - box.top) / box.height;
      var how = null;
      if (sibling && canInto) how = y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'into';
      else if (sibling) how = y < 0.5 ? 'before' : 'after';
      else if (canInto) how = 'into';
      return how ? { li: li, link: link, row: row, how: how } : null;
    }
    links.forEach(function (a) {
      var row = a.parentElement;  // <summary> 또는 .row
      a.draggable = false;        // 링크가 아니라 줄 전체가 끌리게
      row.draggable = true;
      row.addEventListener('dragstart', function (e) {
        moving = row.closest('li');
        movingLink = a;
        moving.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', a.textContent);
      });
      row.addEventListener('dragend', function () {
        if (moving) moving.classList.remove('is-dragging');
        moving = null;
        movingLink = null;
        hoverRow = null;
        clearTimeout(opening);
        clearMarks();
      });
    });
    nav.addEventListener('dragover', function (e) {
      if (!moving) return;
      var spot = spotAt(e);
      clearMarks();
      var row = spot ? spot.row : null;
      if (row !== hoverRow) {
        // 접힌 항목 위에 잠시 머물면 펼쳐서 그 아래 항목에 놓을 수 있게 한다
        hoverRow = row;
        clearTimeout(opening);
        var details = row && row.tagName === 'SUMMARY' ? row.parentElement : null;
        if (details && !details.open) opening = setTimeout(function () { details.open = true; }, 700);
      }
      if (!spot) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (spot.how === 'into') spot.row.classList.add('drop-target');
      else spot.li.classList.add(spot.how === 'before' ? 'drop-before' : 'drop-after');
    });
    nav.addEventListener('drop', function (e) {
      if (!moving) return;
      var spot = spotAt(e);
      clearMarks();
      clearTimeout(opening);
      if (!spot) return;
      e.preventDefault();
      var link = movingLink;

      if (spot.how === 'into') {
        var target = spot.link;
        var label = itemLabel(link);
        if (nameTaken(target, itemName(link), null) || nameTaken(target, link.textContent, null)) {
          notice(itemLabel(target) + ' 아래에 같은 이름의 항목이 이미 있어 ' + label + ' 항목을 옮길 수 없습니다. 이름을 먼저 바꿔 주세요.');
          return;
        }
        var moveText = 'from: ' + yamlText(link.dataset.dir.replace(/^_writing\//, '')) + '\nto: ' + yamlText(target.dataset.dir.replace(/^_writing\//, '')) + '\n';
        notice(label + ' 항목을 ' + itemLabel(target) + ' 아래로 옮깁니다. 그 아래 항목과 글도 함께 옮겨집니다.',
          'GitHub 에서 옮기기',
          function () { return newFileUrl('_data/itemmoves/' + stamp() + '.yml', moveText); },
          MOVE_NOTE);
        return;
      }

      var list = moving.parentElement;
      if (!before.has(list)) before.set(list, Array.prototype.slice.call(list.children));
      list.insertBefore(moving, spot.how === 'after' ? spot.li.nextSibling : spot.li);

      var items = Array.prototype.slice.call(list.children).map(ownLink);
      var upper = parentOf(items[0]);
      var parent = upper ? upper.dataset.dir.replace(/^_writing\//, '') : '';
      var text = 'parent: ' + yamlText(parent) + '\nitems:\n' + items.map(function (x) { return '  - ' + yamlText(itemName(x)) + '\n'; }).join('');
      notice((upper ? itemLabel(upper) + ' 아래 항목' : 'Section') + '의 순서를 이렇게 바꿉니다: ' + items.map(function (x) { return x.textContent; }).join(', '),
        'GitHub 에서 바꾸기',
        function (clicked) {
          var name = '_data/order/' + stamp() + '.yml';
          var full = newFileUrl(name, text);
          if (direct || full.length <= URL_LIMIT) return full;
          if (clicked) copyNow(text);  // 항목이 아주 많으면 주소에 다 못 담아 복사해서 넘긴다
          return newFileUrl(name, '');
        },
        '왼쪽 나무에는 미리 반영해 보였습니다. ' + COMMIT_NOTE + '. 취소하면 원래 순서로 돌아갑니다',
        function () {
          before.get(list).forEach(function (li) { list.appendChild(li); });
          before.delete(list);
        });
    });
  }

  // 끌 수 없는 기기(휴대폰)를 위해 글 쪽에서도 옮길 수 있게: 항목을 골라 옮기는 양식
  function addMoveForm(bar, head, path) {
    var opener = document.createElement('button');
    opener.type = 'button';
    opener.textContent = '이 글 옮기기';
    opener.setAttribute('aria-expanded', 'false');
    opener.setAttribute('aria-controls', 'move-post-form');
    var form = document.createElement('form');
    form.className = 'item-form';
    form.id = 'move-post-form';
    form.hidden = true;
    var label = document.createElement('label');
    label.htmlFor = 'move-post';
    label.textContent = '옮길 항목';
    var select = document.createElement('select');
    select.id = 'move-post';
    links.forEach(function (a, i) {
      if (a.dataset.key === body.dataset.key && a.dataset.sid === body.dataset.sid) return;  // 지금 있는 항목은 뺀다
      var option = document.createElement('option');
      option.value = String(i);
      option.textContent = itemLabel(a);
      select.appendChild(option);
    });
    var go = ownerLink('GitHub 에서 옮기기');
    go.className = 'go';
    var hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = MOVE_NOTE;
    function refresh() { go.href = moveUrl(path, links[Number(select.value)]); }
    select.addEventListener('change', refresh);
    go.addEventListener('click', refresh);
    form.addEventListener('submit', function (e) { e.preventDefault(); go.click(); });
    opener.addEventListener('click', function () {
      form.hidden = !form.hidden;
      opener.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) select.focus();
    });
    if (!select.options.length) return;
    refresh();
    [label, select, go, hint].forEach(function (el) { form.appendChild(el); });
    bar.appendChild(opener);
    head.appendChild(form);
  }

  // 왼쪽 아래의 '글 쓰기' 링크. 임시저장 글(이 브라우저에만 있음)이 있으면 그 수도 적는다
  var writeLink = null;
  function showDraftCount(n) {
    if (writeLink) writeLink.textContent = n > 0 ? '글 쓰기 (임시저장 ' + n + ')' : '글 쓰기';
  }
  if (owner) {
    var sideLinksForWrite = nav.querySelector('.side-links');
    if (sideLinksForWrite && body.dataset.write) {
      var writeItem = document.createElement('li');
      writeLink = document.createElement('a');
      writeLink.href = writeUrl('');
      writeItem.appendChild(writeLink);
      sideLinksForWrite.appendChild(writeItem);
      var draftCount = 0;
      try { draftCount = (JSON.parse(localStorage.getItem('drafts')) || []).length; } catch (e) { /* 못 읽으면 0 */ }
      showDraftCount(draftCount);
    }
  }
  // 연결하지 않고 쓰기만 켠 브라우저에는 연결하는 곳을 알려 준다
  if (owner && !direct && !forced && body.dataset.write) {
    var sideLinksForConnect = nav.querySelector('.side-links');
    if (sideLinksForConnect) {
      var connectItem = document.createElement('li');
      var connectLink = document.createElement('a');
      connectLink.href = body.dataset.write + '#connect';
      connectLink.textContent = 'GitHub 연결';
      connectItem.appendChild(connectLink);
      sideLinksForConnect.appendChild(connectItem);
    }
  }
  // 글 쓰기 쪽(assets/js/write.js)이 쓰는 것들
  window.siteOwner = {
    owner: owner, canWrite: !!canWrite, direct: direct, who: who, repo: repo, branch: branch, links: links, itemLabel: itemLabel,
    newFileUrl: newFileUrl, editUrl: editUrl, handOff: handOff, copyNow: copyNow, stamp: stamp, showDraftCount: showDraftCount,
    putFile: putFile, textToBase64: textToBase64, bytesToBase64: bytesToBase64, why: why, connect: connect, disconnect: disconnect
  };

  if (canWrite) setupItemDrag();

  if (owner) {
    var justDeployed = false;
    try {
      justDeployed = sessionStorage.getItem('deployed') === '1';
      sessionStorage.removeItem('deployed');
    } catch (e) { /* 없어도 된다 */ }
    if (justDeployed) {
      showDeploy('저장한 내용이 사이트에 반영됐습니다.');
      setTimeout(function () { if (deployBar) deployBar.hidden = true; }, 4000);
    }
    watchDeploy();
  }

  // 연결돼 있으면: GitHub 화면으로 가는 링크를 눌렀을 때 그 화면으로 가지 않고 같은 일을 바로 한다
  if (direct) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      var act = a ? actionOf(a.href) : null;
      if (!act) return;
      e.preventDefault();
      if (act.remove && !a.closest('.move-bar')) {
        // 확인하는 화면 없이 바로 지워지지 않게 한 번 묻는다
        var href = a.href;
        var heading = document.querySelector('.post-head h1');
        notice('「' + (heading ? heading.textContent : act.remove) + '」 글을 지웁니다. 지우면 사이트에서 되돌릴 수 없습니다.',
          'GitHub 에서 지우기', function () { return href; }, COMMIT_NOTE);
        return;
      }
      notice('저장하는 중입니다…');
      var job = act.remove
        ? removeFile(act.remove, messageFor(act.remove, true))
        : putFile(act.put, textToBase64(act.text), messageFor(act.put, false));
      job.then(function () {
        forms.forEach(function (f) { f.close(); });
        notice('저장했습니다. 사이트에 반영되면 화면이 알아서 새로 고쳐집니다.');
      }, function (err) {
        notice('저장하지 못했습니다. ' + why(err));
      });
    });
  }

  if (realOwner && !token && !forced) {
    var off = document.createElement('li');
    var offLink = document.createElement('a');
    offLink.href = '?write=off';
    offLink.textContent = '쓰기 링크 끄기';
    off.appendChild(offLink);
    var sideLinks = nav.querySelector('.side-links');
    if (sideLinks) sideLinks.appendChild(off);
  }

  // ── 글 쪽: 링크 복사·공유 단추, 복사해 갈 때 출처 붙이기 ──
  var QUOTE_MIN = 50;  // 이보다 짧게 복사하면 출처를 붙이지 않는다 (글자 수)

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* 아래에서 실패로 처리 */ }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject();
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function setupPost() {
    var article = document.querySelector('.post-body');
    var share = document.querySelector('.share');
    if (!article || !share) return;
    var url = location.origin + location.pathname;
    var postTitle = share.dataset.title;
    var note = share.querySelector('.share-note');
    var timer = null;
    function say(text) {
      note.textContent = text;
      clearTimeout(timer);
      timer = setTimeout(function () { note.textContent = ''; }, 3000);
    }

    share.querySelector('.share-copy').addEventListener('click', function () {
      copyText(url).then(
        function () { say('링크를 복사했습니다'); },
        function () { say('복사하지 못했습니다. 주소창의 주소를 복사해 주세요'); }
      );
    });
    var open = share.querySelector('.share-open');
    if (navigator.share) {
      open.hidden = false;
      open.addEventListener('click', function () {
        navigator.share({ title: postTitle, url: url }).catch(function (e) {
          if (!e || e.name !== 'AbortError') say('공유 창을 열지 못했습니다. 링크 복사를 써 주세요');
        });
      });
    }

    // 본문을 복사해 가면 끝에 출처(글 제목·사이트 이름·주소)를 붙인다.
    // 짧은 복사, 코드만 복사, 쓰기를 켠 주인의 복사에는 붙이지 않는다.
    document.addEventListener('copy', function (e) {
      var sel = window.getSelection();
      if (realOwner || token || !e.clipboardData || !sel.rangeCount) return;
      var range = sel.getRangeAt(0);
      var text = sel.toString();
      if (!range.intersectsNode(article) || text.trim().length < QUOTE_MIN) return;
      var top = range.commonAncestorContainer;
      if ((top.nodeType === 1 ? top : top.parentElement).closest('pre')) return;

      var source = '출처: ' + postTitle + ' (' + body.dataset.site + ')';
      var holder = document.createElement('div');
      for (var i = 0; i < sel.rangeCount; i++) holder.appendChild(sel.getRangeAt(i).cloneContents());
      var p = document.createElement('p');
      var a = document.createElement('a');
      a.href = url;
      a.textContent = url;
      p.appendChild(document.createTextNode(source + ' '));
      p.appendChild(a);
      holder.appendChild(p);
      e.clipboardData.setData('text/plain', text + '\n\n' + source + '\n' + url);
      e.clipboardData.setData('text/html', holder.innerHTML);
      e.preventDefault();
    });
  }

  var list = document.getElementById('post-list');
  if (!list) {
    // 글 쪽·첫 화면·소개
    mark(body.dataset.key || '', body.dataset.sid || '');
    var path = body.dataset.path;
    var postHead = document.querySelector('.post-head');
    if (canWrite && path && postHead) {
      var bar = ownerBar(postHead);
      setCurrent(null, path.slice(0, path.lastIndexOf('/') + 1));
      // 고치기도 사이트의 글 쓰기 쪽에서 한다 (올라가 있는 글을 불러와 칸에 채운다)
      var edit = document.createElement('a');
      edit.textContent = '이 글 고치기';
      edit.href = body.dataset.write + '#edit:' + encodeURIComponent(path);
      bar.insertBefore(edit, bar.firstChild);
      addMoveForm(bar, postHead, path);
      var del = ownerLink('이 글 지우기');
      del.href = deleteUrl(path);
      bar.appendChild(del);
    }
    // 소개 쪽: 사이트 안의 편집 화면으로. 그 밖의 쪽(없는 주소 안내 등): 그 쪽의 파일을 고치는 링크
    if (canWrite && postHead && (body.dataset.about || body.dataset.page)) {
      var pageBar = document.createElement('p');
      pageBar.className = 'owner-bar';
      var pageEdit;
      if (body.dataset.about) {
        pageEdit = document.createElement('a');
        pageEdit.textContent = '소개 글 고치기';
        pageEdit.href = body.dataset.about;
      } else {
        pageEdit = ownerLink('이 쪽 고치기');
        pageEdit.href = editUrl(body.dataset.page);
      }
      pageBar.appendChild(pageEdit);
      postHead.appendChild(pageBar);
    }
    // 첫 화면: 소개 문장은 양식으로 고치고(_data/site/ 에 기록), 사이트 이름·필명은 _config.yml 에 있다
    var homeLead = document.querySelector('.home-lead');
    if (canWrite && homeLead) {
      var homeBar = document.createElement('p');
      homeBar.className = 'owner-bar';
      var introForm = itemForm('site-intro', {
        open: '소개 문장 고치기', field: '소개 문장', go: 'GitHub 에서 바꾸기', note: COMMIT_NOTE, free: true,
        initial: function () { return homeLead.textContent; },
        problem: function (text) { return text === homeLead.textContent ? '지금 문장과 같습니다' : ''; },
        url: function (text) { return newFileUrl('_data/site/' + stamp() + '.yml', 'intro: ' + yamlText(text) + '\n'); }
      });
      var homeEdit = ownerLink('사이트 이름·필명 고치기');
      homeEdit.href = editUrl('_config.yml');
      homeBar.appendChild(introForm.opener);
      homeBar.appendChild(homeEdit);
      var homeOwner = document.createElement('div');
      homeOwner.className = 'home-owner';
      homeOwner.appendChild(homeBar);
      homeOwner.appendChild(introForm.form);
      homeLead.insertAdjacentElement('afterend', homeOwner);
    }
    if (canWrite) setupDrag();
    setupPost();
    return;
  }

  // Section 쪽: 고른 소주제의 글 요약만 보여 준다
  var key = body.dataset.key;
  var items = Array.prototype.slice.call(list.children);
  var title = document.getElementById('sel-title');
  var count = document.getElementById('sel-count');
  var crumbs = document.getElementById('sel-crumbs');
  var desc = document.getElementById('sel-desc');
  var empty = document.getElementById('sel-empty');
  var siteTitle = document.title.split(' | ').pop();
  var first = true;
  if (canWrite) {
    var panelHead = document.querySelector('.panel-head');
    addItemForms(ownerBar(panelHead), panelHead);
    var dragHint = document.createElement('p');
    dragHint.className = 'owner-hint';
    dragHint.textContent = '글을 왼쪽의 항목으로 끌어다 놓으면 그 항목으로 옮길 수 있습니다. 왼쪽의 항목도 끌 수 있습니다: 다른 항목의 위아래 가장자리에 놓으면 순서가 바뀌고, 가운데에 놓으면 그 항목 아래로 들어갑니다.';
    panelHead.appendChild(dragHint);
    setupDrag();
  }

  // 나무에서 이 링크의 위쪽 항목들을 Section 부터 차례로 모은다
  function ancestors(link) {
    var chain = [];
    var li = link.closest('li');
    while (li) {
      var up = li.parentElement.closest('li');
      if (!up) break;
      chain.unshift(up.querySelector('a[data-key]'));
      li = up;
    }
    return chain;
  }

  function select() {
    var sid = '';
    try { sid = decodeURIComponent(location.hash.slice(1)); } catch (e) { /* 깨진 주소는 Section 전체로 */ }
    var link = mark(key, sid) || mark(key, '');
    if (!link) return;
    sid = link.dataset.sid;
    setCurrent(link, link.dataset.dir);

    var shown = 0;
    items.forEach(function (li) {
      var s = li.dataset.sid;
      var show = sid === '' || s === sid || s.indexOf(sid + '--') === 0;
      li.hidden = !show;
      if (show) shown += 1;
    });

    title.textContent = link.textContent;
    count.textContent = '글 ' + shown + '편';
    if (desc) {
      desc.textContent = link.dataset.desc || '';
      desc.hidden = !link.dataset.desc;
    }
    empty.hidden = shown > 0;
    document.title = link.textContent + ' | ' + siteTitle;

    crumbs.textContent = '';
    ancestors(link).forEach(function (a, i) {
      if (i > 0) {
        var sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '/';
        crumbs.appendChild(sep);
        crumbs.appendChild(document.createTextNode(' '));
      }
      var c = document.createElement('a');
      c.href = a.getAttribute('href');
      c.textContent = a.textContent;
      crumbs.appendChild(c);
      crumbs.appendChild(document.createTextNode(' '));
    });
    crumbs.hidden = !crumbs.firstChild;

    if (!first) {
      setNav(false);
      list.classList.remove('is-fresh');
      void list.offsetWidth;
      list.classList.add('is-fresh');
    }
    first = false;
  }

  select();
  window.addEventListener('hashchange', select);
})();
