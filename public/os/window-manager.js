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
  function syncSettingsUI() {
    var s = loadSettings();
    document.querySelectorAll('[data-set-chrome]').forEach(function (b) {
      b.classList.toggle('selected', b.dataset.setChrome === (s.chrome || 'tui'));
    });
    document.querySelectorAll('[data-set-wall]').forEach(function (b) {
      b.classList.toggle('selected', !s.customWallpaper && b.dataset.setWall === (s.wallpaper || 'aurora'));
    });
  }
  function applyWallpaperFromSettings() {
    var s = loadSettings();
    if (s.customWallpaper) applyCustomWallpaper(s.customWallpaper);
    else applyCustomWallpaper(null);
    syncSettingsUI();
  }
  function setWallpaper(id) {
    saveSettings({ wallpaper: id, customWallpaper: null });
    html.dataset.wallpaper = id;
    applyCustomWallpaper(null);
    syncSettingsUI();
  }
  function setChrome(id) {
    saveSettings({ chrome: id });
    html.dataset.chrome = id;
    syncSettingsUI();
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

  function closeWin(appId) {
    var inst = instances[appId];
    if (!inst) return;
    delete instances[appId];
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

  function openApp(appId) {
    if (instances[appId]) {
      var inst0 = instances[appId];
      if (inst0.minimized) restoreWin(inst0);
      else focusWin(inst0);
      return inst0;
    }
    var tpl = tplRoot.querySelector('template[data-app="' + appId + '"]');
    if (!tpl) { toast('app "' + appId + '" not found'); return null; }
    var el = tpl.content.firstElementChild.cloneNode(true);
    el.classList.add('opened');
    layer.appendChild(el);
    var inst = { appId: appId, key: appId, el: el, minimized: false, btn: null };
    instances[appId] = inst;

    var btn = document.createElement('button');
    btn.className = 'os-tb-app pressed';
    var glyph = el.querySelector('.os-title-icon');
    var label = el.dataset.tbLabel || appId;
    btn.innerHTML = (glyph ? '<span>' + glyph.textContent + '</span>' : '') +
      '<span class="os-tb-app-label">' + label + '</span>';
    btn.addEventListener('click', function () {
      if (inst.minimized) restoreWin(inst);
      else if (inst.el.classList.contains('active')) minimizeWin(inst);
      else focusWin(inst);
    });
    tbApps.appendChild(btn);
    inst.btn = btn;

    placeWin(el, inst);
    wireControls(el, inst);
    if (appId === 'settings') bindSettings(el);
    else if (appId === 'photos') bindPhotos(inst);
    else if (appId === 'viewer') bindViewer(inst);
    else if (appId === 'player') bindPlayer(inst);
    else if (appId === 'code') bindCards(inst, 'cd', renderCodeDetail);
    else if (appId === 'studio') bindCards(inst, 'st', renderStudioDetail);
    focusWin(inst);
    return inst;
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

  /* ================= settings bindings ================= */
  function readImageFile(file, cb) {
    if (!file || !file.type.startsWith('image/')) { toast('✗ not an image file'); return; }
    if (file.size > 3 * 1024 * 1024) toast('⚠ large image — may not persist after reload');
    var fr = new FileReader();
    fr.onload = function () { cb(fr.result); };
    fr.readAsDataURL(file);
  }

  function setCustomWallpaper(dataUrl) {
    applyCustomWallpaper(dataUrl);
    saveSettings({ customWallpaper: dataUrl || null });
    syncSettingsUI();
    toast(dataUrl ? '$ wallpaper --set custom ✓' : '$ wallpaper --reset ✓');
  }

  function bindSettings(root) {
    root.querySelectorAll('[data-set-chrome]').forEach(function (b) {
      b.addEventListener('click', function () { setChrome(b.dataset.setChrome); });
    });
    root.querySelectorAll('[data-set-wall]').forEach(function (b) {
      b.addEventListener('click', function () { setWallpaper(b.dataset.setWall); });
    });
    var urlInput = root.querySelector('.os-url-input');
    var applyBtn = root.querySelector('.os-url-apply');
    if (applyBtn && urlInput) {
      applyBtn.addEventListener('click', function () {
        var v = urlInput.value.trim();
        if (!v) { toast('✗ paste an image URL first'); return; }
        setCustomWallpaper(v);
      });
    }
    var drop = root.querySelector('.os-drop-zone');
    var fileInput = root.querySelector('.os-file-input');
    if (drop) {
      drop.addEventListener('click', function () { fileInput && fileInput.click(); });
      drop.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput && fileInput.click(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('dragover'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('dragover'); });
      });
      drop.addEventListener('drop', function (e) {
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) readImageFile(f, setCustomWallpaper);
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files[0]) readImageFile(fileInput.files[0], setCustomWallpaper);
        fileInput.value = '';
      });
    }
    var resetBtn = root.querySelector('.os-wall-reset');
    if (resetBtn) resetBtn.addEventListener('click', function () { setCustomWallpaper(null); });
    var sysTheme = root.querySelector('#os-sys-theme');
    if (sysTheme) sysTheme.textContent = html.classList.contains('dark') ? 'night session' : 'daylight studio';
    syncSettingsUI();
  }

  /* ============================================================
     PHOTOS — File Explorer
     ============================================================ */
  function pictureHTML(p) {
    if (p.fileAvif || p.fileWebp || p.fileJpeg) {
      var h = '<picture>';
      if (p.fileAvif) h += '<source srcset="' + p.fileAvif + '" type="image/avif" />';
      if (p.fileWebp) h += '<source srcset="' + p.fileWebp + '" type="image/webp" />';
      h += '<img src="' + (p.fileJpeg || p.fileWebp || p.fileAvif || p.file || '') + '" alt="' + (p.alt || '') + '" loading="lazy" /></picture>';
      return h;
    }
    if (p.file) return '<img src="' + p.file + '" alt="' + (p.alt || '') + '" loading="lazy" />';
    return '<div class="ex-thumb-ph">🖼</div>';
  }

  function bindPhotos(inst) {
    var el = inst.el;
    var collections = getAppJSON(el);
    var grid = el.querySelector('.ex-grid');
    var crumbPath = el.querySelector('.ex-crumb-path');
    var countEl = el.querySelector('.ex-count');

    function flatAll() {
      var out = [];
      collections.forEach(function (c) {
        (c.photos || []).forEach(function (p) { out.push(Object.assign({}, p, { _col: c.title })); });
      });
      return out;
    }

    function render(colId) {
      var list, title;
      if (colId === '__all') { list = flatAll(); title = '/all'; }
      else {
        var col = collections.find(function (c) { return c.id === colId; }) || { photos: [], title: colId };
        list = (col.photos || []).slice();
        title = '/' + colId;
      }
      if (crumbPath) crumbPath.textContent = title;
      if (countEl) countEl.textContent = list.length + ' items';
      grid.innerHTML = '';
      list.forEach(function (p, i) {
        var cell = document.createElement('button');
        cell.className = 'ex-thumb';
        cell.type = 'button';
        cell.innerHTML = pictureHTML(p) +
          '<span class="ex-thumb-ov"><span class="ex-thumb-alt">' + (p.alt || '') + '</span>' +
          '<span class="ex-thumb-cat">' + (p.category || '') + '</span></span>';
        cell.addEventListener('click', function () { OS.openViewer(p, list, i); });
        grid.appendChild(cell);
      });
      el.querySelectorAll('.ex-folder').forEach(function (f) {
        f.classList.toggle('active', f.dataset.col === colId);
      });
    }

    el.querySelectorAll('.ex-folder').forEach(function (f) {
      f.addEventListener('click', function () { render(f.dataset.col); });
    });
    render('__all');
  }

  /* ============================================================
     PHOTO VIEWER
     ============================================================ */
  function bindViewer(inst) { inst._list = []; inst._idx = -1; }

  function showViewerPhoto(inst) {
    var el = inst.el;
    var p = inst._list[inst._idx];
    if (!p) return;
    el.querySelector('.pv-title').textContent = p.alt || '';
    el.querySelector('.pv-cat').textContent = p.category || '';
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
    imgWrap.innerHTML = pictureHTML(p) || '<div style="padding:60px;color:var(--text-muted)">no preview</div>';

    var tagsEl = el.querySelector('.pv-tags');
    tagsEl.innerHTML = (p.tags || []).map(function (t) { return '<span class="photo-tag">#' + t + '</span>'; }).join('');

    var pool = inst._list.filter(function (q) { return q !== p; });
    var similar = pool.filter(function (q) {
      var shared = (q.tags || []).filter(function (t) { return (p.tags || []).indexOf(t) >= 0; });
      return q.category === p.category || shared.length > 0;
    }).slice(0, 8);

    var simEl = el.querySelector('.pv-similar');
    simEl.innerHTML = '';
    similar.forEach(function (q) {
      var idx = inst._list.indexOf(q);
      var b = document.createElement('button');
      b.className = 'pv-sim-item';
      b.type = 'button';
      b.innerHTML = pictureHTML(q);
      b.addEventListener('click', function () {
        inst._idx = idx;
        showViewerPhoto(inst);
      });
      simEl.appendChild(b);
    });
    if (!similar.length) simEl.innerHTML = '<p class="pv-nothing">no related photos</p>';

    el.querySelector('.os-title-text').textContent = 'Photo Viewer — ' + (p.alt || '').slice(0, 40);
  }

  /* exposed API for other apps */
  window.OS = {
    open: function (id) { return openApp(id); },
    close: closeWin,
    openViewer: function (photo, list, idx) {
      var inst = openApp('viewer');
      if (!inst) return;
      inst._list = list && list.length ? list : [photo];
      inst._idx = typeof idx === 'number' ? idx : inst._list.indexOf(photo);
      if (inst._idx < 0) inst._idx = 0;
      showViewerPhoto(inst);
    },
  };

  /* viewer nav buttons wired per instance */
  var _origOpenApp = openApp;
  openApp = function (id) {
    var inst = _origOpenApp(id);
    if (inst && id === 'viewer' && !inst._navWired) {
      inst._navWired = true;
      inst.el.querySelector('.pv-prev').addEventListener('click', function () {
        if (inst._list.length) { inst._idx = (inst._idx - 1 + inst._list.length) % inst._list.length; showViewerPhoto(inst); }
      });
      inst.el.querySelector('.pv-next').addEventListener('click', function () {
        if (inst._list.length) { inst._idx = (inst._idx + 1) % inst._list.length; showViewerPhoto(inst); }
      });
    }
    return inst;
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
     CODE + STUDIO shared cards logic
     ============================================================ */
  function bindCards(inst, prefix, renderDetail) {
    var el = inst.el;
    var data = getAppJSON(el);
    var listview = el.querySelector('.cd-listview');
    var detailview = el.querySelector('.cd-detailview');

    el.querySelectorAll(prefix === 'cd' ? '.cd-card' : '.st-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var item = data[parseInt(card.dataset.index, 10)];
        if (item) renderDetail(el, item);
        listview.hidden = true;
        detailview.hidden = false;
        detailview.scrollTop = 0;
        el.querySelector('.os-body').scrollTop = 0;
      });
    });

    var back = el.querySelector('.cd-back');
    if (back) back.addEventListener('click', function () {
      detailview.hidden = true;
      listview.hidden = false;
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

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderCodeDetail(el, project) {
    el.querySelector('.cd-d-title').textContent = project.title || '';
    el.querySelector('.cd-d-desc').textContent = project.description || '';
    el.querySelector('.cd-d-long').innerHTML = project.longDescription || '<p>No detailed description yet.</p>';
    el.querySelector('.cd-d-tech').textContent = project.techDetails || '';
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
  applyWallpaperFromSettings();

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
