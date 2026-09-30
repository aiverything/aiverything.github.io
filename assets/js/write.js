// 글 쓰기 쪽 (쓰기를 켠 브라우저에서만 동작한다).
//  - 임시저장: 쓰는 글은 이 브라우저의 저장소(localStorage)에만 둔다. 사이트에도 GitHub 에도 올라가지 않는다.
//  - 게시(새 글): 다 쓴 글을 GitHub 의 새 파일 화면으로 넘긴다. 짧은 글은 내용을 채워서 열고,
//    긴 글은 주소에 다 담을 수 없어 클립보드에 복사한 뒤 빈 화면을 연다(붙여 넣으면 된다).
//  - 고치기(올린 글): 글 쪽의 '이 글 고치기' 로 오면 올라가 있는 글을 GitHub 에서 읽어 와 칸에 채운다.
//    고친 글은 복사한 뒤 그 파일의 GitHub 편집 화면을 연다(전체 선택 후 붙여 넣어 바꾼다).
(function () {
  var api = window.siteOwner;
  var root = document.getElementById('writer');
  if (!api || !api.owner || !root) return;
  document.getElementById('writer-off').hidden = true;
  root.hidden = false;

  var KEY = 'drafts';

  function el(id) { return document.getElementById(id); }
  var list = el('draft-list');
  var empty = el('draft-empty');
  var heading = el('draft-heading');
  var title = el('draft-title');
  var place = el('draft-place');
  var dir = el('draft-dir');
  var slug = el('draft-slug');
  var summary = el('draft-summary');
  var text = el('draft-body');
  var status = el('draft-status');
  var publish = el('draft-publish');
  var after = el('draft-after');
  var delButton = el('draft-delete');
  var confirmBox = el('draft-confirm');

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function store() {
    try { localStorage.setItem(KEY, JSON.stringify(drafts)); return true; } catch (e) { return false; }
  }
  var drafts = load();
  var cur = null;

  // 항목 고르기: 왼쪽 나무의 항목 전부
  api.links.forEach(function (a) {
    var option = document.createElement('option');
    option.value = a.dataset.dir;
    option.textContent = api.itemLabel(a);
    dir.appendChild(option);
  });

  // 임시저장 글 하나. edit 가 있으면 올린 글(그 파일 경로)을 고치는 중인 것이다:
  //   head  그 파일 머리말의 줄들 (제목·요약 말고는 그대로 되돌려 쓴다)
  //   base  불러왔을 때의 제목·요약·본문 (고친 것이 있는지 볼 때 쓴다)
  function blank(d) {
    return { id: String(Date.now()), title: '', dir: d || (dir.options[0] ? dir.options[0].value : ''), slug: '', slugEdited: false, summary: '', body: '', updated: 0 };
  }
  function isEmpty(d) { return !d.title.trim() && !d.summary.trim() && !d.body.trim(); }
  function unchanged(d) {
    return d.edit && d.title.trim() === d.base.title && d.summary.trim() === d.base.summary && d.body.replace(/\s+$/, '') === d.base.body;
  }
  function saved(d) { return drafts.indexOf(d) !== -1; }
  function clock(ms) {
    return new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function dirLabel(d) {
    for (var i = 0; i < dir.options.length; i++) if (dir.options[i].value === d) return dir.options[i].textContent;
    return '';
  }
  // 제목에서 주소에 쓸 이름을 만든다: 띄어쓰기는 '-', 주소에 쓸 수 없는 글자는 뺀다
  function toSlug(s) {
    return s.trim().replace(/[\/\\#?%"<>|*:.]/g, '').replace(/\s+/g, '-').replace(/^[_-]+|-+$/g, '');
  }
  function quoted(s) { return '"' + s.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  // 머리말 값의 따옴표를 벗긴다 ("…" 안의 \" 와 \\ 도 되돌린다)
  function unquoted(s) {
    s = s.trim();
    if (s.length > 1 && s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1).replace(/\\(["\\])/g, '$1');
    if (s.length > 1 && s[0] === "'" && s[s.length - 1] === "'") return s.slice(1, -1).replace(/''/g, "'");
    return s;
  }

  function renderList() {
    list.textContent = '';
    drafts.slice().sort(function (a, b) { return b.updated - a.updated; }).forEach(function (d) {
      var li = document.createElement('li');
      var open = document.createElement('button');
      open.type = 'button';
      open.textContent = d.title.trim() || '제목 없는 글';
      if (d === cur) open.setAttribute('aria-current', 'true');
      open.addEventListener('click', function () { save(); edit(d); });
      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = (d.edit ? '올린 글 고치는 중' : dirLabel(d.dir)) + '  ' + clock(d.updated);
      li.appendChild(open);
      li.appendChild(meta);
      list.appendChild(li);
    });
    empty.hidden = drafts.length > 0;
    api.showDraftCount(drafts.length);
  }

  function edit(d) {
    cur = d;
    title.value = d.title;
    place.hidden = !!d.edit;  // 올린 글을 고칠 때는 항목과 주소를 바꾸지 않는다
    if (!d.edit) {
      dir.value = d.dir;
      if (dir.value !== d.dir && dir.options.length) dir.selectedIndex = 0;  // 없어진 항목이면 첫 항목으로
      slug.value = d.slug;
    }
    summary.value = d.summary;
    text.value = d.body;
    heading.textContent = d.edit ? '올린 글 고치기' : saved(d) ? '임시저장 글 고치기' : '새 글';
    publish.textContent = d.edit ? '저장하기' : '게시하기';
    status.textContent = saved(d) ? '임시저장한 글입니다 (' + clock(d.updated) + ')'
      : d.edit ? '올라가 있는 글을 불러왔습니다. 고치기 시작하면 자동으로 임시저장됩니다'
      : '쓰기 시작하면 자동으로 임시저장됩니다';
    after.hidden = true;
    closeConfirm();
    delButton.hidden = !saved(d);
    renderList();
    refreshPublish();
  }

  // 칸의 내용을 지금 글에 담아 저장한다. 아무것도 안 쓴 새 글, 고친 데가 없는 올린 글은 저장하지 않는다.
  function save() {
    if (!cur) return;
    cur.title = title.value;
    if (!cur.edit) {
      cur.dir = dir.value;
      cur.slug = slug.value;
    }
    cur.summary = summary.value;
    cur.body = text.value;
    if (!saved(cur)) {
      if (isEmpty(cur) || unchanged(cur)) return;
      drafts.push(cur);
      if (!cur.edit) heading.textContent = '임시저장 글 고치기';
      delButton.hidden = false;
    }
    cur.updated = Date.now();
    status.textContent = store()
      ? '임시저장했습니다 (' + clock(cur.updated) + ')'
      : '임시저장하지 못했습니다. 이 브라우저가 저장을 막고 있습니다. 본문을 따로 복사해 두세요';
    renderList();
  }

  // 게시하거나 저장할 파일의 이름과 내용
  function fileOf(d) {
    var tail = '---\n\n' + d.body.replace(/\s+$/, '') + '\n';
    if (d.edit) {
      // 머리말의 다른 줄(날짜 등)은 그대로 두고 제목과 요약만 바꿔 쓴다
      var lines = d.head.filter(function (line) { return !/^(title|summary):/.test(line); });
      lines.unshift('title: ' + quoted(d.title));
      if (d.summary.trim()) lines.push('summary: ' + quoted(d.summary));
      return { name: d.edit, text: '---\n' + lines.join('\n') + '\n' + tail };
    }
    var now = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date());
    var head = '---\ntitle: ' + quoted(d.title) + '\ndate: ' + now + '\n';
    if (d.summary.trim()) head += 'summary: ' + quoted(d.summary) + '\n';
    return { name: d.dir + d.slug.trim() + '.md', text: head + tail };
  }
  // 게시·저장할 수 없는 까닭. 없으면 ''
  function problem() {
    if (!api.canWrite) return '저장소 주소를 알 수 없어 게시할 수 없습니다 (사이트를 GitHub 에 올린 뒤에 됩니다)';
    if (!title.value.trim()) return '제목을 적어 주세요';
    if (!text.value.trim()) return '본문을 써 주세요';
    if (cur.edit) {
      return title.value.trim() === cur.base.title && summary.value.trim() === cur.base.summary && text.value.replace(/\s+$/, '') === cur.base.body
        ? '고친 내용이 없습니다' : '';
    }
    if (!dir.value) return '글을 넣을 항목이 없습니다. 항목을 먼저 만들어 주세요';
    var s = slug.value.trim();
    if (!s) return '주소에 쓸 이름을 적어 주세요';
    if (/[\/\\#?%"<>|*:]/.test(s) || /^[._]/.test(s)) return '주소에 쓸 이름에는 / \\ # ? % " < > | * : 를 쓸 수 없고, . 이나 _ 로 시작할 수 없습니다';
    return '';
  }
  var blocked = '';
  function refreshPublish() {
    blocked = problem();
    if (blocked) {
      publish.removeAttribute('href');
      publish.setAttribute('aria-disabled', 'true');
    } else {
      publish.href = cur.edit ? api.editUrl(cur.edit) : api.newFileUrl(dir.value + slug.value.trim() + '.md', '');
      publish.removeAttribute('aria-disabled');
    }
    publish.title = blocked;
  }

  publish.addEventListener('click', function (e) {
    save();
    refreshPublish();
    if (blocked) {
      e.preventDefault();
      status.textContent = blocked;
      return;
    }
    var file = fileOf(cur);
    var note;
    if (cur.edit) {
      // 이미 있는 파일은 GitHub 화면을 채워서 열 수 없다: 복사해 두고 편집 화면을 연다
      publish.href = api.editUrl(cur.edit);
      note = api.copyNow(file.text)
        ? '고친 글을 복사했습니다. 열린 GitHub 화면에서 본문 칸을 한 번 누르고, 전체 선택(Ctrl+A) 뒤 붙여 넣은(Ctrl+V) 다음 Commit changes 를 누르면 1~2분 뒤 반영됩니다. 전체 선택을 빠뜨리면 글이 두 번 들어가니 주의하세요.'
        : '고친 글을 복사하지 못했습니다. 다시 눌러 보거나 다른 브라우저에서 해 보세요.';
      note += ' 저장을 마친 뒤에는 이 임시저장 글을 지워도 됩니다.';
    } else {
      var how = api.handOff(publish, file.name, file.text);
      note = how === 'filled' ? 'GitHub 화면에 글이 채워져 열립니다. Commit changes 를 누르면 1~2분 뒤 게시됩니다.'
        : how === 'copied' ? '글을 복사했습니다. 열린 GitHub 화면의 빈 본문 칸에 붙여 넣고(Ctrl+V) Commit changes 를 누르면 1~2분 뒤 게시됩니다.'
        : '글을 복사하지 못했습니다. 아래 본문을 직접 복사해 GitHub 화면에 붙여 넣어 주세요. 맨 위에 제목과 날짜 머리말도 필요합니다.';
      note += ' 게시를 마친 뒤에는 이 임시저장 글을 지워도 됩니다.';
    }
    after.textContent = note;
    after.hidden = false;
  });

  // 쓰는 대로 임시저장
  var timer = null;
  function changed() {
    clearTimeout(timer);
    timer = setTimeout(save, 500);
    refreshPublish();
  }
  title.addEventListener('input', function () {
    if (!cur.edit && !cur.slugEdited) slug.value = toSlug(title.value);
    changed();
  });
  slug.addEventListener('input', function () { cur.slugEdited = slug.value.trim() !== ''; changed(); });
  [summary, text].forEach(function (f) { f.addEventListener('input', changed); });
  dir.addEventListener('change', changed);
  window.addEventListener('pagehide', function () { clearTimeout(timer); save(); });
  el('draft-form').addEventListener('submit', function (e) { e.preventDefault(); });

  el('draft-new').addEventListener('click', function () {
    clearTimeout(timer);
    save();
    edit(blank(dir.value));
    title.focus();
  });

  // 지우기는 한 번 더 묻는다
  function closeConfirm() { confirmBox.hidden = true; }
  delButton.addEventListener('click', function () { confirmBox.hidden = false; });
  el('draft-delete-no').addEventListener('click', closeConfirm);
  el('draft-delete-yes').addEventListener('click', function () {
    clearTimeout(timer);
    drafts = drafts.filter(function (d) { return d !== cur; });
    store();
    edit(blank(dir.value));
    status.textContent = '임시저장 글을 지웠습니다';
  });

  // 올라가 있는 글 파일을 GitHub 에서 읽어 온다 (공개 저장소라 로그인 없이 읽힌다)
  function fetchSource(path) {
    var repo = api.repo.replace(/^https:\/\/github\.com\//, '');
    var encoded = path.split('/').map(encodeURIComponent).join('/');
    return fetch('https://api.github.com/repos/' + repo + '/contents/' + encoded + '?ref=' + encodeURIComponent(api.branch))
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (j) {
        var bin = atob(j.content.replace(/\s/g, ''));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8').decode(bytes);
      })
      .catch(function () {
        // API 가 막히면(한 시간에 60번 제한) 원본 파일 주소에서 읽는다. 방금 고친 내용은 몇 분 늦게 보일 수 있다
        return fetch('https://raw.githubusercontent.com/' + repo + '/' + encodeURIComponent(api.branch) + '/' + encoded)
          .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.text(); });
      });
  }
  // 파일 내용을 머리말 줄들과 본문으로 나눠 고치는 글을 만든다
  function draftFrom(path, source) {
    var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
    var head = m ? m[1].split(/\r?\n/) : [];
    var body = (m ? m[2] : source).replace(/^\s*\n/, '').replace(/\s+$/, '');
    var d = blank('');
    d.edit = path;
    d.head = head;
    head.forEach(function (line) {
      var kv = /^(title|summary):\s*(.*)$/.exec(line);
      if (kv) d[kv[1]] = unquoted(kv[2]);
    });
    d.body = body;
    d.base = { title: d.title.trim(), summary: d.summary.trim(), body: body };
    return d;
  }

  // 시작: '이 글 고치기' 로 왔으면 그 글, '이 항목에 글 쓰기' 로 왔으면 그 항목의 새 글, 아니면 가장 최근 임시저장 글
  function start() {
    var hash = location.hash;
    var arg = '';
    try { arg = decodeURIComponent(hash.slice(hash.indexOf(':') + 1)); } catch (e) { /* 깨진 주소는 무시 */ }
    if (hash) history.replaceState(null, '', location.pathname);
    clearTimeout(timer);
    save();
    var latest = drafts.slice().sort(function (a, b) { return b.updated - a.updated; })[0];

    if (hash.indexOf('#edit:') === 0 && arg) {
      var mine = drafts.filter(function (d) { return d.edit === arg; })[0];
      if (mine) {
        edit(mine);
        status.textContent = '이 글을 고치던 임시저장 글을 불러왔습니다. 올라가 있는 글에서 다시 시작하려면 이 임시저장 글을 지우고 다시 들어오세요';
        return;
      }
      edit(blank(''));
      status.textContent = '올라가 있는 글을 불러오는 중입니다…';
      fetchSource(arg).then(function (source) {
        save();
        edit(draftFrom(arg, source));
      }, function () {
        status.textContent = '올라가 있는 글을 불러오지 못했습니다. 잠시 뒤 글 쪽의 "이 글 고치기" 를 다시 눌러 주세요';
      });
    } else if (hash.indexOf('#new:') === 0 && arg) {
      edit(blank(arg));
    } else {
      edit(latest || blank(''));
    }
  }
  start();
  window.addEventListener('hashchange', start);
})();

// 소개 글 고치기 쪽: 지금 올라가 있는 소개 글을 칸에 채워 두고, 고친 글을 새 기록 파일로 넘긴다.
// 쓰는 중인 내용은 글 쓰기와 마찬가지로 이 브라우저에만 임시저장된다.
(function () {
  var api = window.siteOwner;
  var root = document.getElementById('about-editor');
  if (!api || !api.owner || !root) return;
  document.getElementById('writer-off').hidden = true;
  root.hidden = false;

  var KEY = 'draft-about';
  var text = document.getElementById('about-body');
  var status = document.getElementById('about-status');
  var save = document.getElementById('about-save');
  var after = document.getElementById('about-after');
  var live = '';
  try { live = JSON.parse(document.getElementById('about-source').textContent) || ''; } catch (e) { /* 원문을 못 읽으면 빈 칸에서 시작 */ }

  var draft = null;
  try { draft = localStorage.getItem(KEY); } catch (e) { /* 저장소를 못 쓰면 임시저장 없이 */ }
  text.value = draft !== null ? draft : live;
  status.textContent = draft !== null && draft !== live ? '임시저장해 둔 내용을 불러왔습니다' : '지금 올라가 있는 소개 글입니다';

  function problem() {
    if (!api.canWrite) return '저장소 주소를 알 수 없어 저장할 수 없습니다';
    if (!text.value.trim()) return '소개 글을 쓰면 저장할 수 있습니다';
    if (text.value.trim() === live.trim()) return '지금 올라가 있는 글과 같습니다';
    return '';
  }
  function refresh() {
    var blocked = problem();
    if (blocked) {
      save.removeAttribute('href');
      save.setAttribute('aria-disabled', 'true');
    } else {
      save.href = api.newFileUrl('_data/about/' + api.stamp() + '.json', '');
      save.removeAttribute('aria-disabled');
    }
    save.title = blocked;
    return blocked;
  }
  var timer = null;
  function keep() {
    var ok = true;
    try { localStorage.setItem(KEY, text.value); } catch (e) { ok = false; }
    status.textContent = ok ? '임시저장했습니다' : '임시저장하지 못했습니다. 내용을 따로 복사해 두세요';
  }
  text.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(keep, 500);
    refresh();
  });
  window.addEventListener('pagehide', function () { if (text.value !== live) keep(); });
  document.getElementById('about-form').addEventListener('submit', function (e) { e.preventDefault(); });

  save.addEventListener('click', function (e) {
    var blocked = refresh();
    if (blocked) {
      e.preventDefault();
      status.textContent = blocked;
      return;
    }
    var body = JSON.stringify({ text: text.value.replace(/\s+$/, '') }, null, 0) + '\n';
    var how = api.handOff(save, '_data/about/' + api.stamp() + '.json', body);
    after.textContent = (how === 'filled' ? 'GitHub 화면에 내용이 채워져 열립니다. Commit changes 를 누르면 1~2분 뒤 소개 쪽에 반영됩니다.'
      : how === 'copied' ? '내용을 복사했습니다. 열린 GitHub 화면의 빈 본문 칸에 붙여 넣고(Ctrl+V) Commit changes 를 누르면 1~2분 뒤 소개 쪽에 반영됩니다.'
      : '내용을 복사하지 못했습니다. 다시 눌러 보거나 다른 브라우저에서 해 보세요.')
      + ' GitHub 화면의 내용은 글이 한 줄로 이어져 보이지만 그대로 두면 됩니다.';
    after.hidden = false;
  });

  document.getElementById('about-reset').addEventListener('click', function () {
    clearTimeout(timer);
    text.value = live;
    try { localStorage.removeItem(KEY); } catch (e) { /* 지울 것이 없다 */ }
    status.textContent = '지금 올라가 있는 소개 글로 되돌렸습니다';
    after.hidden = true;
    refresh();
  });

  refresh();
})();
