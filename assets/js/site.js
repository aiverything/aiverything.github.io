// 왼쪽 항목 나무와 오른쪽 요약 목록을 잇는다.
//  - 어느 쪽에서든: 지금 쪽이 속한 항목을 나무에서 표시하고 거기까지 펼친다.
//  - Section 쪽에서: 주소의 #소주제id 에 속한 글만 요약 목록에 남긴다.
//  - 주인 전용 링크: 주소 끝에 ?write=on 을 붙여 한 번 들어온 브라우저에서만
//    글 쓰기·고치기·지우기, 항목 만들기·이름 바꾸기·지우기가 보인다 (?write=off 로 끈다).
//    보이기만 가리는 것이고, 저장 권한은 GitHub 가 따로 확인한다.
//    쓰기를 켠 브라우저에서는 요약 목록의 글을 왼쪽 나무의 항목으로 끌어다 놓아 옮길 수도 있다.
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
  var owner = forced || realOwner;
  var repo = body.dataset.repo;
  var branch = body.dataset.branch;
  var canWrite = owner && repo && branch;

  function enc(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }
  // 글 쓰기 쪽 주소. dir('_writing/기술/…/')을 주면 그 항목에 새 글을 연다
  function writeUrl(dir) {
    return body.dataset.write + (dir ? '#new:' + encodeURIComponent(dir) : '');
  }
  // GitHub 에서 파일 하나를 지우는 화면의 주소
  function deleteUrl(path) {
    return repo + '/delete/' + enc(branch) + '/' + enc(path);
  }
  function ownerLink(label) {
    var a = document.createElement('a');
    a.textContent = label;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }
  function newFileUrl(name, text) {
    return repo + '/new/' + enc(branch) + '?filename=' + encodeURIComponent(name) + '&value=' + encodeURIComponent(text);
  }
  // 한국 시간의 지금 시각을 '260930-231205' 꼴로 (파일 이름에 쓴다)
  function stamp() {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date()).replace(/[-:]/g, '').replace(' ', '-');
  }
  // 나무에서 dir 바로 아래에 있는 항목들 ('_writing/' 바로 아래는 Section 들)
  function childrenOf(dir) {
    return links.filter(function (a) { return a.dataset.dir.replace(/[^/]+\/$/, '') === dir; });
  }
  // dir 바로 아래에 name 이라는 이름(보이는 이름이든 폴더 이름이든)이 이미 있는가. except 는 빼고 본다
  function nameTaken(dir, name, except) {
    return childrenOf(dir).some(function (a) {
      return a !== except && (a.textContent === name || a.dataset.dir === dir + name + '/');
    });
  }

  // 이름을 적으면 GitHub 의 새 파일 화면으로 가는 작은 양식. 여닫는 단추와 양식을 돌려준다.
  //   o.problem(name)  쓸 수 없는 이름이면 그 까닭, 괜찮으면 ''
  //   o.url(name)      그 이름으로 만들 파일의 GitHub 주소
  //   o.initial()      (있으면) 양식을 열 때 칸에 채울 이름
  //   o.note           이름이 괜찮을 때 보여 줄 안내
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
      if (/[\/\\#?%"<>|*:]/.test(name)) problem = '이름에 / \\ # ? % " < > | * : 는 쓸 수 없습니다';
      else if (/^[._]/.test(name)) problem = '이름은 . 이나 _ 로 시작할 수 없습니다';
      else if (name) problem = o.problem(name);
      if (name && !problem) {
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
    refresh();
    return { opener: opener, form: form, refresh: refresh, close: function () { show(false); } };
  }
  var COMMIT_NOTE = 'GitHub 화면에서 Commit changes 를 누르면 1~2분 뒤 반영됩니다';

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
      problem: function (name) { return nameTaken(newDir, name, null) ? '이미 있는 항목입니다' : ''; },
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
        var parent = current.dataset.dir.replace(/[^/]+\/$/, '');
        return nameTaken(parent, name, current) ? '이미 있는 항목입니다' : '';
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
    bar.appendChild(add.opener);
    bar.appendChild(rename.opener);
    bar.appendChild(remove);
    head.appendChild(add.form);
    head.appendChild(rename.form);
  }
  // 새 Section 만들기: sections/ 에 이름·설명·순서를 적은 파일을 만든다
  if (canWrite) {
    var sideLinksForForm = nav.querySelector('.side-links');
    var secForm = itemForm('new-section', {
      open: '새 Section 만들기', field: '새 Section 이름', go: 'GitHub 에서 만들기', note: COMMIT_NOTE,
      problem: function (name) { return nameTaken('_writing/', name, null) ? '이미 있는 항목입니다' : ''; },
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
      nav.appendChild(secForm.form);
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
  function notice(message, goLabel, makeUrl, noteText) {
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
    close.addEventListener('click', function () { noticeBar.hidden = true; });
    if (goLabel) {
      var go = ownerLink(goLabel);
      go.className = 'go';
      go.href = makeUrl();
      go.addEventListener('click', function () { go.href = makeUrl(); });
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
  // 글 쓰기 쪽(assets/js/write.js)이 쓰는 것들
  window.siteOwner = {
    owner: owner, canWrite: !!canWrite, links: links, itemLabel: itemLabel, newFileUrl: newFileUrl, showDraftCount: showDraftCount
  };

  if (owner && !forced) {
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
      if (realOwner || !e.clipboardData || !sel.rangeCount) return;
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
      var edit = ownerLink('이 글 고치기');
      edit.href = repo + '/edit/' + enc(branch) + '/' + enc(path);
      bar.insertBefore(edit, bar.firstChild);
      addMoveForm(bar, postHead, path);
      var del = ownerLink('이 글 지우기');
      del.href = deleteUrl(path);
      bar.appendChild(del);
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
    dragHint.textContent = '글을 왼쪽의 항목으로 끌어다 놓으면 그 항목으로 옮길 수 있습니다.';
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
    if (desc) desc.hidden = sid !== '';
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
