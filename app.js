(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- routing: each page is a [data-view] block, picked by the URL hash ---------- */
  const views = [...document.querySelectorAll('[data-view]')];
  const titles = { home: 'Aaron Hervey · Product Designer' };
  views.forEach(v => { if (v.dataset.title) titles[v.dataset.view] = v.dataset.title + ' · Aaron Hervey'; });
  const homeAnchors = ['top', 'home', 'work', 'about', 'editions'];
  let current = null;

  function show(name) {
    if (current === name) return false;
    views.forEach(v => { v.hidden = v.dataset.view !== name; });
    current = name;
    document.title = titles[name] || titles.home;
    document.querySelectorAll('.nav-links a').forEach(a => {
      const target = a.getAttribute('href').slice(1);
      const on = target === name || (target === 'work' && a.dataset.cases && a.dataset.cases.split(' ').includes(name));
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (name === 'home') tinIntro();
    if (name === 'writing') {
      // replay the leaflet unfolding each time the page opens
      const leaflet = document.getElementById('leaflet');
      leaflet.classList.remove('unfold'); void leaflet.offsetWidth; leaflet.classList.add('unfold');
    }
    setupToc(name);
    return true;
  }

  function route() {
    const h = decodeURIComponent(location.hash.slice(1)) || 'top';
    if (h === 'contact') {
      if (!current) show('home');
      document.getElementById('contact').scrollIntoView();
      return;
    }
    const view = views.find(v => v.dataset.view === h);
    if (view && h !== 'home') {
      show(h);
      window.scrollTo(0, 0);
      return;
    }
    if (!homeAnchors.includes(h)) {
      // a link to something that doesn't exist gets the empty tin
      show('empty');
      window.scrollTo(0, 0);
      return;
    }
    show('home');
    const el = h !== 'top' ? document.getElementById(h) : null;
    if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  // Clicking a link to the hash you're already on doesn't fire hashchange, so route it directly
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const target = a.getAttribute('href');
    if (target.length > 1 && target === location.hash) {
      e.preventDefault();
      current = null;
      route();
    }
  });

  // skip link: jump focus to the content without changing the page
  const skip = document.querySelector('.skip');
  if (skip) skip.addEventListener('click', e => {
    e.preventDefault();
    const m = document.getElementById('main');
    m.focus();
    m.scrollIntoView();
  });

  /* ---------- the tin: pull the tab, the lid peels back, the four case studies are packed inside ---------- */
  const tin = document.getElementById('tin'), lid = document.getElementById('lid');
  const ring = document.getElementById('pull-ring'), catchList = document.getElementById('catch');
  const toggle = document.getElementById('toggle'), stage = document.getElementById('stage');
  const hintText = toggle.querySelector('.hint-text');
  const fishes = [...catchList.querySelectorAll('.sardine a')];
  let p = 0, v = 0, target = 0, raf = 0, last = 0, introduced = false, isOpen = false, drag = null;
  const play = (el, frames, opts) => { if (!reduce && el.animate) el.animate(frames, opts); };

  function set(x) {
    p = Math.max(0, Math.min(1, x));
    tin.style.setProperty('--p', p.toFixed(4));
  }
  // the open/closed state only changes once the lid has come to rest (it never rests half-open)
  function settle(open) {
    if (open === isOpen) return;
    isOpen = open;
    stage.classList.toggle('is-open', open);
    catchList.inert = !open;
    toggle.setAttribute('aria-expanded', open);
    hintText.textContent = open ? 'Close the tin' : 'Pull the tab to open';
    if (open) fishes.forEach((f, i) => play(f, [{ scale: .82, translate: '0 10px' }, { scale: 1.06, translate: '0 -4px', offset: .55 }, { scale: 1, translate: '0 0' }],
      { duration: 520, delay: 60 + i * 70, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' }));
    else play(tin, [{ scale: '1 1' }, { scale: '1.03 .97' }, { scale: '.99 1.01' }, { scale: '1 1' }], { duration: 320, easing: 'ease-out' });
  }
  // a damped spring towards fully open or fully closed, with a little bounce off the hard stop
  function springTo(open, v0 = 0, k = 190) {
    target = open ? 1 : 0;
    cancelAnimationFrame(raf);
    if (reduce) { set(target); v = 0; return settle(open); }
    v = v0; last = performance.now();
    const step = now => {
      let dt = Math.min(.05, (now - last) / 1000); last = now;
      while (dt > 0) {
        const h = Math.min(dt, 1 / 240); dt -= h;
        v += (-k * (p - target) - 1.38 * Math.sqrt(k) * v) * h;
        let x = p + v * h;
        if (x > 1) { x = 1; v = -v * .28; } else if (x < 0) { x = 0; v = -v * .28; }
        set(x);
      }
      if (Math.abs(p - target) < .002 && Math.abs(v) < .02) { set(target); return settle(open); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  const toggleTin = (v0) => springTo(!isOpen, v0 || (isOpen ? -2 : 2));

  // first paint is always a sealed tin; it rattles, then pops open once it's actually on screen
  function tinIntro() {
    if (introduced) return;
    introduced = true;
    if (reduce) return springTo(true);
    const open = () => setTimeout(() => {
      if (drag || isOpen || target === 1) return;
      play(tin, [{ rotate: '0deg' }, { rotate: '-2.2deg' }, { rotate: '2deg' }, { rotate: '-1.4deg' }, { rotate: '.8deg' }, { rotate: '0deg' }], { duration: 420, easing: 'ease-in-out' });
      setTimeout(() => { if (!drag && target === 0) springTo(true, 1.2, 85); }, 380);
    }, 450);
    if (!('IntersectionObserver' in window)) return open();
    const io = new IntersectionObserver(entries => {
      if (!entries.some(en => en.isIntersecting)) return;
      io.disconnect();
      open();
    }, { threshold: .55 });
    io.observe(tin);
  }

  // drag the ring: down opens, up closes; on release it snaps to whichever way you were heading
  ring.addEventListener('pointerdown', e => {
    if (e.button) return;
    cancelAnimationFrame(raf);
    drag = { y0: e.clientY, y: e.clientY, t: performance.now(), p0: p, vel: 0, moved: false, h: lid.getBoundingClientRect().height };
    stage.classList.add('dragging');
    ring.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  ring.addEventListener('pointermove', e => {
    if (!drag) return;
    const now = performance.now(), dy = e.clientY - drag.y;
    if (Math.abs(e.clientY - drag.y0) > 4) drag.moved = true;
    if (now > drag.t) drag.vel = drag.vel * .6 + (dy / drag.h) / ((now - drag.t) / 1000) * .4;
    drag.y = e.clientY; drag.t = now;
    set(drag.p0 + (e.clientY - drag.y0) / drag.h);
  });
  const release = () => {
    if (!drag) return;
    const d = drag; drag = null;
    stage.classList.remove('dragging');
    if (!d.moved) return toggleTin();
    // a pause before letting go means no flick: it settles by position alone
    const vel = performance.now() - d.t > 90 ? 0 : Math.max(-8, Math.min(8, d.vel));
    springTo(p + vel * .22 > .5, vel);
  };
  ring.addEventListener('pointerup', release);
  ring.addEventListener('pointercancel', release);
  ring.addEventListener('lostpointercapture', release);

  toggle.addEventListener('click', () => toggleTin());
  lid.addEventListener('click', () => { if (!isOpen && !drag) springTo(true, 2); });
  // a closed tin rattles when you reach for it: there's something inside
  let rattled = 0;
  tin.addEventListener('pointerenter', e => {
    if (isOpen || drag || e.pointerType !== 'mouse' || performance.now() - rattled < 2500) return;
    rattled = performance.now();
    play(tin, [{ rotate: '0deg' }, { rotate: '-1.2deg' }, { rotate: '1deg' }, { rotate: '0deg' }], { duration: 300, easing: 'ease-in-out' });
  });
  // picking a sardine: it wriggles out of the tin, then the case study opens
  fishes.forEach(a => a.addEventListener('click', e => {
    if (reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    const dir = a.parentElement.classList.contains('flip') ? -1 : 1;
    const anim = a.animate([{ translate: '0 0', rotate: '0deg' }, { translate: `${-dir * 4}% -6%`, rotate: `${-dir * 3}deg`, offset: .3 }, { translate: `${dir * 70}% -14%`, rotate: `${dir * 6}deg`, opacity: 0 }],
      { duration: 340, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    anim.onfinish = () => { location.hash = a.getAttribute('href'); setTimeout(() => anim.cancel(), 120); };
  }));

  if (!reduce && matchMedia('(hover: hover)').matches) {
    const hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // the fish keep an eye on the pointer
      tin.style.setProperty('--ex', Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * .8))).toFixed(2));
      tin.style.setProperty('--ey', Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * .8))).toFixed(2));
      if (drag) return;
      tin.style.setProperty('--ty', ((e.clientX - cx) / innerWidth * 14).toFixed(2) + 'deg');
      tin.style.setProperty('--tx', (-(e.clientY - cy) / innerHeight * 10).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', () => ['--tx', '--ty', '--ex', '--ey'].forEach(k => tin.style.setProperty(k, k[2] === 't' ? '0deg' : '0')));
  }

  /* ---------- case study contents: built from each section's heading ---------- */
  // On small screens the sidebar is hidden; a pill in the header names the current section
  // and opens the same list as a bottom sheet.
  let tocSecs = [], tocActive = 0;
  const pill = document.getElementById('toc-pill'), pillV = document.getElementById('toc-pill-v');
  const sheet = document.getElementById('toc-sheet'), sheetList = document.getElementById('toc-sheet-list');
  const secLabel = s => s.dataset.toc || s.querySelector('h2').textContent;
  function goToSection(s) {
    s.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    const h = s.querySelector('h2');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  function markToc(i, btns) {
    tocActive = i;
    btns.forEach((b, j) => b.classList.toggle('on', i === j));
    if (pillV && tocSecs[i]) pillV.textContent = secLabel(tocSecs[i]);
  }
  function setupToc(name) {
    const view = views.find(v => v.dataset.view === name);
    const toc = view && view.querySelector('.toc');
    if (pill) pill.hidden = !toc;
    if (!toc) { tocSecs = []; return; }
    const secs = tocSecs = [...view.querySelectorAll('.case-sec')];
    if (!toc.dataset.built) {
      secs.forEach(s => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = secLabel(s);
        b.addEventListener('click', () => goToSection(s));
        toc.appendChild(b);
      });
      toc.dataset.built = '1';
    }
    tocBtns = [...toc.querySelectorAll('button')];
    tocActive = -1;
    trackToc();
  }
  // the current section is the last one whose top has passed 30% of the screen (works for jumps too)
  let tocBtns = [];
  function trackToc() {
    if (!tocSecs.length) return;
    const line = innerHeight * .3;
    let i = 0;
    tocSecs.forEach((s, j) => { if (s.getBoundingClientRect().top < line) i = j; });
    if (i !== tocActive) markToc(i, tocBtns);
  }
  function lockScroll(on) { document.documentElement.classList.toggle('modal-open', on); }
  if (pill && sheet) {
    pill.addEventListener('click', () => {
      sheetList.innerHTML = '';
      tocSecs.forEach((s, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<span class="mono">${String(i + 1).padStart(2, '0')}</span>`;
        b.append(secLabel(s));
        if (i === tocActive) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => { sheet.close(); goToSection(s); });
        li.appendChild(b);
        sheetList.appendChild(li);
      });
      sheet.showModal();
      lockScroll(true);
      const cur = sheetList.querySelector('[aria-current]');
      if (cur) cur.focus();
    });
    sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('.sheet-close')) sheet.close(); });
    sheet.addEventListener('close', () => lockScroll(false));
  }

  /* ---------- compact header: on small screens it tucks away while you read down, and returns on the way up ---------- */
  const head = document.getElementById('site-head');
  const small = matchMedia('(max-width: 900px)');
  let lastY = scrollY;
  function chrome() {
    const y = scrollY, dy = y - lastY;
    head.classList.toggle('scrolled', y > 8);
    if (Math.abs(dy) < 6 && y > 8) return;
    const nearEnd = y + innerHeight > document.documentElement.scrollHeight - 120;
    const hide = small.matches && dy > 0 && y > 160 && !nearEnd && !head.contains(document.activeElement);
    document.documentElement.classList.toggle('chrome-hide', hide);
    lastY = y;
  }
  head.addEventListener('focusin', () => document.documentElement.classList.remove('chrome-hide'));

  /* ---------- takeaway receipts print out when scrolled into view ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    const printers = document.querySelectorAll('.printer');
    const printObserver = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.replace('pending', 'printed');
        printObserver.unobserve(en.target);
      });
    }, { threshold: .15 });
    printers.forEach(pr => { pr.classList.add('pending'); printObserver.observe(pr); });
  }

  /* ---------- the mascot fish swims along each section divider as you scroll ---------- */
  const swimmers = [...document.querySelectorAll('.home-sec, .back-sec')].map((sec, i) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'swimmer');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<use href="#fish"/>';
    sec.prepend(s);
    return { sec, s, flip: i % 2 === 1 };
  });
  function swim() {
    swimmers.forEach(({ sec, s, flip }) => {
      if (!sec.offsetParent) return;
      const r = sec.getBoundingClientRect();
      const t = reduce ? .12 : Math.max(0, Math.min(1, 1 - r.top / innerHeight));
      const bob = reduce ? 0 : Math.sin(t * 18) * 3;
      // position as a fraction of the divider, so a resize never pushes the fish off the page
      s.style.setProperty('--swim', (flip ? 1 - t : t).toFixed(4));
      s.style.transform = `translateY(${bob}px) scaleX(${flip ? -1 : 1})`;
    });
  }
  let swimQueued = false;
  addEventListener('scroll', () => {
    if (swimQueued) return;
    swimQueued = true;
    requestAnimationFrame(() => { swimQueued = false; swim(); chrome(); trackToc(); });
  }, { passive: true });
  addEventListener('resize', swim);
  addEventListener('hashchange', () => requestAnimationFrame(swim));
  swim();

  /* ---------- Figma prototypes load only when asked, so the page stays light ---------- */
  document.querySelectorAll('.figma-load').forEach(btn => btn.addEventListener('click', () => {
    const frame = btn.closest('.figma-frame');
    const iframe = document.createElement('iframe');
    iframe.src = frame.dataset.src;
    iframe.title = frame.dataset.title;
    iframe.allowFullscreen = true;
    frame.appendChild(iframe);
    frame.querySelector('.figma-poster').hidden = true;
  }));

  /* ---------- screenshot lightbox ---------- */
  // One viewer for every screenshot: opens full screen, steps through the case study (buttons, ← →, swipe),
  // and zooms to real size (tap the image or the Zoom button) so dense UI is readable on a phone.
  // Close-up crops (.detail-shot) open the full screenshot they came from (data-full); each image is counted once.
  const box = document.getElementById('lightbox');
  const lbStage = document.getElementById('lb-stage');
  const boxImg = lbStage.querySelector('img'), boxCap = box.querySelector('.lb-cap');
  const lbCount = document.getElementById('lb-count'), lbZoom = document.getElementById('lb-zoom');
  const lbPrev = box.querySelector('.lb-prev'), lbNext = box.querySelector('.lb-next');
  let lbSet = [], lbIdx = 0, zoomed = false, swiped = false;
  // touch wording in the hint follows the input actually used, not just what the device claims
  addEventListener('pointerdown', e => document.documentElement.classList.toggle('touch-input', e.pointerType === 'touch'), { capture: true, passive: true });

  // what a trigger shows: its full-size source, alt text and a caption that describes that image
  function lbItem(el) {
    const img = el.querySelector('img');
    const src = el.dataset.full || (img && (img.getAttribute('src')));
    const alt = el.dataset.fullAlt || (img ? img.alt : '');
    const fig = el.closest('figure'), cap = fig && fig.querySelector('figcaption:not(.sr-only)');
    let text = el.dataset.caption || (!el.dataset.full && cap ? cap.textContent : '') || alt;
    return { el, src, alt, text: text.replace(/\s+/g, ' ').trim() };
  }
  function lbBuild(scope) {
    const seen = new Map();
    [...scope.querySelectorAll('.shot, .shot-link')].forEach(el => {
      const it = lbItem(el);
      if (!it.src) return;
      // a full screenshot's own caption beats the alt-text caption a close-up would give it
      const prev = seen.get(it.src);
      if (!prev) seen.set(it.src, it);
      else if (!el.dataset.full && !el.dataset.caption && prev.el.dataset.full) seen.set(it.src, Object.assign(it, { order: prev.order }));
      seen.get(it.src).order ??= seen.size;
    });
    return [...seen.values()].sort((a, b) => a.order - b.order);
  }
  function setZoom(on, fx = .5, fy = .5) {
    zoomed = on;
    box.classList.toggle('zoomed', on);
    lbZoom.setAttribute('aria-pressed', on);
    lbZoom.textContent = on ? 'Fit to screen' : 'Zoom in';
    if (!on) { boxImg.style.width = ''; lbStage.scrollTo(0, 0); return; }
    // at least the image's own pixels (capped at 2.6x the screen) so small text becomes legible
    const w = Math.max(lbStage.clientWidth * 1.6, Math.min(boxImg.naturalWidth || 1600, lbStage.clientWidth * 2.6));
    boxImg.style.width = Math.round(w) + 'px';
    requestAnimationFrame(() => {
      lbStage.scrollLeft = fx * boxImg.offsetWidth - lbStage.clientWidth / 2;
      lbStage.scrollTop = fy * boxImg.offsetHeight - lbStage.clientHeight / 2;
    });
  }
  function lbShow(i) {
    lbIdx = (i + lbSet.length) % lbSet.length;
    const it = lbSet[lbIdx];
    setZoom(false);
    boxImg.src = it.src;
    boxImg.alt = it.alt;
    boxCap.textContent = it.text;
    const many = lbSet.length > 1;
    lbCount.textContent = many ? `${lbIdx + 1} / ${lbSet.length}` : '';
    lbPrev.hidden = lbNext.hidden = !many;
  }
  document.addEventListener('click', e => {
    const shot = e.target.closest('.shot, .shot-link');
    if (!shot || box.contains(shot)) return;
    lbSet = lbBuild(shot.closest('[data-view]') || document);
    const it = lbItem(shot);
    let i = lbSet.findIndex(x => x.src === it.src);
    if (i < 0) { lbSet = [it]; i = 0; }
    lbShow(i);
    if (box.showModal) box.showModal(); else box.setAttribute('open', '');
    lockScroll(true);
  });
  lbPrev.addEventListener('click', () => lbShow(lbIdx - 1));
  lbNext.addEventListener('click', () => lbShow(lbIdx + 1));
  lbZoom.addEventListener('click', () => setZoom(!zoomed));
  boxImg.addEventListener('click', e => {
    if (swiped) return;
    const r = boxImg.getBoundingClientRect();
    setZoom(!zoomed, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  box.addEventListener('click', e => {
    if (e.target === box || e.target.closest('.lb-close') || (e.target === lbStage && !zoomed)) box.close();
  });
  box.addEventListener('close', () => { setZoom(false); lockScroll(false); });
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' && lbSet.length > 1) { lbShow(lbIdx + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' && lbSet.length > 1) { lbShow(lbIdx - 1); e.preventDefault(); }
  });
  // swipe sideways to step through screenshots (only when not zoomed, where a drag pans instead)
  let sx = null, sy = 0;
  lbStage.addEventListener('pointerdown', e => { swiped = false; if (!zoomed && e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
  lbStage.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && lbSet.length > 1) { swiped = true; lbShow(lbIdx + (dx < 0 ? 1 : -1)); }
  });
  lbStage.addEventListener('pointercancel', () => { sx = null; });

  /* ---------- before / after comparison: a native range input drives the reveal ---------- */
  document.querySelectorAll('.compare').forEach(c => {
    const range = c.querySelector('.compare-range');
    const update = () => c.style.setProperty('--pos', range.value + '%');
    range.addEventListener('input', update);
    update();
  });

  /* ---------- copy email ---------- */
  const copy = document.getElementById('copy'), email = document.getElementById('email');
  copy.addEventListener('click', () => {
    const done = () => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy email'; }, 1600); };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents(email);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      copy.textContent = 'Selected, press Ctrl+C';
    };
    if (navigator.clipboard) navigator.clipboard.writeText(email.textContent).then(done, fallback); else fallback();
  });

  /* ---------- barcode ---------- */
  const bars = document.getElementById('bars');
  let seed = 7;
  for (let i = 0; i < 46; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const b = document.createElement('i');
    b.style.width = (1 + (seed % 3)) + 'px';
    b.style.marginRight = (1 + (seed % 2) * 2) + 'px';
    bars.appendChild(b);
  }

  /* ---------- privacy-friendly visit counts (GoatCounter: no cookies, no personal data) ---------- */
  const gcCode = (document.querySelector('meta[name="goatcounter"]') || {}).content;
  const isLive = !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !location.hostname.endsWith('claude.ai') && !location.hostname.endsWith('claudeusercontent.com');
  if (gcCode && isLive) {
    window.goatcounter = { no_onload: true };
    const gc = document.createElement('script');
    gc.async = true;
    gc.src = '//gc.zgo.at/count.js';
    gc.dataset.goatcounter = `https://${gcCode}.goatcounter.com/count`;
    const countView = () => window.goatcounter && window.goatcounter.count &&
      window.goatcounter.count({ path: location.pathname + (location.hash || '#top'), title: document.title });
    gc.addEventListener('load', countView);
    document.head.appendChild(gc);
    addEventListener('hashchange', () => setTimeout(countView, 50));
  }

  route();
})();
