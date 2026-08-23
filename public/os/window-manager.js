/* PortfolioOS — window manager + bundled apps */
(function () {
  'use strict';

  var html = document.documentElement;
  var layer = document.getElementById('os-windows');
  var tplRoot = document.getElementById('os-templates');
  var tbApps = document.getElementById('os-tb-apps');
  var startBtn = document.getElementById('os-start-btn');
  var startMenu = document.getElementById('os-startmenu');
  var themeBtn = document.getElementById('os-theme-btn');
  var clockEl = document.getElementById('os-clock');
  var uptimeEl = document.getElementById('os-uptime');
  if (!layer || !tplRoot) return;

  var zTop = 20;
  var cascade = 0;
  var instances = {};
  var bootedAt = Date.now();
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isMobile() { return window.matchMedia('(max-width: 767px)').matches; }

  /* ================= settings ================= */
  var SETTINGS_KEY = 'portfolio-os';
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveSettings(patch) {
    var s = loadSettings();
    Object.assign(s, patch);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  /* ================= toast ================= */
  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.os-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'os-toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 2200);
  }

  /* ================= wallpaper ================= */
  function applyCustomWallpaper(dataUrl) {
    var wp = document.getElementById('os-wallpaper');
    if (!wp) return;
    if (dataUrl) {
      wp.style.setProperty('--os-custom-wallpaper', 'url("' + dataUrl + '")');
      wp.classList.add('has-custom-image');
    } else {
      wp.classList.remove('has-custom-image');
    }
  }
  function appliedWallpaperId() { return html.dataset.wallpaper || 'aurora'; }
  function setWallpaper(id) {
    saveSettings({ wallpaper: id, customWallpaper: null });
    html.dataset.wallpaper = id;
    applyCustomWallpaper(null);
    document.querySelectorAll('[data-set-wall]').forEach(function (b) {
      b.classList.toggle('selected', !b.closest('.wp-picker') && b.dataset.setWall === id);
    });
  }
  function setChrome(id) {
    saveSettings({ chrome: id });
    html.dataset.chrome = id;
    toast('$ chrome --skin ' + id + ' ✓');
  }

  /* ================= clock & uptime ================= */
  function tickClock() {
    if (!clockEl) return;
    var d = new Date();
    clockEl.querySelector('.os-tb-time').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    clockEl.querySelector('.os-tb-date').textContent = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  setInterval(tickClock, 15000);
  tickClock();

  setInterval(function () {
    if (!uptimeEl) return;
    var s = Math.floor((Date.now() - bootedAt) / 1000);
    var m = Math.floor(s / 60);
    uptimeEl.textContent = m > 0 ? 'uptime ' + m + 'm ' + (s % 60) + 's' : 'uptime ' + s + 's';
  }, 1000);

  /* ================= theme ================= */
  function syncThemeBtn() {
    if (!themeBtn) return;
    themeBtn.textContent = html.classList.contains('dark') ? '☾' : '☀';
  }
  function toggleTheme() {
    var dark = html.classList.contains('dark');
    html.classList.toggle('dark', !dark);
    localStorage.setItem('theme', !dark ? 'dark' : 'light');
    syncThemeBtn();
    document.querySelectorAll('#os-sys-theme').forEach(function (el) {
      el.textContent = !dark ? 'night session' : 'daylight studio';
    });
    toast(!dark ? '$ theme set --night-session' : '$ theme set --daylight-studio');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
    syncThemeBtn();
  }

  /* ================= window manager core ================= */
  function focusWin(inst) {
    Object.keys(instances).forEach(function (id) {
      instances[id].el.classList.toggle('active', instances[id] === inst);
    });
    inst.el.style.zIndex = ++zTop;
    Object.values(instances).forEach(function (o) {
      o.btn.classList.toggle('pressed', o === inst && !o.minimized);
    });
  }

  function placeWin(el, inst) {
    var pos = el.dataset.pos || 'cascade';
    var w = el.offsetWidth || 560;
    var h = el.offsetHeight || 420;
    var bw = layer.clientWidth;
    var bh = layer.clientHeight;
    var x, y;
    if (isMobile()) { x = 0; y = 0; }
    else if (pos === 'center') {
      x = Math.max(8, (bw - w) / 2);
      y = Math.max(8, (bh - h) / 2 - 14);
    } else {
      x = 90 + ((inst._n = (inst._n || ++cascade)) - 1) % 6 * 34;
      y = 40 + ((inst._n - 1) % 6) * 28;
    }
    x = Math.min(x, Math.max(8, bw - w - 8));
    y = Math.min(y, Math.max(8, bh - h - 8));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function closeWin(key) {
    var inst = instances[key];
    if (!inst) return;
    delete instances[key];
    inst.btn.remove();
    if (reduceMotion) { inst.el.remove(); return; }
    inst.el.classList.add('closing');
    setTimeout(function () { inst.el.remove(); }, 150);
  }

  function minimizeWin(inst) {
    inst.minimized = true;
    inst.btn.classList.remove('pressed');
    if (reduceMotion) {
      inst.el.classList.remove('opened');
      return;
    }
    inst.el.classList.add('minimizing');
    setTimeout(function () {
      inst.el.classList.remove('opened', 'minimizing');
      inst.el.classList.add('minimized-win');
    }, 170);
  }

  function restoreWin(inst) {
    inst.minimized = false;
    inst.el.classList.remove('minimized-win', 'minimizing');
    inst.el.classList.add('opened');
    focusWin(inst);
  }

  function revealInst(inst) {
    if (inst.minimized) restoreWin(inst);
    else focusWin(inst);
  }

  function toggleMax(inst) {
    var el = inst.el;
    if (el.classList.contains('maximized')) {
      el.classList.remove('maximized');
      el.style.left = el.dataset.prevX || '60px';
      el.style.top = el.dataset.prevY || '40px';
      el.style.width = el.dataset.prevW || '';
      el.style.height = el.dataset.prevH || '';
    } else {
      el.dataset.prevX = el.style.left;
      el.dataset.prevY = el.style.top;
      el.dataset.prevW = el.style.width;
      el.dataset.prevH = el.style.height;
      el.classList.add('maximized');
    }
  }

  function wireControls(el, inst) {
    el.addEventListener('pointerdown', function () { focusWin(inst); }, true);
    var q = function (s2) { return el.querySelector(s2); };
    var minB = q('.os-min'), maxB = q('.os-max'), closeB = q('.os-close'), tbB = q('.os-titlebar');
    if (closeB) closeB.addEventListener('click', function (e) { e.stopPropagation(); closeWin(inst.key); });
    if (minB) minB.addEventListener('click', function (e) { e.stopPropagation(); minimizeWin(inst); });
    if (maxB) maxB.addEventListener('click', function (e) { e.stopPropagation(); toggleMax(inst); });
    if (tbB) tbB.addEventListener('dblclick', function (e) {
      if (e.target.closest('.os-btn')) return;
      toggleMax(inst);
    });

    var drag = null;
    if (tbB) {
      tbB.addEventListener('pointerdown', function (e) {
        if (isMobile() || e.target.closest('.os-btn')) return;
        if (el.classList.contains('maximized')) return;
        drag = { sx: e.clientX, sy: e.clientY, ox: el.offsetLeft, oy: el.offsetTop };
        el.classList.add('dragging');
        tbB.setPointerCapture(e.pointerId);
      });
      tbB.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var nx = drag.ox + (e.clientX - drag.sx);
        var ny = drag.oy + (e.clientY - drag.sy);
        nx = Math.max(-el.offsetWidth + 80, Math.min(nx, layer.clientWidth - 80));
        ny = Math.max(0, Math.min(ny, layer.clientHeight - 30));
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
      });
      ['pointerup', 'pointercancel'].forEach(function (ev) {
        tbB.addEventListener(ev, function () {
          drag = null;
          el.classList.remove('dragging');
        });
      });
    }

    var rz = q('.os-resize');
    if (rz) {
      var rsize = null;
      rz.addEventListener('pointerdown', function (e) {
        if (isMobile() || el.classList.contains('maximized')) return;
        rsize = { sx: e.clientX, sy: e.clientY, ow: el.offsetWidth, oh: el.offsetHeight };
        rz.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      rz.addEventListener('pointermove', function (e) {
        if (!rsize) return;
        el.style.width = Math.max(300, rsize.ow + (e.clientX - rsize.sx)) + 'px';
        el.style.height = Math.max(200, rsize.oh + (e.clientY - rsize.sy)) + 'px';
      });
      ['pointerup', 'pointercancel'].forEach(function (ev) {
        rz.addEventListener(ev, function () { rsize = null; });
      });
    }
  }

  function getAppJSON(el) {
    var s = el.querySelector('script.os-json');
    try { return JSON.parse(s.textContent || '[]'); } catch (e) { return []; }
  }

  function makeTaskButton(inst, glyph, label) {
    var btn = document.createElement('button');
    btn.className = 'os-tb-app pressed';
    btn.innerHTML = (glyph ? '<span>' + glyph + '</span>' : '') +
      '<span class="os-tb-app-label">' + escHtml(label) + '</span>';
    btn.addEventListener('click', function () {
      if (inst.minimized) restoreWin(inst);
      else if (inst.el.classList.contains('active')) minimizeWin(inst);
      else focusWin(inst);
    });
    tbApps.appendChild(btn);
    inst.btn = btn;
  }

  /* spawn a window instance — multi-instance capable via unique key */
  function spawnInstance(tplId, key, labelOverride) {
    var tpl = tplRoot.querySelector('template[data-app="' + tplId + '"]');
    if (!tpl) { toast('app "' + tplId + '" not found'); return null; }
    var el = tpl.content.firstElementChild.cloneNode(true);
    el.classList.add('opened');
    layer.appendChild(el);
    var inst = { appId: tplId, key: key, el: el, minimized: false };
    instances[key] = inst;

    var glyphEl = el.querySelector('.os-title-icon');
    var label = labelOverride || el.dataset.tbLabel || tplId;
    makeTaskButton(inst, glyphEl ? glyphEl.textContent : '', label);

    placeWin(el, inst);
    wireControls(el, inst);
    focusWin(inst);
    return inst;
  }

  function openApp(appId) {
    if (instances[appId]) { revealInst(instances[appId]); return instances[appId]; }
    var inst = spawnInstance(appId, appId);
    if (!inst) return null;
    if (appId === 'settings') bindSettings(inst.el);
    else if (appId === 'photos') bindPhotos(inst);
    else if (appId === 'viewer') bindViewer(inst);
    else if (appId === 'player') bindPlayer(inst);
    else if (appId === 'code' || appId === 'studio') bindCards(inst);
    return inst;
  }

  /* detail windows: one per project/work, multi-instance */
  function openDetail(kind, idx) {
    var key = kind + ':' + idx;
    if (instances[key]) { revealInst(instances[key]); return; }
    var inst = spawnInstance(kind, key);
    if (!inst) return;
    var data = getAppJSON(inst.el);
    var item = data[idx];
    if (!item) { closeWin(key); return; }
    var shortTitle = (item.title || kind).slice(0, 26);
    inst.btn.querySelector('.os-tb-app-label').textContent = shortTitle;
    inst.el.querySelector('.os-title-text').textContent = item.title || kind;
    if (kind === 'project') renderCodeDetail(inst.el, item);
    else renderStudioDetail(inst.el, item);
  }

  /* ================= start menu ================= */
  function setMenu(open) {
    if (!startMenu) return;
    startMenu.classList.toggle('open', open);
    if (startBtn) {
      startBtn.setAttribute('aria-expanded', String(open));
      startBtn.classList.toggle('pressed', open);
    }
  }
  if (startBtn) {
    startBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!startMenu.classList.contains('open'));
    });
  }
  document.addEventListener('pointerdown', function (e) {
    if (startMenu && startMenu.classList.contains('open') &&
        !startMenu.contains(e.target) && !(startBtn && startBtn.contains(e.target))) setMenu(false);
  });

  /* launch delegation */
  document.addEventListener('click', function (e) {
    var launcher = e.target.closest('[data-launch]');
    if (launcher) {
      setMenu(false);
      openApp(launcher.dataset.launch);
      return;
    }
    var nav = e.target.closest('[data-nav]');
    if (nav) {
      setMenu(false);
      window.location.href = nav.dataset.nav;
    }
  });

  /* ================= shortcuts ================= */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (e.key === 'Escape') { setMenu(false); return; }
    var k = e.key.toLowerCase();
    var launchMap = { p: 'photos', m: 'player', c: 'code', o: 'studio', a: 'about', w: 'welcome', s: 'settings' };
    if (k === 't') toggleTheme();
    else if (launchMap[k]) { setMenu(false); openApp(launchMap[k]); }
  });

  /* ============================================================
     SETTINGS — display properties (XP-style wallpaper picker)
     ============================================================ */
  function readImageFile(file, cb) {
    if (!file || !file.type.startsWith('image/')) { toast('✗ not an image file'); return; }
    if (file.size > 3 * 1024 * 1024) toast('⚠ large image — may not persist after reload');
    var fr = new FileReader();
    fr.onload = function () { cb(fr.result); };
    fr.readAsDataURL(file);
  }

  function bindSettings(root) {
    var crt = root.querySelector('.wp-crt-screen');
    var applyBtn = root.querySelector('.wp-apply');
    var resetBtn = root.querySelector('.wp-reset');
    var items = Array.prototype.slice.call(root.querySelectorAll('.wp-item'));
    var customArea = root.querySelector('.wp-custom');
    var urlInput = root.querySelector('.os-url-input');
    var urlApply = root.querySelector('.os-url-apply');
    var dropZone = root.querySelector('.os-drop-zone');
    var fileInput = root.querySelector('.os-file-input');
    var pendingCustom = null;

    function appliedState() {
      var s = loadSettings();
      return s.customWallpaper ? { type: 'custom' } : { type: 'preset', id: s.wallpaper || 'aurora' };
    }
    var pending = null;

    function paintCrt(st) {
      if (!crt) return;
      if (st.type === 'custom' && st.previewUrl) crt.style.backgroundImage = 'url("' + st.previewUrl + '")';
      else if (st.type === 'custom') crt.style.backgroundImage = '';
      else crt.style.backgroundImage = '';
      crt.className = 'wp-crt-screen ' + (st.type === 'custom' ? 'sw-custom-crt' : 'sw-' + st.id);
    }

    function reflect() {
      var applied = appliedState();
      items.forEach(function (it) {
        var isSel;
        if (it.dataset.wall === '__custom') isSel = pending.type === 'custom';
        else isSel = pending.type === 'preset' && pending.id === it.dataset.wall;
        it.classList.toggle('selected', isSel);
      });
      if (customArea) customArea.hidden = !(pending.type === 'custom');
      paintCrt(pending);
      var changed = pending.type !== applied.type ||
        (pending.type === 'preset' && pending.id !== applied.id) ||
        (pending.type === 'custom' && !!pending.newData);
      if (applyBtn) applyBtn.disabled = !changed;
    }

    items.forEach(function (it) {
      it.addEventListener('click', function () {
        if (it.dataset.wall === '__custom') {
          pending = { type: 'custom', newData: null };
          var s = loadSettings();
          if (s.customWallpaper) { urlInput.value = ''; }
        } else {
          pending = { type: 'preset', id: it.dataset.wall };
        }
        reflect();
      });
    });

    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        if (pending.type === 'preset') {
          setWallpaper(pending.id);
          toast('$ wallpaper --set ' + pending.id + ' ✓');
        } else {
          if (pending.newData) {
            applyCustomWallpaper(pending.newData);
            saveSettings({ customWallpaper: pending.newData, wallpaper: pending.id || appliedState().id });
            toast('$ wallpaper --set custom ✓');
          } else {
            var s = loadSettings();
            if (s.customWallpaper) toast('custom wallpaper already applied');
            else toast('✗ pick an image or paste a URL first');
          }
        }
        pending = appliedState();
        if (pending.type === 'custom') pending = { type: 'custom', newData: null };
        reflect();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        saveSettings({ wallpaper: 'aurora', customWallpaper: null });
        html.dataset.wallpaper = 'aurora';
        applyCustomWallpaper(null);
        pending = { type: 'preset', id: 'aurora' };
        reflect();
        toast('$ wallpaper --reset ✓');
      });
    }

    function commitCustom(dataUrl) {
      pending = { type: 'custom', newData: dataUrl };
      if (crt && dataUrl) { crt.className = 'wp-crt-screen sw-custom-crt'; crt.style.backgroundImage = 'url("' + dataUrl + '")'; }
      reflect();
    }

    if (urlApply && urlInput) {
      urlApply.addEventListener('click', function () {
        var v = urlInput.value.trim();
        if (!v) { toast('✗ paste an image URL first'); return; }
        commitCustom(v);
      });
    }
    if (dropZone) {
      dropZone.addEventListener('click', function () { fileInput && fileInput.click(); });
      dropZone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput && fileInput.click(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); });
      });
      dropZone.addEventListener('drop', function (e) {
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) readImageFile(f, commitCustom);
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files[0]) readImageFile(fileInput.files[0], commitCustom);
        fileInput.value = '';
      });
    }

    var sysTheme = root.querySelector('#os-sys-theme');
    if (sysTheme) sysTheme.textContent = html.classList.contains('dark') ? 'night session' : 'daylight studio';

    var ap = appliedState();
    pending = ap.type === 'custom' ? { type: 'custom', newData: null } : { type: 'preset', id: ap.id };
    reflect();
  }

  /* ============================================================
     PHOTOS — Filmstrip browser
     ============================================================ */
  function pictureHTML(p, eager) {
    var lazy = eager ? '' : ' loading="lazy" decoding="async"';
    if (p.fileAvif || p.fileWebp || p.fileJpeg) {
      var h = '<picture>';
      if (p.fileAvif) h += '<source srcset="' + p.fileAvif + '" type="image/avif" />';
      if (p.fileWebp) h += '<source srcset="' + p.fileWebp + '" type="image/webp" />';
      h += '<img src="' + (p.fileJpeg || p.fileWebp || p.fileAvif || p.file || '') + '" alt="' + escHtml(p.alt || '') + '"' + lazy + ' /></picture>';
      return h;
    }
    if (p.file) return '<img src="' + p.file + '" alt="' + escHtml(p.alt || '') + '"' + lazy + ' />';
    return '<div class="ex-thumb-ph">🖼</div>';
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function bindPhotos(inst) {
    var el = inst.el;
    var collections = getAppJSON(el);
    var strip = el.querySelector('.ph-strip');
    var stageImg = el.querySelector('.ph-stage-img');
    var capAlt = el.querySelector('.ph-cap-alt');
    var capMeta = el.querySelector('.ph-cap-meta');
    var tabs = el.querySelectorAll('.ph-tab');
    var list = [];
    var idx = 0;
    var wheelLock = 0;

    function flatAll() {
      var out = [];
      collections.forEach(function (c) {
        (c.photos || []).forEach(function (p) { out.push(Object.assign({}, p, { _col: c.title, _colId: c.id })); });
      });
      return out;
    }

    function setIdx(i, opts) {
      if (!list.length) return;
      idx = ((i % list.length) + list.length) % list.length;
      var p = list[idx];
      stageImg.innerHTML = pictureHTML(p, true) || '';
      if (capAlt) capAlt.textContent = p.alt || '';
      if (capMeta) capMeta.textContent = [p.category, p._col].filter(Boolean).join(' · ');
      var thumbs = strip.children;
      for (var t = 0; t < thumbs.length; t++) thumbs[t].classList.toggle('active', t === idx);
      var act = thumbs[idx];
      if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      if (!(opts && opts.silentToast)) {
        /* no toast spam while scrubbing */
      }
    }

    /* progressive strip rendering — keeps the app snappy with 160+ photos */
    function renderStrip(colId) {
      if (colId === '__all') list = flatAll();
      else {
        var col = collections.find(function (c) { return c.id === colId; }) || { photos: [] };
        list = (col.photos || []).slice();
      }
      strip.innerHTML = '';
      var i = 0;
      (function chunk() {
        var end = Math.min(i + 24, list.length);
        for (; i < end; i++) {
          (function (n) {
            var p = list[n];
            var b = document.createElement('button');
            b.className = 'ph-thumb';
            b.type = 'button';
            b.innerHTML = pictureHTML(p);
            b.addEventListener('mouseenter', function () { setIdx(n); });
            b.addEventListener('focus', function () { setIdx(n); });
            b.addEventListener('click', function () { OS.openViewer(list[n], list, n); });
            strip.appendChild(b);
          })(i);
        }
        if (i < list.length) requestAnimationFrame(chunk);
        else setIdx(idx, {});
      })();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t2) { t2.classList.remove('active'); });
        tab.classList.add('active');
        idx = 0;
        renderStrip(tab.dataset.col);
      });
    });

    var prevB = el.querySelector('.ph-prev'), nextB = el.querySelector('.ph-next');
    if (prevB) prevB.addEventListener('click', function () { setIdx(idx - 1); });
    if (nextB) nextB.addEventListener('click', function () { setIdx(idx + 1); });

    /* vertical wheel scrolls the strip horizontally */
    if (strip) {
      strip.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          strip.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }
    /* wheel over the big preview scrubs through photos */
    var stage = el.querySelector('.ph-stage');
    if (stage) {
      stage.addEventListener('wheel', function (e) {
        e.preventDefault();
        var now = Date.now();
        if (now - wheelLock < 180) return;
        wheelLock = now;
        setIdx(idx + (e.deltaY > 0 ? 1 : -1));
      }, { passive: false });
    }

    renderStrip('__all');
  }

  /* ============================================================
     PHOTO VIEWER — zoom/pan, tag links, scored related photos
     ============================================================ */
  function bindViewer(inst) {
    var el = inst.el;
    inst._list = [];
    inst._idx = -1;
    inst._ctx = '';
    inst._all = getAppJSON(el);

    var wrap = el.querySelector('.pv-imgwrap');
    var imgBox = el.querySelector('.pv-img');
    var zOut = el.querySelector('[data-zoom="out"]');
    var zIn = el.querySelector('[data-zoom="in"]');
    var zFit = el.querySelector('[data-zoom="fit"]');
    var zAct = el.querySelector('[data-zoom="actual"]');
    var zPct = el.querySelector('.pv-zpct');
    var vz = { scale: 1, tx: 0, ty: 0 };

    function applyZoom() {
      var img = imgBox.querySelector('img');
      if (img) img.style.transform = 'translate(' + vz.tx + 'px,' + vz.ty + 'px) scale(' + vz.scale + ')';
      if (zPct) zPct.textContent = Math.round(vz.scale * 100) + '%';
    }
    function resetZoom() { vz = { scale: 1, tx: 0, ty: 0 }; applyZoom(); }

    function zoomBy(f) {
      var ns = Math.max(0.25, Math.min(5, vz.scale * f));
      vz.tx *= vz.scale ? ns / vz.scale : 1;
      vz.ty *= vz.scale ? ns / vz.scale : 1;
      vz.scale = ns;
      applyZoom();
    }
    if (zIn) zIn.addEventListener('click', function () { zoomBy(1.3); });
    if (zOut) zOut.addEventListener('click', function () { zoomBy(1 / 1.3); });
    if (zFit) zFit.addEventListener('click', resetZoom);
    if (zAct) zAct.addEventListener('click', function () {
      var img = imgBox.querySelector('img');
      if (!img || !img.naturalWidth || !img.offsetWidth) return;
      vz = { scale: Math.max(0.25, Math.min(5, img.naturalWidth / img.offsetWidth)), tx: 0, ty: 0 };
      applyZoom();
    });

    if (wrap) {
      wrap.addEventListener('wheel', function (e) {
        if (!e.target.closest('.pv-nav') && !e.target.closest('.pv-zoombar')) {
          e.preventDefault();
          zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
        }
      }, { passive: false });

      var pan = null;
      wrap.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.pv-nav') || e.target.closest('.pv-zoombar')) return;
        pan = { sx: e.clientX, sy: e.clientY, tx: vz.tx, ty: vz.ty };
        wrap.classList.add('panning');
        wrap.setPointerCapture(e.pointerId);
      });
      wrap.addEventListener('pointermove', function (e) {
        if (!pan) return;
        vz.tx = pan.tx + (e.clientX - pan.sx);
        vz.ty = pan.ty + (e.clientY - pan.sy);
        applyZoom();
      });
      ['pointerup', 'pointercancel'].forEach(function (ev) {
        wrap.addEventListener(ev, function () { pan = null; wrap.classList.remove('panning'); });
      });
      wrap.addEventListener('dblclick', function (e) {
        if (e.target.closest('.pv-nav') || e.target.closest('.pv-zoombar')) return;
        if (vz.scale > 1.05) resetZoom();
        else { vz.scale = Math.max(0.25, Math.min(5, 2.5)); applyZoom(); }
      });
    }

    el.querySelector('.pv-prev').addEventListener('click', function () {
      if (inst._list.length) { inst._idx = (inst._idx - 1 + inst._list.length) % inst._list.length; showViewerPhoto(inst); }
    });
    el.querySelector('.pv-next').addEventListener('click', function () {
      if (inst._list.length) { inst._idx = (inst._idx + 1) % inst._list.length; showViewerPhoto(inst); }
    });
  }

  function relatedScore(p, q) {
    var score = 0;
    var pt = p.tags || [], qt = q.tags || [];
    qt.forEach(function (t) { if (pt.indexOf(t) >= 0) score += 2; });
    if (q.category && q.category === p.category) score += 2;
    if (q._collection && q._collection === p._collection) score += 1;
    return score;
  }

  function showViewerPhoto(inst) {
    var el = inst.el;
    var p = inst._list[inst._idx];
    if (!p) return;
    el.querySelector('.pv-title').textContent = p.alt || '';
    var ctxLine = inst._ctx ? '#' + inst._ctx + ' · ' : '';
    el.querySelector('.pv-cat').textContent = ctxLine + [p.category, p._collection].filter(Boolean).join(' · ');
    el.querySelector('.pv-camera').textContent = p.camera ? 'CAMERA  ' + p.camera : '';
    el.querySelector('.pv-lens').textContent = p.lens ? 'LENS    ' + p.lens : '';
    var exifParts = [];
    if (p.focalLength) exifParts.push(p.focalLength);
    if (p.aperture) exifParts.push('f/' + p.aperture);
    if (p.exposure) exifParts.push(p.exposure + 's');
    if (p.iso) exifParts.push('ISO ' + p.iso);
    el.querySelector('.pv-exifline').textContent = exifParts.length ? 'EXIF    ' + exifParts.join(' · ') : '';
    el.querySelector('.pv-loc').textContent = p.location ? 'LOC     ' + p.location : '';

    var imgWrap = el.querySelector('.pv-img');
    imgWrap.innerHTML = pictureHTML(p, true) || '<div style="padding:60px;color:var(--text-muted)">no preview</div>';
    var img = imgWrap.querySelector('img');
    if (img) {
      img.style.transform = 'translate(0px,0px) scale(1)';
      img.style.cursor = 'grab';
    }
    var zPct = el.querySelector('.pv-zpct');
    if (zPct) zPct.textContent = '100%';

    /* tags are links — click filters the whole viewer to that tag */
    var tagsEl = el.querySelector('.pv-tags');
    tagsEl.innerHTML = '';
    (p.tags || []).forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'photo-tag';
      b.type = 'button';
      b.textContent = '#' + t;
      b.addEventListener('click', function () { filterToTag(inst, t); });
      tagsEl.appendChild(b);
    });

    /* related: scored across the entire library, best matches first */
    var pool = inst._all.filter(function (q) { return q !== p && q.alt !== p.alt; });
    pool.forEach(function (q) { q._score = relatedScore(p, q); });
    pool.sort(function (a, b) { return b._score - a._score; });
    var similar = pool.filter(function (q) { return q._score >= 2; }).slice(0, 8);

    var simEl = el.querySelector('.pv-similar');
    simEl.innerHTML = '';
    similar.forEach(function (q) {
      var b = document.createElement('button');
      b.className = 'pv-sim-item';
      b.type = 'button';
      b.setAttribute('title', (q.alt || '') + ' — match ' + q._score);
      b.innerHTML = pictureHTML(q);
      b.addEventListener('click', function () {
        var li = inst._list.indexOf(q);
        if (li >= 0) { inst._idx = li; }
        else {
          inst._list = inst._all.slice();
          inst._idx = inst._all.indexOf(q);
          inst._ctx = '';
        }
        showViewerPhoto(inst);
      });
      simEl.appendChild(b);
    });
    if (!similar.length) simEl.innerHTML = '<p class="pv-nothing">no strongly related photos</p>';

    var tt = 'Photo Viewer — ' + (p.alt || '').slice(0, 40);
    el.querySelector('.os-title-text').textContent = tt;
    if (inst.btn) inst.btn.querySelector('.os-tb-app-label').textContent = (p.alt || 'viewer').slice(0, 22);
  }

  function filterToTag(inst, tag) {
    inst._all = getAppJSON(inst.el);
    inst._list = inst._all.filter(function (q) { return (q.tags || []).indexOf(tag) >= 0; });
    inst._idx = 0;
    inst._ctx = tag;
    showViewerPhoto(inst);
    toast('$ view --filter #' + tag + ' (' + inst._list.length + ' matches)');
  }

  /* exposed API for other apps */
  window.OS = {
    open: function (id) { return openApp(id); },
    close: closeWin,
    openDetail: openDetail,
    openViewer: function (photo, list, idx) {
      var inst = openApp('viewer');
      if (!inst) return;
      inst._list = list && list.length ? list : [photo];
      inst._idx = typeof idx === 'number' ? idx : inst._list.indexOf(photo);
      if (inst._idx < 0) inst._idx = 0;
      inst._ctx = '';
      showViewerPhoto(inst);
    },
  };

  /* ============================================================
     MEDIA PLAYER
     ============================================================ */
  function fmtTime(sec) {
    if (isNaN(sec)) return '0:00';
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function bindPlayer(inst) {
    var el = inst.el;
    var clips = getAppJSON(el);
    var audio = el.querySelector('.mp-audio');
    var rows = el.querySelectorAll('.m-row');
    var nowTitle = el.querySelector('.mp-nowtitle');
    var nowTime = el.querySelector('.mp-nowtime');
    var seekFill = el.querySelector('.mp-seekfill');
    var seekBar = el.querySelector('.mp-seek');
    var current = -1;

    function setRowState(i, playing) {
      var row = rows[i];
      if (!row) return;
      row.classList.toggle('playing', playing);
      var pi = row.querySelector('.m-ic-play'), pa = row.querySelector('.m-ic-pause');
      if (pi && pa) { pi.style.display = playing ? 'none' : ''; pa.style.display = playing ? '' : 'none'; }
    }

    function stopAll() {
      audio.pause();
      rows.forEach(function (_, i) { setRowState(i, false); });
      current = -1;
      if (nowTitle) nowTitle.textContent = '— nothing playing';
    }

    function playIndex(i) {
      var clip = clips[i];
      var src = clip && clip.file;
      if (!src) { toast('✗ no audio file for "' + (clip ? clip.title : '?') + '"'); return; }
      if (current === i && !audio.paused) { audio.pause(); setRowState(i, false); current = -1; return; }
      stopAll();
      audio.src = src;
      audio.play().catch(function () {});
      setRowState(i, true);
      current = i;
      if (nowTitle) nowTitle.textContent = '▶ ' + clip.title;
    }

    el.querySelectorAll('.m-play').forEach(function (btn) {
      btn.addEventListener('click', function () { playIndex(parseInt(btn.dataset.index, 10)); });
    });
    rows.forEach(function (row) {
      row.addEventListener('dblclick', function () { playIndex(parseInt(row.dataset.index, 10)); });
    });

    audio.addEventListener('timeupdate', function () {
      if (!audio.duration) return;
      var pct = (audio.currentTime / audio.duration) * 100;
      if (seekFill) seekFill.style.width = pct + '%';
      if (nowTime) nowTime.textContent = fmtTime(audio.currentTime);
    });
    audio.addEventListener('ended', function () {
      if (current >= 0) setRowState(current, false);
      current = -1;
      if (nowTitle) nowTitle.textContent = '— nothing playing';
      if (seekFill) seekFill.style.width = '0%';
      if (nowTime) nowTime.textContent = '0:00';
    });
    if (seekBar) {
      seekBar.addEventListener('click', function (e) {
        if (!audio.duration) return;
        var r = seekBar.getBoundingClientRect();
        audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
      });
    }

    /* tag chips filter */
    el.querySelectorAll('.mp-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        el.querySelectorAll('.mp-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var tag = chip.dataset.tag;
        rows.forEach(function (row) {
          var tags = JSON.parse(row.dataset.tags || '[]');
          row.style.display = !tag || tags.indexOf(tag) >= 0 ? '' : 'none';
        });
      });
    });
  }

  /* ============================================================
     CODE + STUDIO — launchers; cards open dedicated windows
     ============================================================ */
  function bindCards(inst) {
    var el = inst.el;
    var kind = inst.appId === 'code' ? 'project' : 'work';
    el.querySelectorAll('.cd-card, .st-card').forEach(function (card) {
      card.addEventListener('click', function () {
        openDetail(kind, parseInt(card.dataset.index, 10));
      });
    });
    el.querySelectorAll('.mp-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        el.querySelectorAll('.mp-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var tag = chip.dataset.tag;
        el.querySelectorAll('.cd-card, .st-card').forEach(function (row) {
          var tags = JSON.parse(row.dataset.tags || '[]');
          row.style.display = !tag || tags.indexOf(tag) >= 0 ? '' : 'none';
        });
      });
    });
  }

  function renderCodeDetail(el, project) {
    el.querySelector('.cd-d-title').textContent = project.title || '';
    el.querySelector('.cd-d-desc').textContent = project.description || '';
    el.querySelector('.cd-d-long').innerHTML = project.longDescription || '<p>No detailed description yet.</p>';
    el.querySelector('.cd-d-tech').textContent = project.techDetails ? 'tech: ' + project.techDetails : '';
    el.querySelector('.cd-d-tags').innerHTML = (project.tags || []).map(function (t) {
      return '<span class="chip">' + escHtml(t) + '</span>';
    }).join('');
    var banner = el.querySelector('.cd-detail-banner');
    if (project.file) {
      banner.style.background = 'var(--bg-secondary)';
      banner.innerHTML = '<img src="' + project.file + '" alt="' + escHtml(project.title) + '" />';
    } else {
      banner.style.background = project.gradient || 'linear-gradient(135deg, #667eea, #764ba2)';
      banner.innerHTML = '<span class="cd-d-banner-icon">' + (project.icon || '📦') + '</span>';
    }
    var gh = el.querySelector('.cd-d-github'), lv = el.querySelector('.cd-d-live');
    gh.href = project.github || '#';
    lv.href = project.live || '#';
    gh.style.display = project.github && project.github !== '#' ? '' : 'none';
    lv.style.display = project.live && project.live !== '#' ? '' : 'none';
  }

  function renderStudioDetail(el, work) {
    el.querySelector('.cd-d-type').textContent = work.type || '';
    el.querySelector('.cd-d-title').textContent = work.title || '';
    el.querySelector('.cd-d-desc').textContent = work.description || '';
    el.querySelector('.cd-d-long').innerHTML = work.longDescription || '<p>Detailed description coming soon.</p>';
    el.querySelector('.cd-d-tags').innerHTML = (work.tags || []).map(function (t) {
      return '<span class="chip">#' + escHtml(t) + '</span>';
    }).join('');
    var banner = el.querySelector('.cd-detail-banner');
    if (work.file) {
      banner.style.background = 'var(--bg-secondary)';
      banner.innerHTML = '<img src="' + work.file + '" alt="' + escHtml(work.title) + '" />';
    } else {
      banner.style.background = work.gradient || 'linear-gradient(135deg, #a18cd1, #fbc2eb)';
      banner.innerHTML = '<span class="cd-d-banner-icon">' + (work.icon || '🎨') + '</span>';
    }
  }

  /* ================= boot ================= */
  (function bootWallpaper() {
    var s = loadSettings();
    if (s.customWallpaper) applyCustomWallpaper(s.customWallpaper);
    else html.dataset.wallpaper = s.wallpaper || html.dataset.wallpaper || 'aurora';
  })();

  var initialApp = document.body.dataset.initialApp || '';
  if (initialApp) {
    setTimeout(function () { openApp(initialApp); }, 120);
  } else {
    var welcomed = false;
    try { welcomed = !!localStorage.getItem('os-welcomed'); } catch (e) {}
    if (!welcomed) {
      setTimeout(function () {
        var inst = openApp('welcome');
        if (inst) { try { localStorage.setItem('os-welcomed', '1'); } catch (e) {} }
      }, 250);
    }
  }
})();
