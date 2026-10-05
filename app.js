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

  /* ---------- the tin ---------- */
  const tin = document.getElementById('tin'), lid = document.getElementById('lid');
  // two handles: the classic side key (drag up to open) and the pastel pull tab (drag down to open)
  const handles = [{ el: document.getElementById('key'), dir: 1 }, { el: document.getElementById('pull-ring'), dir: -1 }].filter(h => h.el);
  const toggle = document.getElementById('toggle'), stage = document.getElementById('stage');
  let p = 0, anim = null, introduced = false;

  function set(v) {
    p = Math.max(0, Math.min(1, v));
    tin.style.setProperty('--p', p.toFixed(4));
    handles.forEach(({ el }) => {
      el.setAttribute('aria-valuenow', Math.round(p * 100));
      el.setAttribute('aria-valuetext', p > .97 ? 'Open' : p < .03 ? 'Closed' : Math.round(p * 100) + '% open');
    });
    toggle.textContent = p > .5 ? 'Close the tin' : 'Open the tin';
    stage.classList.toggle('is-open', p > .5);
  }
  function animateTo(target, ms = 1500) {
    cancelAnimationFrame(anim);
    if (reduce) return set(target);
    const from = p, t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      set(from + (target - from) * ease(t));
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  // the lid peels open the first time the tin is actually on screen (below the headline on phones)
  function tinIntro() {
    if (introduced) return;
    introduced = true;
    set(0);
    const open = () => setTimeout(() => { if (!drag && p < .03) animateTo(1, 1800); }, 500);
    if (!('IntersectionObserver' in window)) return open();
    const io = new IntersectionObserver(entries => {
      if (!entries.some(en => en.isIntersecting)) return;
      io.disconnect();
      open();
    }, { threshold: .6 });
    io.observe(tin);
  }

  let drag = null;
  const end = () => { if (!drag) return; drag = null; if (p > .88) animateTo(1, 300); else if (p < .08) animateTo(0, 300); };
  handles.forEach(({ el, dir }) => {
    el.addEventListener('pointerdown', e => {
      cancelAnimationFrame(anim);
      drag = { y: e.clientY, p, h: lid.getBoundingClientRect().height, dir };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => { if (drag) set(drag.p + drag.dir * (drag.y - e.clientY) / drag.h); });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowRight') set(p + .1);
      else if (k === 'ArrowDown' || k === 'ArrowLeft') set(p - .1);
      else if (k === 'Home') set(0);
      else if (k === 'End') set(1);
      else if (k === 'Enter' || k === ' ') animateTo(p > .5 ? 0 : 1, 900);
      else return;
      e.preventDefault();
    });
  });
  toggle.addEventListener('click', () => animateTo(p > .5 ? 0 : 1, 1100));
  lid.addEventListener('click', () => { if (p < .5) animateTo(1, 1100); });

  if (!reduce && matchMedia('(hover: hover)').matches) {
    const hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', e => {
      if (drag) return;
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      tin.style.setProperty('--ty', (x * 14).toFixed(2) + 'deg');
      tin.style.setProperty('--tx', (-y * 10).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', () => { tin.style.setProperty('--tx', '0deg'); tin.style.setProperty('--ty', '0deg'); });
  }

  /* ---------- case study contents: built from each section's heading ---------- */
  let tocObserver = null;
  function setupToc(name) {
    if (tocObserver) { tocObserver.disconnect(); tocObserver = null; }
    const view = views.find(v => v.dataset.view === name);
    const toc = view && view.querySelector('.toc');
    if (!toc) return;
    const secs = [...view.querySelectorAll('.case-sec')];
    if (!toc.dataset.built) {
      secs.forEach(s => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = s.dataset.toc || s.querySelector('h2').textContent;
        b.addEventListener('click', () => s.scrollIntoView({ block: 'start' }));
        toc.appendChild(b);
      });
      toc.dataset.built = '1';
    }
    const btns = [...toc.querySelectorAll('button')];
    if (!('IntersectionObserver' in window)) return;
    tocObserver = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const i = secs.indexOf(en.target);
        btns.forEach((b, j) => b.classList.toggle('on', i === j));
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    secs.forEach(s => tocObserver.observe(s));
  }

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
    requestAnimationFrame(() => { swimQueued = false; swim(); });
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
  const box = document.getElementById('lightbox');
  const boxImg = box.querySelector('img'), boxCap = box.querySelector('p');
  document.addEventListener('click', e => {
    const shot = e.target.closest('.shot');
    if (!shot) return;
    const img = shot.querySelector('img');
    boxImg.src = img.src;
    boxImg.alt = img.alt;
    const cap = shot.closest('figure') && shot.closest('figure').querySelector('figcaption');
    boxCap.textContent = cap ? cap.textContent : img.alt;
    if (box.showModal) box.showModal(); else box.setAttribute('open', '');
  });
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('button')) box.close(); });

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
