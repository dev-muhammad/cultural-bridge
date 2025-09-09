// Minimal slide controller for static HTML slides
(function () {
  const deck = document.getElementById('deck');
  const slideEls = Array.from(deck.querySelectorAll('.slide'));
  if (!slideEls.length) return;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const isCompare = (el) => el.hasAttribute('data-compare');

  const getIndexFromHash = () => {
    const m = location.hash.match(/#(\d+)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (Number.isNaN(n)) return null;
    return clamp(n, 0, slideEls.length - 1);
  };

  let index = slideEls.findIndex((el) => el.classList.contains('active'));
  if (index < 0) index = getIndexFromHash() ?? 0;

  const resetPhases = (el) => {
    if (!isCompare(el)) return;
    const classes = Array.from(el.classList);
    classes.forEach((cls) => {
      if (/^phase-\d+$/.test(cls)) {
        el.classList.remove(cls);
      }
    });
    el.classList.add('phase-1');
  };

  const setIndex = (n, updateHash = true, reset = true) => {
    index = clamp(n, 0, slideEls.length - 1);
    slideEls.forEach((el, i) => {
      el.classList.toggle('active', i === index);
      if (reset && i === index) resetPhases(el);
    });
    document.body.classList.remove('overview');
    deck.classList.remove('overview');
    if (updateHash) history.replaceState(null, '', `#${index}`);

    // If in mobile mode, scroll to the slide
    if (isMobileMode()) {
      slideEls[index].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  };

  const advanceWithinSlide = () => {
    const el = slideEls[index];
    if (!isCompare(el)) return false;

    // Determine current phase on the slide (defaults to 1)
    let currentPhase = 1;
    el.classList.forEach((cls) => {
      const m = cls.match(/^phase-(\d+)$/);
      if (m) currentPhase = Math.max(currentPhase, parseInt(m[1], 10));
    });

    // Determine max phase based on elements that declare phase-N
    let maxPhase = 1;
    el.querySelectorAll('.phase-content').forEach((node) => {
      node.classList.forEach((cls) => {
        const m = cls.match(/^phase-(\d+)$/);
        if (m) maxPhase = Math.max(maxPhase, parseInt(m[1], 10));
      });
    });

    if (currentPhase < maxPhase) {
      el.classList.add(`phase-${currentPhase + 1}`);
      return true;
    }
    return false; // no more phases → move to next slide
  };

  const next = () => {
    if (!advanceWithinSlide()) setIndex(index + 1);
  };
  const prev = () => setIndex(index - 1);

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isInteractive = e.target && (e.target.isContentEditable || ['input','textarea','select','button'].includes(tag));
    if (isInteractive) return; // don't hijack keys when focusing controls

    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); next(); }
    if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    if (k === 'Home') { e.preventDefault(); setIndex(0); }
    if (k === 'End') { e.preventDefault(); setIndex(slideEls.length - 1); }
    if (k && k.toLowerCase && k.toLowerCase() === 'f') toggleFullscreen();
    if (k && k.toLowerCase && k.toLowerCase() === 'o') toggleOverview();
    if (k === 'Escape') exitModes();
  });

  // Click handling: overview opens slide; normal mode advances (unless interactive element)
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('overview')) {
      const path = e.composedPath ? e.composedPath() : (e.path || []);
      const target = e.target;
      const slideEl = target.closest ? target.closest('.slide') : path.find((el) => el && el.classList && el.classList.contains('slide'));
      if (slideEl) {
        const idx = slideEls.indexOf(slideEl);
        if (idx !== -1) { setIndex(idx); }
      }
      return;
    }
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    // Treat clicks on phase-content as interactive to "open" hidden pieces without advancing
    const isInteractive = e.target && (
      e.target.isContentEditable ||
      ['a','input','textarea','select','button','label'].includes(tag) ||
      e.target.closest('a,button,.phase-content')
    );
    if (isInteractive) {
      // If clicking inside a compare slide, try to advance phase instead of slide
      const current = slideEls[index];
      if (current && isCompare(current)) {
        e.preventDefault();
        if (!advanceWithinSlide()) return; // do nothing if already fully revealed
      }
      return;
    }
    e.preventDefault();
    next();
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function toggleOverview() {
    document.body.classList.toggle('overview');
    deck.classList.toggle('overview');
  }

  function exitModes() {
    document.body.classList.remove('overview');
    deck.classList.remove('overview');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  // Initialize phases for compare slides at load
  slideEls.forEach((el) => resetPhases(el));

  // Initialize to the chosen starting slide
  setIndex(index, true, false);

  // Sync with URL hash (#n)
  window.addEventListener('hashchange', () => {
    const n = getIndexFromHash();
    if (n !== null) setIndex(n, false);
  });

  // Mobile mode detection: matches CSS breakpoint
  function isMobileMode() {
    return window.matchMedia('(max-width: 820px)').matches;
  }

  // Apply/remove mobile class on resize
  function applyResponsiveMode() {
    if (isMobileMode() && !deck.classList.contains('mobile')) {
      deck.classList.add('mobile');
    } else if (!isMobileMode() && deck.classList.contains('mobile')) {
      deck.classList.remove('mobile');
    }
  }
  applyResponsiveMode();
  window.addEventListener('resize', () => { applyResponsiveMode(); });

  // THEME: light/dark with persistence
  (function initTheme() {
    const root = document.documentElement;
    const storageKey = 'slides-theme';
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem(storageKey);

    const apply = (theme) => {
      if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
        setToggleIcon('light');
      } else {
        root.removeAttribute('data-theme'); // default dark
        setToggleIcon('dark');
      }
    };

    const initial = saved || (prefersDark ? 'dark' : 'light');
    apply(initial);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const isLight = root.getAttribute('data-theme') === 'light';
        const nextTheme = isLight ? 'dark' : 'light';
        apply(nextTheme);
        localStorage.setItem(storageKey, nextTheme);
      });
    }

    // Update on system change if user hasn't set preference
    if (!saved && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', (e) => {
        apply(e.matches ? 'dark' : 'light');
      });
    }

    function setToggleIcon(theme) {
      const btn = document.getElementById('theme-toggle');
      if (!btn) return;
      btn.textContent = theme === 'light' ? '🌙' : '☀️';
      const sr = btn.querySelector('.sr-only');
      if (sr) sr.textContent = `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`;
    }
  })();
})();


