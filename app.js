(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- routing: each page is a [data-view] block, picked by the URL hash ---------- */
  const views = [...document.querySelectorAll('[data-view]')];
  const titles = { home: 'Aaron Hervey · Product Designer' };
  views.forEach(v => { if (v.dataset.title) titles[v.dataset.view] = v.dataset.title + ' · Aaron Hervey'; });
  const homeAnchors = ['top', 'home', 'work', 'about', 'editions'];
  // each view's summary doubles as its description (for shares from a browser and for reader tools)
  const descTag = document.querySelector('meta[name="description"]');
  const descHome = descTag && descTag.content;
  let current = null;

  function show(name) {
    if (current === name) return false;
    const first = current === null;
    views.forEach(v => { v.hidden = v.dataset.view !== name; });
    current = name;
    const next = views.find(v => v.dataset.view === name);
    if (!first && !reduce && next && next.animate) {
      next.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
    document.title = titles[name] || titles.home;
    if (descTag) {
      const sum = views.find(v => v.dataset.view === name)?.querySelector('.summary');
      descTag.content = sum ? sum.textContent.replace(/\s+/g, ' ').trim() : descHome;
    }
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

  // a sardine's exit animation delays its navigation; any other navigation in the meantime wins
  let pendingNav = null;
  function route() {
    pendingNav = null;
    // the boot style in <head> painted the routed page before this script ran; from here the router owns it
    document.getElementById('route-boot')?.remove();
    let h;
    try { h = decodeURIComponent(location.hash.slice(1)) || 'top'; } catch { h = location.hash.slice(1); }
    if (h === 'contact') {
      if (!current) show('home');
      document.getElementById('contact').scrollIntoView();
      return;
    }
    const view = views.find(v => v.dataset.view === h);
    if (view && h !== 'home') {
      const changed = show(h);
      window.scrollTo(0, 0);
      // a page that marks its heading focusable takes focus there, so keyboard and screen-reader users start at the top
      const head = changed && view.querySelector('h1[tabindex="-1"]');
      if (head) head.focus({ preventScroll: true });
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
  // First paint is always sealed, on every screen. Once it's on screen it rattles and opens by itself (~1.5s);
  // with reduced motion it stays sealed and the button opens it. While sealed, reaching for it lifts the lid
  // a crack; the ring drags, and is also a keyboard slider.
  const tin = document.getElementById('tin'), lid = document.getElementById('lid');
  const ring = document.getElementById('pull-ring'), catchList = document.getElementById('catch');
  const toggle = document.getElementById('toggle'), stage = document.getElementById('stage');
  const hintText = toggle.querySelector('.hint-text');
  const fishes = [...catchList.querySelectorAll('.sardine a')];
  const PEEK = .17;
  let p = 0, v = 0, target = 0, raf = 0, last = 0, introduced = false, isOpen = false, drag = null, wantOpen = false, saysOpen = false;
  const play = (el, frames, opts) => (!reduce && el.animate) ? el.animate(frames, opts) : null;
  const closedLabel = reduce ? 'Open the tin' : 'Pull the tab to open';
  hintText.textContent = closedLabel;

  // the button speaks for the lid: it flips once the lid passes halfway, or when it comes to rest
  function label(open) {
    if (open === saysOpen) return;
    saysOpen = open;
    toggle.setAttribute('aria-expanded', open);
    hintText.textContent = open ? 'Close the tin' : closedLabel;
  }
  function set(x) {
    const was = p;
    p = Math.max(0, Math.min(1, x));
    tin.style.setProperty('--p', p.toFixed(4));
    if ((was - .5) * (p - .5) < 0 || p === .5) label(p > .5);
    const pct = Math.round(p * 100);
    if (ring.getAttribute('aria-valuenow') !== String(pct)) {
      ring.setAttribute('aria-valuenow', pct);
      ring.setAttribute('aria-valuetext', pct >= 99 ? 'Open, four case studies inside' : pct <= 1 ? 'Sealed' : pct + '% open');
    }
  }
  // what the controls say follows where the lid is heading, straight away (not where it is mid-flight)
  function intend(open) {
    if (open === wantOpen) return;
    wantOpen = open;
    stage.classList.toggle('opening', open);
    if (!open) catchList.inert = true;
  }
  // the lid has come to rest
  function settle() {
    const open = target >= .5;
    label(open);
    if (open) catchList.inert = false;
    if (open === isOpen) return;
    isOpen = open;
    stage.classList.toggle('is-open', open);
    if (open) fishes.forEach((f, i) => play(f, [{ scale: .86, translate: '0 8px' }, { scale: 1.04, translate: '0 -3px', offset: .55 }, { scale: 1, translate: '0 0' }],
      { duration: 460, delay: 40 + i * 60, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' }));
    else play(tin, [{ scale: '1 1' }, { scale: '1.025 .975' }, { scale: '.995 1.005' }, { scale: '1 1' }], { duration: 300, easing: 'ease-out' });
  }
  // a damped spring towards a resting point, with a little bounce off the hard stops
  function springTo(to, v0 = 0, k = 190) {
    target = to;
    if (to >= .5) intend(true); else if (to === 0 || to > PEEK) intend(false);
    cancelAnimationFrame(raf);
    if (reduce) { set(to); v = 0; return settle(); }
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
      if (Math.abs(p - target) < .002 && Math.abs(v) < .02) { set(target); return settle(); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  // on phones the open tin's tab ends up at the bottom, so bring it clear of the bottom dock
  const phone = matchMedia('(max-width: 600px)');
  function reveal() {
    if (!phone.matches) return;
    const over = stage.getBoundingClientRect().bottom + 52 - (innerHeight - 92);
    if (over > 0) scrollBy({ top: over, behavior: reduce ? 'auto' : 'smooth' });
  }
  const openTin = (v0 = 2) => { springTo(1, v0); reveal(); };
  const closeTin = (v0 = -2) => springTo(0, v0);
  const toggleTin = () => (wantOpen ? closeTin() : openTin());
  const rattle = (amp = 1.2) => play(tin, [{ rotate: '0deg' }, { rotate: -amp + 'deg' }, { rotate: amp * .8 + 'deg' }, { rotate: -amp * .4 + 'deg' }, { rotate: '0deg' }],
    { duration: 360, easing: 'ease-in-out' });

  // once the sealed tin is on screen it gives one small rattle, then pops open by itself
  function tinIntro() {
    if (introduced || reduce) return;
    introduced = true;
    const go = () => {
      setTimeout(() => { if (!drag && !wantOpen) rattle(1.6); }, 1050);
      setTimeout(() => { if (!drag && !wantOpen) springTo(1, 1.2, 110); }, 1450);
    };
    if (!('IntersectionObserver' in window)) return go();
    const io = new IntersectionObserver(entries => {
      if (!entries.some(en => en.isIntersecting)) return;
      io.disconnect();
      go();
    }, { threshold: .3 });
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
    if (drag.moved) intend(p > .5);
  });
  const release = () => {
    if (!drag) return;
    const d = drag; drag = null;
    stage.classList.remove('dragging');
    if (!d.moved) return toggleTin();
    // a pause before letting go means no flick: it settles by position alone
    const vel = performance.now() - d.t > 90 ? 0 : Math.max(-8, Math.min(8, d.vel));
    springTo(p + vel * .22 > .5 ? 1 : 0, vel);
  };
  ring.addEventListener('pointerup', release);
  ring.addEventListener('pointercancel', release);
  ring.addEventListener('lostpointercapture', release);
  // the ring is also a slider: arrows peel it a quarter at a time, Home/End/Enter/Space go all the way
  ring.addEventListener('keydown', e => {
    const step = { ArrowDown: .25, ArrowRight: .25, PageDown: .5, ArrowUp: -.25, ArrowLeft: -.25, PageUp: -.5 }[e.key];
    if (step) springTo(Math.max(0, Math.min(1, Math.round((Math.max(target, p > PEEK ? p : 0) + step) * 4) / 4)), step * 4);
    else if (e.key === 'Home') closeTin();
    else if (e.key === 'End') openTin();
    else if (e.key === 'Enter' || e.key === ' ') toggleTin();
    else return;
    e.preventDefault();
  });

  toggle.addEventListener('click', () => toggleTin());
  lid.addEventListener('click', () => { if (!wantOpen && !drag) openTin(); });
  // a sealed tin rattles and lifts its lid a crack when you reach for it
  let rattled = 0;
  stage.addEventListener('pointerenter', e => {
    if (wantOpen || drag || e.pointerType !== 'mouse') return;
    if (performance.now() - rattled > 1800) { rattled = performance.now(); rattle(); }
    if (!reduce && target === 0) springTo(PEEK, 1.2, 140);
  });
  stage.addEventListener('pointerleave', () => { if (!wantOpen && !drag && target === PEEK) springTo(0, 0, 150); });

  // picking a sardine: a flick of the tail and it darts out of the tin, then the case study opens
  fishes.forEach(a => a.addEventListener('click', e => {
    if (reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    if (a.classList.contains('swim')) return;
    const dir = a.parentElement.classList.contains('flip') ? -1 : 1;
    a.classList.add('swim');
    const anim = a.animate([
      { translate: '0 0', rotate: '0deg', scale: 1.06 },
      { translate: `${-dir * 5}% 1%`, rotate: `${dir * 4}deg`, scale: 1.02, offset: .28, easing: 'cubic-bezier(.6,0,.9,.4)' },
      { translate: `${dir * 85}% -10%`, rotate: `${-dir * 5}deg`, scale: 1.08, opacity: 0 }
    ], { duration: 360, fill: 'forwards' });
    // the rest of the catch flinches as it goes
    fishes.forEach(o => { if (o !== a) play(o, [{ translate: '0 0' }, { translate: `${dir * 1.5}% 0` }, { translate: '0 0' }], { duration: 300, easing: 'ease-out' }); });
    // navigate when the fish has left, or after 450 ms if the animation never finishes (hidden tab, cancelled);
    // if anything else navigated meanwhile (a nav tap, back), that navigation stands
    const href = a.getAttribute('href'), from = location.hash, token = pendingNav = {};
    const go = () => {
      if (pendingNav !== token) return;
      pendingNav = null;
      if (location.hash === from) location.hash = href;
      setTimeout(() => { anim.cancel(); a.classList.remove('swim'); }, 120);
    };
    anim.finished.then(go, go);
    setTimeout(go, 470);
  }));

  if (!reduce && matchMedia('(hover: hover)').matches) {
    const hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // the fish keep an eye on the pointer
      tin.style.setProperty('--ex', Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * .8))).toFixed(2));
      tin.style.setProperty('--ey', Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * .8))).toFixed(2));
      tin.style.setProperty('--gx', Math.max(-1, Math.min(1, (e.clientX - cx) / innerWidth * 2)).toFixed(3));
      if (drag) return;
      tin.style.setProperty('--ty', ((e.clientX - cx) / innerWidth * 12).toFixed(2) + 'deg');
      tin.style.setProperty('--tx', (-(e.clientY - cy) / innerHeight * 8).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', () => ['--tx', '--ty', '--ex', '--ey', '--gx'].forEach(k => tin.style.setProperty(k, k[2] === 't' ? '0deg' : '0')));
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
    btns.forEach((b, j) => { b.classList.toggle('on', i === j); b.classList.toggle('done', j < i); });
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
        else if (i < tocActive) b.classList.add('done');
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
  // pins from an annotated frame ride on a layer sized to the shown image (it scrolls with the image when zoomed)
  const lbPins = document.createElement('div');
  lbPins.className = 'lb-pins'; lbPins.setAttribute('aria-hidden', 'true');
  lbStage.appendChild(lbPins);
  function placePins() {
    lbPins.hidden = !lbPins.childElementCount || !boxImg.complete;
    if (lbPins.hidden) return;
    Object.assign(lbPins.style, { left: boxImg.offsetLeft + 'px', top: boxImg.offsetTop + 'px', width: boxImg.offsetWidth + 'px', height: boxImg.offsetHeight + 'px' });
  }
  boxImg.addEventListener('load', placePins);
  addEventListener('resize', placePins);
  // touch wording in the hint follows the input actually used, not just what the device claims
  addEventListener('pointerdown', e => document.documentElement.classList.toggle('touch-input', e.pointerType === 'touch'), { capture: true, passive: true });

  // what a trigger shows: its full-size source, alt text and a caption that describes that image
  function lbItem(el) {
    const img = el.querySelector('img');
    const src = el.dataset.full || (img && (img.getAttribute('src')));
    const alt = el.dataset.fullAlt || (img ? img.alt : '');
    const fig = el.closest('figure'), cap = fig && fig.querySelector('figcaption:not(.sr-only)');
    let text = el.dataset.caption || (!el.dataset.full && cap ? cap.textContent : '') || alt;
    // annotated frames bring their pins and numbered key along
    const stage = el.closest('.fr-stage'), keyEl = stage && document.getElementById(el.getAttribute('aria-describedby') || '');
    const pins = stage ? [...stage.querySelectorAll('.pt')] : [];
    const key = keyEl ? [...keyEl.children].map(li => li.textContent.replace(/\s+/g, ' ').trim()) : [];
    return { el, src, alt, pins, key, text: text.replace(/\s+/g, ' ').trim() };
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
    if (!on) { boxImg.style.width = ''; lbStage.scrollTo(0, 0); requestAnimationFrame(placePins); return; }
    // at least the image's own pixels (capped at 2.6x the screen) so small text becomes legible
    const w = Math.max(lbStage.clientWidth * 1.6, Math.min(boxImg.naturalWidth || 1600, lbStage.clientWidth * 2.6));
    boxImg.style.width = Math.round(w) + 'px';
    requestAnimationFrame(() => {
      placePins();
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
    lbPins.replaceChildren(...(it.pins || []).map(p => {
      const c = p.cloneNode(true);
      ['id', 'tabindex', 'role', 'aria-label', 'aria-describedby'].forEach(a => c.removeAttribute(a));
      return c;
    }));
    (it.key || []).forEach((k, n) => {
      const s = document.createElement('span'), b = document.createElement('b');
      s.className = 'lb-key'; b.textContent = n + 1; s.append(b, k); boxCap.append(' ', s);
    });
    requestAnimationFrame(placePins);
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
  // the button shows the result for 2s; a polite live region says it aloud
  const copy = document.getElementById('copy'), email = document.getElementById('email'), copyStatus = document.getElementById('copy-status');
  let copyTimer;
  const copyFeedback = (html, msg, cls) => {
    clearTimeout(copyTimer);
    copy.innerHTML = html;
    copy.classList.toggle('done', cls === 'done');
    if (copyStatus) { copyStatus.textContent = ''; setTimeout(() => { copyStatus.textContent = msg; }, 30); }
    copyTimer = setTimeout(() => { copy.textContent = 'Copy email'; copy.classList.remove('done'); if (copyStatus) copyStatus.textContent = ''; }, 2000);
  };
  copy.addEventListener('click', () => {
    const done = () => copyFeedback('Copied <svg class="ico" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>', 'Email address copied', 'done');
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents(email);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      copyFeedback('Selected, press Ctrl+C', 'Email address selected. Press Control C to copy.');
    };
    if (navigator.clipboard) navigator.clipboard.writeText(email.textContent).then(done, fallback); else fallback();
  });


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

  /* ---------- limited editions: opening a tin lifts its lid and shows the back of the tin ---------- */
  // Notes stay visible without JS; with JS they start hidden so opening a tin reveals them.
  const edTins = [...document.querySelectorAll('button.ed-tin')];
  const edNote = tin => document.getElementById(tin.getAttribute('aria-controls'));
  const setTin = (tin, open) => {
    tin.setAttribute('aria-expanded', String(open));
    const note = edNote(tin);
    if (note) note.hidden = !open;
  };
  let lastTin = null;
  edTins.forEach(tin => {
    const note = edNote(tin);
    if (note) note.hidden = true;
    tin.addEventListener('click', () => {
      const open = tin.getAttribute('aria-expanded') !== 'true';
      setTin(tin, open);
      lastTin = open ? tin : null;
      // on phones the note opens below the fold, behind the bottom dock: bring it up just enough
      if (open && note && note.getBoundingClientRect().bottom > innerHeight - (parseFloat(getComputedStyle(note).scrollMarginBottom) || 0)) {
        note.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  });
  // Escape closes the open tin you're in (or the last one opened) and returns focus to its button.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const active = document.activeElement;
    const open = edTins.filter(t => t.getAttribute('aria-expanded') === 'true');
    const tin = open.find(t => t === active || (edNote(t) && edNote(t).contains(active))) ||
      (lastTin && open.includes(lastTin) ? lastTin : null);
    if (!tin) return;
    setTin(tin, false);
    if (tin === lastTin) lastTin = null;
    tin.focus();
  });

  /* ---------- about-me pantry: pick something off the shelf and its label opens under the cabinet ---------- */
  // Without this block every label is listed under the shelf. With it, one label shows at a time:
  // each shelf item is a disclosure button (aria-expanded/aria-controls), a caret points from the label
  // back up to its item, the same item or the label's close button puts it back, and Escape closes it.
  // With nothing picked, the panel shows "What's on the shelf", an index card whose buttons open the same labels.
  const pantry = document.getElementById('pantry');
  if (pantry) {
    const pnItems = [...pantry.querySelectorAll('.pn-item')];
    const pnPanel = document.getElementById('pn-panel');
    const pnIndex = document.getElementById('pn-index');
    const pnStory = b => document.getElementById(b.getAttribute('aria-controls'));
    let pnOpen = null;
    pantry.classList.add('is-live');
    pnItems.forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      const s = pnStory(b);
      s.hidden = true;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'pn-x';
      x.setAttribute('aria-label', 'Put it back on the shelf');
      x.addEventListener('click', () => pnClose(true));
      s.prepend(x);
    });
    const pnFlip = el => { el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in'); };
    // the caret sits under the middle of the picked item (kept inside the label's rounded corners)
    function pnCaret() {
      if (!pnOpen) return;
      const r = pnOpen.getBoundingClientRect(), p = pnPanel.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2 - p.left, 40), p.width - 40);
      pnPanel.style.setProperty('--x', x + 'px');
    }
    // Bring the label onto the screen: its top clears the sticky header, and as much of it as fits
    // sits above the phone's bottom dock. Smooth unless reduced motion asks otherwise.
    // (measured on the panel: the label itself is mid-flip, so its own box is squashed)
    function pnReveal() {
      const r = pnPanel.getBoundingClientRect();
      const headEl = document.getElementById('site-head');
      const top = (headEl && getComputedStyle(headEl).position !== 'static' ? headEl.offsetHeight : 0) + 34;
      const dock = document.querySelector('.nav-links');
      const dockTop = dock && getComputedStyle(dock).position === 'fixed' ? dock.getBoundingClientRect().top : innerHeight;
      const bottom = Math.min(innerHeight, dockTop) - 16;
      if (r.top >= top && r.bottom <= bottom) return;
      const dy = Math.min(r.bottom - bottom, r.top - top);
      if (Math.abs(dy) > 4) scrollBy({ top: dy, behavior: reduce ? 'auto' : 'smooth' });
    }
    function pnShow(b, reveal) {
      if (pnOpen) { pnOpen.setAttribute('aria-expanded', 'false'); pnStory(pnOpen).hidden = true; }
      pnOpen = b;
      const s = pnStory(b);
      b.setAttribute('aria-expanded', 'true');
      pnIndex.hidden = true;
      s.hidden = false;
      pnFlip(s);
      pnPanel.classList.add('has-open');
      pnPanel.style.setProperty('--tone', s.style.getPropertyValue('--tone'));
      pnCaret();
      if (reveal) pnReveal();
      return s;
    }
    function pnClose(refocus) {
      if (!pnOpen) return;
      const b = pnOpen;
      b.setAttribute('aria-expanded', 'false');
      pnStory(b).hidden = true;
      pnPanel.classList.remove('has-open');
      pnIndex.hidden = false;
      pnFlip(pnIndex);
      pnOpen = null;
      if (refocus) b.focus();
    }
    pnItems.forEach(b => b.addEventListener('click', () => { if (b === pnOpen) pnClose(false); else pnShow(b, true); }));
    // the index card's buttons open a label in its place; focus moves to that label's heading
    pnIndex.addEventListener('click', e => {
      const btn = e.target.closest('button[data-open]');
      if (!btn) return;
      const item = pnItems.find(b => b.getAttribute('aria-controls') === btn.dataset.open);
      if (!item) return;
      const h = pnShow(item, true).querySelector('h3');
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !pnOpen || pantry.closest('[data-view]').hidden) return;
      pnClose(pantry.contains(document.activeElement));
    });
    addEventListener('resize', pnCaret);
    // the caret is measured while the page is hidden on a deep link elsewhere; measure again once it shows
    addEventListener('hashchange', () => requestAnimationFrame(pnCaret));
    if (document.fonts) document.fonts.ready.then(pnCaret);
    // the house tin's label is open when you arrive, so the pattern is plain at a glance
    const first = pnItems.find(b => b.hasAttribute('data-default'));
    if (first) pnShow(first, false);
  }

  route();
})();
