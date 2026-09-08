/* ═══════════════════════════════════
   Khatuev Site — main.js
═══════════════════════════════════ */

(function () {
  'use strict';

  /* ── Navigation scroll behavior ── */
  const nav = document.querySelector('.nav');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    if (nav) nav.classList.toggle('scrolled', current > 60);
    lastScroll = current;
  }, { passive: true });

  /* ── Mobile hamburger / drawer ── */
  const hamburger = document.querySelector('.nav__hamburger');
  const drawer = document.querySelector('.nav__drawer');

  hamburger?.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    drawer?.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // Close drawer on link click
  drawer?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  /* ── Active nav link ── */
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__links a, .nav__drawer a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  /* ── Scroll reveal (IntersectionObserver) ── */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  /* ── Hero photo parallax ── */
  const hero = document.querySelector('.hero');
  const photoShift = document.querySelector('.hero-photo-shift');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hero && photoShift && !reduceMotion) {
    let mx = 0, my = 0, tx = 0, ty = 0, sy = 0;
    const desktop = window.matchMedia('(min-width: 768px)').matches;

    if (desktop) {
      hero.addEventListener('mousemove', (e) => {
        const r = hero.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5;
        my = (e.clientY - r.top) / r.height - 0.5;
      }, { passive: true });
    }

    window.addEventListener('scroll', () => { sy = window.scrollY; }, { passive: true });

    const tick = () => {
      tx += (mx - tx) * 0.05;
      ty += (my - ty) * 0.05;
      const scrollN = Math.min(sy / (window.innerHeight || 1), 1);
      const x = tx * 24;
      const y = ty * 16 + scrollN * 70;
      photoShift.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── Stagger children inside grid on reveal ── */
  document.querySelectorAll('.books-grid, .contacts-grid').forEach(grid => {
    Array.from(grid.children).forEach((child, i) => {
      child.classList.add('reveal', `reveal-d${Math.min(i + 1, 5)}`);
      revealObs.observe(child);
    });
  });

  /* ── Poems: TOC + search + reading aids ── */
  const tocList = document.getElementById('poems-toc');
  if (tocList) {
    const SEARCH_THRESHOLD = 3.5;

    const normalize = (s) => String(s)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[iіӀӏⅠ]/g, 'i')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const bigrams = (s) => {
      const t = normalize(s);
      if (t.length < 2) return new Set();
      const out = new Set();
      for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
      return out;
    };

    const dice = (a, b) => {
      const A = bigrams(a);
      const B = bigrams(b);
      if (!A.size || !B.size) return 0;
      let inter = 0;
      for (const g of A) if (B.has(g)) inter++;
      return (2 * inter) / (A.size + B.size);
    };

    const bestDice = (query, text) => {
      const n = normalize(text);
      if (!n) return 0;
      let best = dice(query, n);
      for (const w of n.split(' ')) {
        if (w.length >= 2) best = Math.max(best, dice(query, w));
      }
      return best;
    };

    const scorePoem = (query, { title, meta, body }) => {
      const q = normalize(query);
      if (!q) return 1;
      let best = 0;
      const titleN = normalize(title);
      const metaN = normalize(meta);
      const bodyN = normalize(body);
      if (titleN.includes(q)) best = Math.max(best, 300);
      if (metaN.includes(q)) best = Math.max(best, 200);
      if (bodyN.includes(q)) best = Math.max(best, 100);
      if (q.length >= 2) {
        const dTitle = bestDice(q, title);
        if (dTitle >= 0.45) best = Math.max(best, dTitle * 30);
        const dMeta = bestDice(q, meta);
        if (dMeta >= 0.45) best = Math.max(best, dMeta * 20);
      }
      return best;
    };

    const poems = [...document.querySelectorAll('.poem-block')];
    let currentGroup = '';
    const tocOriginalOrder = [];

    poems.forEach((poem, i) => {
      const titleEl = poem.querySelector('.poem-block__title');
      const title = (titleEl?.textContent || `Стих ${i + 1}`).trim();
      const id = `poem-${i + 1}`;
      poem.id = id;

      if (!poem.querySelector('.poem-body')) {
        const body = document.createElement('div');
        body.className = 'poem-body';
        [...poem.children].forEach(child => {
          if (!child.classList.contains('poem-block__header')) body.appendChild(child);
        });
        poem.appendChild(body);
      }

      let group = '';
      let node = poem.previousElementSibling;
      while (node) {
        if (node.classList?.contains('poems-lang-header')) {
          group = node.getAttribute('data-toc-group') || '';
          break;
        }
        node = node.previousElementSibling;
      }

      if (group && group !== currentGroup) {
        currentGroup = group;
        const g = document.createElement('li');
        g.className = 'poems-toc__group';
        g.textContent = group;
        g.setAttribute('aria-hidden', 'true');
        tocList.appendChild(g);
        tocOriginalOrder.push(g);
      }

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${id}`;
      a.textContent = title === '★ ★ ★' ? 'Без названия' : title;
      a.dataset.poemId = id;
      li.appendChild(a);
      tocList.appendChild(li);
      tocOriginalOrder.push(li);
    });

    const tocLinks = [...tocList.querySelectorAll('a')];
    const tocScroller = tocList.closest('.poems-toc');

    const entries = poems.map((poem) => {
      const title = (poem.querySelector('.poem-block__title')?.textContent || '').trim();
      const meta = (poem.querySelector('.poem-block__year')?.textContent || '').trim();
      const body = (poem.querySelector('.poem-body')?.textContent || '').trim();
      const link = tocLinks.find(a => a.dataset.poemId === poem.id);
      return { poem, link, title, meta, body, li: link?.parentElement };
    });

    const setActive = (id) => {
      tocLinks.forEach(l => {
        const on = l.dataset.poemId === id;
        l.classList.toggle('active', on);
        if (on && tocScroller) {
          const li = l.parentElement;
          if (li && !li.classList.contains('is-search-hidden')) {
            l.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
        }
      });
    };

    const poemObs = new IntersectionObserver((entriesObs) => {
      entriesObs.forEach(entry => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    poems.forEach(p => poemObs.observe(p));
    if (poems[0]) setActive(poems[0].id);

    const emptyEl = document.getElementById('poems-search-empty');
    const clearBtn = document.getElementById('poems-search-clear');
    const searchInput = document.getElementById('poems-search');

    const applySearch = (raw) => {
      const q = raw.trim();
      if (clearBtn) clearBtn.hidden = !q;

      if (!q) {
        entries.forEach(e => {
          e.poem.classList.remove('is-search-hidden');
          e.li?.classList.remove('is-search-hidden');
        });
        tocOriginalOrder.forEach(node => tocList.appendChild(node));
        tocList.querySelectorAll('.poems-toc__group').forEach(g => g.classList.remove('is-search-hidden'));
        document.querySelectorAll('.poems-lang-header').forEach(h => h.classList.remove('is-search-hidden'));
        if (emptyEl) emptyEl.hidden = true;
        return;
      }

      const ranked = entries
        .map(e => ({ e, s: scorePoem(q, e) }))
        .filter(x => x.s >= SEARCH_THRESHOLD)
        .sort((a, b) => b.s - a.s);

      const hit = new Set(ranked.map(x => x.e.poem));
      entries.forEach(e => {
        const ok = hit.has(e.poem);
        e.poem.classList.toggle('is-search-hidden', !ok);
        e.li?.classList.toggle('is-search-hidden', !ok);
      });

      tocList.querySelectorAll('.poems-toc__group').forEach(g => g.classList.add('is-search-hidden'));
      ranked.forEach(({ e }) => {
        if (e.li) {
          e.li.classList.remove('is-search-hidden');
          tocList.appendChild(e.li);
        }
      });

      document.querySelectorAll('.poems-lang-header').forEach(h => {
        let n = h.nextElementSibling;
        let any = false;
        while (n && !n.classList.contains('poems-lang-header')) {
          if (n.classList.contains('poem-block') && !n.classList.contains('is-search-hidden')) any = true;
          n = n.nextElementSibling;
        }
        h.classList.toggle('is-search-hidden', !any);
      });

      if (emptyEl) emptyEl.hidden = ranked.length > 0;
    };

    let searchTimer = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applySearch(searchInput.value), 150);
    });
    clearBtn?.addEventListener('click', () => {
      if (!searchInput) return;
      searchInput.value = '';
      applySearch('');
      searchInput.focus();
    });
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        applySearch('');
      }
    });
  }

})();
