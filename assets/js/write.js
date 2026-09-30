// 글 쓰기 쪽 (쓰기를 켠 브라우저에서만 동작한다).
//  - 임시저장: 쓰는 글은 이 브라우저의 저장소(localStorage)에만 둔다. 사이트에도 GitHub 에도 올라가지 않는다.
//  - 게시: 다 쓴 글을 GitHub 의 새 파일 화면으로 넘긴다. 짧은 글은 내용을 채워서 열고,
//    긴 글은 주소에 다 담을 수 없어 클립보드에 복사한 뒤 빈 화면을 연다(붙여 넣으면 된다).
(function () {
  var api = window.siteOwner;
  var root = document.getElementById('writer');
  if (!api || !api.owner || !root) return;
  document.getElementById('writer-off').hidden = true;
  root.hidden = false;

  var KEY = 'drafts';
  var URL_LIMIT = 2000;  // 이보다 긴 주소는 GitHub 가 받지 못할 수 있어 클립보드로 넘긴다

  function el(id) { return document.getElementById(id); }
  var list = el('draft-list');
  var empty = el('draft-empty');
  var heading = el('draft-heading');
  var title = el('draft-title');
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

  function blank(d) {
    return { id: String(Date.now()), title: '', dir: d || (dir.options[0] ? dir.options[0].value : ''), slug: '', slugEdited: false, summary: '', body: '', updated: 0 };
  }
  function isEmpty(d) { return !d.title.trim() && !d.summary.trim() && !d.body.trim(); }
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
      meta.textContent = dirLabel(d.dir) + '  ' + clock(d.updated);
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
    dir.value = d.dir;
    if (dir.value !== d.dir && dir.options.length) dir.selectedIndex = 0;  // 없어진 항목이면 첫 항목으로
    slug.value = d.slug;
    summary.value = d.summary;
    text.value = d.body;
    heading.textContent = saved(d) ? '임시저장 글 고치기' : '새 글';
    status.textContent = saved(d) ? '임시저장한 글입니다 (' + clock(d.updated) + ')' : '쓰기 시작하면 자동으로 임시저장됩니다';
    after.hidden = true;
    closeConfirm();
    delButton.hidden = !saved(d);
    renderList();
    refreshPublish();
  }

  // 칸의 내용을 지금 글에 담아 저장한다. 아무것도 안 쓴 새 글은 저장하지 않는다.
  function save() {
    if (!cur) return;
    cur.title = title.value;
    cur.dir = dir.value;
    cur.slug = slug.value;
    cur.summary = summary.value;
    cur.body = text.value;
    if (!saved(cur)) {
      if (isEmpty(cur)) return;
      drafts.push(cur);
      heading.textContent = '임시저장 글 고치기';
      delButton.hidden = false;
    }
    cur.updated = Date.now();
    status.textContent = store()
      ? '임시저장했습니다 (' + clock(cur.updated) + ')'
      : '임시저장하지 못했습니다. 이 브라우저가 저장을 막고 있습니다. 본문을 따로 복사해 두세요';
    renderList();
  }

  // 게시할 파일의 이름과 내용
  function fileOf(d) {
    var now = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date());
    function quoted(s) { return '"' + s.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
    var head = '---\ntitle: ' + quoted(d.title) + '\ndate: ' + now + '\n';
    if (d.summary.trim()) head += 'summary: ' + quoted(d.summary) + '\n';
    return { name: d.dir + d.slug.trim() + '.md', text: head + '---\n\n' + d.body.replace(/\s+$/, '') + '\n' };
  }
  // 게시할 수 없는 까닭. 없으면 ''
  function problem() {
    if (!api.canWrite) return '저장소 주소를 알 수 없어 게시할 수 없습니다 (사이트를 GitHub 에 올린 뒤에 됩니다)';
    if (!title.value.trim()) return '제목을 적으면 게시할 수 있습니다';
    if (!dir.value) return '글을 넣을 항목이 없습니다. 항목을 먼저 만들어 주세요';
    var s = slug.value.trim();
    if (!s) return '주소에 쓸 이름을 적어 주세요';
    if (/[\/\\#?%"<>|*:]/.test(s) || /^[._]/.test(s)) return '주소에 쓸 이름에는 / \\ # ? % " < > | * : 를 쓸 수 없고, . 이나 _ 로 시작할 수 없습니다';
    if (!text.value.trim()) return '본문을 쓰면 게시할 수 있습니다';
    return '';
  }
  var blocked = '';
  function refreshPublish() {
    blocked = problem();
    if (blocked) {
      publish.removeAttribute('href');
      publish.setAttribute('aria-disabled', 'true');
    } else {
      publish.href = api.newFileUrl(dir.value + slug.value.trim() + '.md', '');
      publish.removeAttribute('aria-disabled');
    }
    publish.title = blocked;
  }

  // 클릭 안에서 바로 끝나는 복사 (새 탭이 열려도 끊기지 않게)
  function copyNow(s) {
    var ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* 아래에서 다시 시도 */ }
    document.body.removeChild(ta);
    if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).catch(function () {});
    }
    return ok;
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
    var full = api.newFileUrl(file.name, file.text);
    var note;
    if (full.length <= URL_LIMIT) {
      publish.href = full;
      note = 'GitHub 화면에 글이 채워져 열립니다. Commit changes 를 누르면 1~2분 뒤 게시됩니다.';
    } else {
      publish.href = api.newFileUrl(file.name, '');
      note = copyNow(file.text)
        ? '글을 복사했습니다. 열린 GitHub 화면의 빈 본문 칸에 붙여 넣고(Ctrl+V) Commit changes 를 누르면 1~2분 뒤 게시됩니다.'
        : '글을 복사하지 못했습니다. 아래 본문을 직접 복사해 GitHub 화면에 붙여 넣어 주세요. 맨 위에 제목과 날짜 머리말도 필요합니다.';
    }
    after.textContent = note + ' 게시를 마친 뒤에는 이 임시저장 글을 지워도 됩니다.';
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
    if (!cur.slugEdited) slug.value = toSlug(title.value);
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

  // 시작: '이 항목에 글 쓰기' 로 왔으면 그 항목의 새 글, 아니면 가장 최근 임시저장 글
  var start = null;
  if (location.hash.indexOf('#new:') === 0) {
    try { start = blank(decodeURIComponent(location.hash.slice(5))); } catch (e) { /* 깨진 주소는 무시 */ }
    history.replaceState(null, '', location.pathname);
  }
  if (!start && drafts.length) {
    start = drafts.slice().sort(function (a, b) { return b.updated - a.updated; })[0];
  }
  edit(start || blank(''));
})();
