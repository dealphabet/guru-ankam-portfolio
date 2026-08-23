/* PortfolioOS — window manager */
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
  var instances = {}; // appId -> { el, btn, minimized }
  var bootedAt = Date.now();
  var isMobile = function () { return window.matchMedia('(max-width: 767px)').matches; };

  /* ---------- settings ---------- */
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

  /* ---------- toast ---------- */
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

  /* ---------- wallpaper ---------- */
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

  /* ---------- taskbar clock & uptime ---------- */
  function tickClock() {
    if (!clockEl) return;
    var d = new Date();
    var t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    var day = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    clockEl.querySelector('.os-tb-time').textContent = t;
    clockEl.querySelector('.os-tb-date').textContent = day;
  }
  setInterval(tickClock, 15000);
  tickClock();

  setInterval(function () {
    if (!uptimeEl) return;
    var s = Math.floor((Date.now() - bootedAt) / 1000);
    var m = Math.floor(s / 60);
    uptimeEl.textContent = m > 0 ? 'uptime ' + m + 'm ' + (s % 60) + 's' : 'uptime ' + s + 's';
  }, 1000);

  /* ---------- theme ---------- */
  function syncThemeBtn() {
    if (!themeBtn) return;
    themeBtn.textContent = html.classList.contains('dark') ? '☾' : '☀';
  }
  function toggleTheme() {
    var dark = html.classList.contains('dark');
    html.classList.toggle('dark', !dark);
    localStorage.setItem('theme', !dark ? 'dark' : 'light');
    syncThemeBtn();
    toast(!dark ? '$ theme set --night-session' : '$ theme set --daylight-studio');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
    syncThemeBtn();
  }

  /* ---------- window manager core ---------- */
  function focusWin(inst) {
    Object.keys(instances).forEach(function (id) {
      instances[id].el.classList.toggle('active', instances[id] === inst);
    });
    inst.el.style.zIndex = ++zTop;
    Object.values(instances).forEach(function (o) {
      o.btn.classList.toggle('pressed', o === inst && !o.minimized);
    });
  }

  function placeWin(el) {
    var pos = el.dataset.pos || 'cascade';
    var w = el.offsetWidth || 560;
    var h = el.offsetHeight || 420;
    var bw = layer.clientWidth;
    var bh = layer.clientHeight;
    var x, y;
    if (pos === 'center') {
      x = Math.max(8, (bw - w) / 2);
      y = Math.max(8, (bh - h) / 2 - 14);
    } else {
      x = 90 + (cascade % 6) * 34;
      y = 40 + (cascade % 6) * 28;
      cascade++;
    }
    x = Math.min(x, Math.max(8, bw - w - 8));
    y = Math.min(y, Math.max(8, bh - h - 8));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function closeWin(appId) {
    var inst = instances[appId];
    if (!inst) return;
    inst.el.remove();
    inst.btn.remove();
    delete instances[appId];
    var rest = Object.values(instances).filter(function (o) { return !o.minimized; });
    if (rest.length) focusWin(rest[rest.length - 1]);
  }

  function minimizeWin(inst) {
    inst.minimized = true;
    inst.el.classList.remove('opened');
    inst.el.classList.add('minimized-win');
    inst.btn.classList.remove('pressed');
  }

  function restoreWin(inst) {
    inst.minimized = false;
    inst.el.classList.add('opened');
    inst.el.classList.remove('minimized-win');
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
    if (closeB) closeB.addEventListener('click', function (e) { e.stopPropagation(); closeWin(inst.appId); });
    if (minB) minB.addEventListener('click', function (e) { e.stopPropagation(); minimizeWin(inst); });
    if (maxB) maxB.addEventListener('click', function (e) { e.stopPropagation(); toggleMax(inst); });
    if (tbB) tbB.addEventListener('dblclick', function (e) {
      if (e.target.closest('.os-btn')) return;
      toggleMax(inst);
    });

    /* drag */
    var drag = null;
    if (tbB) tbB.addEventListener('pointerdown', function (e) {
      if (isMobile() || e.target.closest('.os-btn')) return;
      if (el.classList.contains('maximized')) return;
      drag = { sx: e.clientX, sy: e.clientY, ox: el.offsetLeft, oy: el.offsetTop };
      el.classList.add('dragging');
      tbB.setPointerCapture(e.pointerId);
    });
    if (tbB) tbB.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var nx = drag.ox + (e.clientX - drag.sx);
      var ny = drag.oy + (e.clientY - drag.sy);
      nx = Math.max(-el.offsetWidth + 80, Math.min(nx, layer.clientWidth - 80));
      ny = Math.max(0, Math.min(ny, layer.clientHeight - 30));
      el.style.left = nx + 'px';
      el.style.top = ny + 'px';
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      if (tbB) tbB.addEventListener(ev, function () {
        drag = null;
        el.classList.remove('dragging');
      });
    });

    /* resize */
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

  function bindAppContent(appId, el) {
    if (appId === 'settings') bindSettings(el);
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
    var inst = { appId: appId, el: el, minimized: false, btn: null };
    instances[appId] = inst;

    var btn = document.createElement('button');
    btn.className = 'os-tb-app pressed';
    var glyph = el.querySelector('.os-title-icon');
    var label = el.dataset.tbLabel || (el.querySelector('.os-title-text') || {}).textContent || appId;
    btn.innerHTML = (glyph ? '<span>' + glyph.textContent + '</span>' : '') +
      '<span class="os-tb-app-label">' + label.replace(/\s—.*$/, '') + '</span>';
    btn.addEventListener('click', function () {
      if (inst.minimized) restoreWin(inst);
      else if (inst.el.classList.contains('active')) minimizeWin(inst);
      else focusWin(inst);
    });
    tbApps.appendChild(btn);
    inst.btn = btn;

    placeWin(el);
    wireControls(el, inst);
    bindAppContent(appId, el);
    focusWin(inst);
    return inst;
  }

  /* ---------- start menu ---------- */
  function setMenu(open) {
    if (!startMenu) return;
    startMenu.classList.toggle('open', open);
    if (startBtn) startBtn.setAttribute('aria-expanded', String(open));
    startBtn && startBtn.classList.toggle('pressed', open);
  }
  if (startBtn) {
    startBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!startMenu.classList.contains('open'));
    });
  }
  document.addEventListener('pointerdown', function (e) {
    if (startMenu && startMenu.classList.contains('open') &&
        !startMenu.contains(e.target) && !startBtn.contains(e.target)) setMenu(false);
  });

  /* ---------- launch delegation (icons + menu) ---------- */
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

  /* ---------- keyboard shortcuts ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (e.key === 'Escape') { setMenu(false); return; }
    var k = e.key.toLowerCase();
    var navMap = { p: '/photography', m: '/music', c: '/code', o: '/creative' };
    if (k === 't') { toggleTheme(); }
    else if (k === 's') { setMenu(false); openApp('settings'); }
    else if (k === 'a') { setMenu(false); openApp('about'); }
    else if (navMap[k]) { window.location.href = navMap[k]; }
  });

  /* ---------- settings app bindings ---------- */
  function readImageFile(file, cb) {
    if (!file || !file.type.startsWith('image/')) { toast('✗ not an image file'); return; }
    if (file.size > 3 * 1024 * 1024) { toast('✗ image too large (max ~3MB for saving)'); }
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
      b.addEventListener('click', function () {
        setChrome(b.dataset.setChrome);
        toast('$ chrome --skin ' + b.dataset.setChrome + ' ✓');
      });
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
    if (sysTheme) {
      sysTheme.textContent = html.classList.contains('dark') ? 'night session' : 'daylight studio';
    }
    syncSettingsUI();
  }

  /* ---------- boot ---------- */
  applyWallpaperFromSettings();
  var welcomed = false;
  try { welcomed = !!localStorage.getItem('os-welcomed'); } catch (e) {}
  if (!welcomed) {
    setTimeout(function () {
      var inst = openApp('welcome');
      if (inst) {
        try { localStorage.setItem('os-welcomed', '1'); } catch (e) {}
      }
    }, 250);
  }

  window.OS = { open: openApp, close: closeWin };
})();
