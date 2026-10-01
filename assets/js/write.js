// 글 쓰기 쪽들이 함께 쓰는 것: 그림 넣기와 미리보기.
//  - 그림: 본문 칸에 붙여 넣거나 끌어다 놓은 그림을 (크면 줄여서) 저장소의 assets/img/ 에 올리고,
//    커서 자리에 그 그림을 가리키는 글을 넣는다. GitHub 에 연결돼 있어야 한다.
//  - 미리보기: 본문을 사이트에 나올 모습에 가깝게 보여 준다. 방금 올린 그림은 사이트에 반영되기 전이라도 보인다.
var writeKit = (function () {
  var api = window.siteOwner;
  var MAX_SIDE = 1600;          // 이보다 긴 변은 이 길이로 줄인다
  var KEEP_BYTES = 600 * 1024;  // 이보다 작고 줄일 필요도 없으면 원본 그대로 올린다
  var fresh = {};               // 이번에 올린 그림: 사이트 안의 주소 → 이 브라우저 안의 임시 주소

  function shrink(file) {
    var keep = { blob: file, ext: (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg') };
    if (/gif|svg/.test(file.type)) return Promise.resolve(keep);  // 움직이는 그림과 벡터 그림은 그대로
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale === 1 && file.size <= KEEP_BYTES) {
          URL.revokeObjectURL(url);
          resolve(keep);
          return;
        }
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        var pen = canvas.getContext('2d');
        pen.fillStyle = '#fff';  // 투명한 곳은 흰 바탕으로
        pen.fillRect(0, 0, canvas.width, canvas.height);
        pen.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { resolve(blob ? { blob: blob, ext: 'jpg' } : keep); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(keep); };
      img.src = url;
    });
  }
  function insertAt(area, text) {
    var at = area.selectionStart;
    area.value = area.value.slice(0, at) + text + area.value.slice(area.selectionEnd);
    area.selectionStart = area.selectionEnd = at + text.length;
  }
  function swap(area, from, to) {
    var at = area.value.indexOf(from);
    if (at === -1) return;
    var caret = area.selectionStart;
    area.value = area.value.slice(0, at) + to + area.value.slice(at + from.length);
    if (caret > at) area.selectionStart = area.selectionEnd = caret + to.length - from.length;
  }
  var serial = 0;

  // area 에 그림 붙여넣기·끌어 넣기를 붙인다. say(글)로 진행 상황을 알린다
  function attachImages(area, say) {
    function upload(file) {
      serial += 1;
      var mark = '![올리는 중 ' + serial + '…]()';
      var before = area.value.slice(0, area.selectionStart);
      var behind = area.value.slice(area.selectionEnd);
      // 그림은 앞뒤를 빈 줄로 띄운다. 이미 띄워져 있으면 더하지 않는다
      var lead = !before || /\n\n$/.test(before) ? '' : /\n$/.test(before) ? '\n' : '\n\n';
      var trail = /^\n\n/.test(behind) ? '' : /^\n/.test(behind) ? '\n' : '\n\n';
      insertAt(area, lead + mark + trail);
      say('그림을 올리는 중입니다…');
      return shrink(file).then(function (img) {
        var when = api.stamp();
        var path = 'assets/img/' + when.slice(0, 4) + '/' + when + '-' + serial + '.' + img.ext;
        return img.blob.arrayBuffer().then(function (buf) {
          return api.putFile(path, api.bytesToBase64(new Uint8Array(buf)), '그림 올림');
        }).then(function () {
          fresh['/' + path] = URL.createObjectURL(img.blob);
          swap(area, mark, '![](/' + path + ')');
          say('그림을 올렸습니다. 대괄호 [] 안에 그림 설명을 적을 수 있습니다');
          area.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }).catch(function (err) {
        swap(area, mark, '');
        say('그림을 올리지 못했습니다. ' + api.why(err));
        area.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    function take(files, e) {
      var images = Array.prototype.filter.call(files || [], function (f) { return /^image\//.test(f.type); });
      if (!images.length) return;
      e.preventDefault();
      if (!api.direct) {
        say('그림을 넣으려면 먼저 GitHub 연결이 필요합니다 (글 쓰기 쪽 맨 위의 GitHub 연결)');
        return;
      }
      images.reduce(function (turn, file) { return turn.then(function () { return upload(file); }); }, Promise.resolve());
    }
    function carriesFiles(e) {
      return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1;
    }
    area.addEventListener('paste', function (e) { take(e.clipboardData && e.clipboardData.files, e); });
    area.addEventListener('dragover', function (e) {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      area.classList.add('is-dropping');
    });
    area.addEventListener('dragleave', function () { area.classList.remove('is-dropping'); });
    area.addEventListener('drop', function (e) {
      area.classList.remove('is-dropping');
      if (carriesFiles(e)) take(e.dataTransfer.files, e);
    });
  }
  function imageNote() {
    return api.direct
      ? '그림은 본문 칸에 붙여 넣거나(Ctrl+V) 파일을 끌어다 놓으면 커서가 있는 자리에 들어갑니다. 큰 사진은 자동으로 줄여서 올립니다.'
      : '그림을 넣으려면 GitHub 연결이 필요합니다 (글 쓰기 쪽 맨 위).';
  }
  // 본문을 미리보기 칸에 그린다
  function preview(area, target) {
    if (!window.marked) {
      target.textContent = '미리보기를 준비하지 못했습니다.';
      return;
    }
    target.innerHTML = window.marked.parse(area.value, { mangle: false, headerIds: false });
    Array.prototype.forEach.call(target.querySelectorAll('img'), function (img) {
      var src = img.getAttribute('src');
      if (fresh[src]) img.src = fresh[src];
    });
  }
  return { attachImages: attachImages, imageNote: imageNote, preview: preview };
})();

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
    if (previewBox && !previewBox.hidden) writeKit.preview(text, previewBox);
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
    if (api.direct) {
      // GitHub 에 연결돼 있으면 화면을 거치지 않고 바로 올린다
      e.preventDefault();
      var sent = cur;
      var verb = sent.edit ? '저장' : '게시';
      status.textContent = verb + '하는 중입니다…';
      publish.setAttribute('aria-disabled', 'true');
      publish.removeAttribute('href');
      api.putFile(file.name, api.textToBase64(file.text), (sent.edit ? '글 고침: ' : '글 올림: ') + sent.title.trim(), !!sent.edit).then(function () {
        drafts = drafts.filter(function (d) { return d !== sent; });
        store();
        edit(blank(dir.value));
        status.textContent = verb + '했습니다';
        after.textContent = '「' + sent.title.trim() + '」 글을 ' + verb + '했습니다. 사이트에 반영되면 화면 아래에 알림이 나옵니다. 임시저장 글은 지웠습니다.';
        after.hidden = false;
      }, function (err) {
        refreshPublish();
        status.textContent = verb + '하지 못했습니다. ' + api.why(err);
      });
      return;
    }
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

  // 그림 넣기와 미리보기
  var previewBox = el('draft-preview');
  var previewToggle = el('draft-preview-toggle');
  el('draft-image-note').textContent = writeKit.imageNote();
  writeKit.attachImages(text, function (say) { status.textContent = say; });
  previewToggle.addEventListener('click', function () {
    previewBox.hidden = !previewBox.hidden;
    previewToggle.setAttribute('aria-expanded', String(!previewBox.hidden));
    previewToggle.textContent = previewBox.hidden ? '미리보기' : '미리보기 닫기';
    if (!previewBox.hidden) writeKit.preview(text, previewBox);
  });

  // 쓰는 대로 임시저장
  var timer = null;
  function changed() {
    clearTimeout(timer);
    timer = setTimeout(save, 500);
    after.hidden = true;
    refreshPublish();
    if (!previewBox.hidden) writeKit.preview(text, previewBox);
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
  document.getElementById('about-image-note').textContent = writeKit.imageNote();
  writeKit.attachImages(text, function (say) { status.textContent = say; });
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
    if (api.direct) {
      e.preventDefault();
      status.textContent = '저장하는 중입니다…';
      save.setAttribute('aria-disabled', 'true');
      save.removeAttribute('href');
      api.putFile('_data/about/' + api.stamp() + '.json', api.textToBase64(body), '소개 글 고침').then(function () {
        clearTimeout(timer);
        live = text.value;
        try { localStorage.removeItem(KEY); } catch (err) { /* 지울 것이 없다 */ }
        status.textContent = '저장했습니다';
        after.textContent = '소개 글을 저장했습니다. 사이트에 반영되면 화면 아래에 알림이 나옵니다.';
        after.hidden = false;
        refresh();
      }, function (err) {
        refresh();
        status.textContent = '저장하지 못했습니다. ' + api.why(err);
      });
      return;
    }
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

// GitHub 연결: 이 저장소의 토큰을 이 브라우저에 넣어 두면, 그림을 올릴 수 있고
// 게시·고치기·지우기·옮기기가 GitHub 화면을 거치지 않고 바로 저장된다 (assets/js/site.js 의 'GitHub 연결').
(function () {
  var api = window.siteOwner;
  var box = document.getElementById('connect');
  if (!api || !box) return;
  function el(id) { return document.getElementById(id); }
  var state = el('connect-state');
  var steps = el('connect-steps');
  var off = el('connect-off');
  var input = el('connect-token');
  var hint = el('connect-hint');

  var names = api.repo ? api.repo.replace(/^https:\/\/github\.com\//, '').split('/') : null;
  if (!names) {
    state.textContent = '이 사이트가 GitHub 에 올라간 뒤에 연결할 수 있습니다.';
    steps.hidden = true;
    return;
  }
  if (api.direct) {
    state.textContent = 'GitHub 에 연결되어 있습니다' + (api.who ? ' (' + api.who.login + ')' : '') + '. 글과 그림이 사이트에서 바로 저장됩니다.';
    steps.hidden = true;
    off.hidden = false;
  } else {
    state.textContent = '글쓴이만 쓰는 기능입니다. 연결하면 그림을 붙여 넣을 수 있고, 게시·고치기·지우기·옮기기가 GitHub 화면을 거치지 않고 바로 저장됩니다.';
  }
  // 토큰 만들기 화면을 조건이 채워진 채로 연다: 이 계정, 1년, Contents 쓰기
  el('connect-make').href = 'https://github.com/settings/personal-access-tokens/new'
    + '?name=' + encodeURIComponent((names[1] + ' 글쓰기').slice(0, 40))
    + '&description=' + encodeURIComponent('사이트에서 글과 그림을 올리는 데 씁니다')
    + '&target_name=' + encodeURIComponent(names[0])
    + '&expires_in=365&contents=write';

  el('connect-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (!value) {
      hint.textContent = '토큰을 붙여 넣어 주세요';
      return;
    }
    hint.textContent = '확인하는 중입니다…';
    api.connect(value).then(function () {
      location.href = location.pathname;
    }, function (err) {
      hint.textContent = err.other ? '이 토큰은 다른 계정(' + err.other + ')의 것입니다. 이 사이트 주인의 계정으로 만든 토큰이어야 합니다'
        : err.status === 401 ? '토큰이 맞지 않습니다. 복사한 값을 다시 확인해 주세요'
        : err.status ? api.why(err)
        : '이 브라우저에 저장하지 못했거나 GitHub 에 닿지 못했습니다. 잠시 뒤 다시 해 주세요';
    });
  });
  off.addEventListener('click', function () {
    api.disconnect();
    location.href = location.pathname;
  });
})();

// 댓글 관리 로그인: Firebase 에 만들어 둔 글쓴이 계정으로 로그인하면 이 브라우저에서 모든 댓글을 지울 수 있다
// (assets/js/comments.js 의 siteComments). GitHub 연결과는 별개의 로그인이다.
(function () {
  var api = window.siteOwner;
  var comments = window.siteComments;
  var box = document.getElementById('comment-admin');
  if (!api || !api.owner || !comments || !comments.ready || !box) return;
  function el(id) { return document.getElementById(id); }
  var state = el('comment-admin-state');
  var form = el('comment-admin-form');
  var hint = el('comment-admin-hint');
  var off = el('comment-admin-off');
  box.hidden = false;

  function draw() {
    var on = comments.isOwner();
    state.textContent = on
      ? '댓글 관리자로 로그인되어 있습니다. 글 화면에서 모든 댓글에 "지우기"가 보이고, 이 브라우저에서 쓰는 댓글에는 "글쓴이" 표시가 붙습니다.'
      : 'Firebase 에 만들어 둔 글쓴이 계정으로 로그인하면 모든 댓글을 지울 수 있습니다.';
    form.hidden = on;
    off.hidden = !on;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = el('comment-admin-email').value.trim();
    var pass = el('comment-admin-pass').value;
    if (!email || !pass) {
      hint.textContent = '이메일과 비밀번호를 적어 주세요';
      return;
    }
    hint.textContent = '확인하는 중입니다…';
    comments.signIn(email, pass).then(function () {
      if (!comments.isOwner()) {
        comments.signOut();
        hint.textContent = '이 계정은 설정에 적힌 글쓴이 계정이 아닙니다';
        return;
      }
      el('comment-admin-pass').value = '';
      hint.textContent = '';
      draw();
    }, function (err) {
      hint.textContent = err.status === 400 ? '이메일이나 비밀번호가 맞지 않습니다' : '로그인하지 못했습니다. 잠시 뒤 다시 해 주세요';
    });
  });
  off.addEventListener('click', function () {
    comments.signOut();
    draw();
  });
  draw();
})();
