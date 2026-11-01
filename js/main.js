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
  const drawerLinks = [...(drawer?.querySelectorAll('a[href]') || [])];

  const setDrawerOpen = (open, returnFocus = false) => {
    if (!hamburger || !drawer) return;
    hamburger.classList.toggle('open', open);
    drawer.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
    drawer.inert = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) drawerLinks[0]?.focus({ preventScroll: true });
    else if (returnFocus) hamburger.focus({ preventScroll: true });
  };

  hamburger?.addEventListener('click', () => {
    setDrawerOpen(hamburger.getAttribute('aria-expanded') !== 'true');
  });

  drawerLinks.forEach(link => link.addEventListener('click', () => setDrawerOpen(false)));
  drawer?.addEventListener('click', (event) => {
    if (event.target === drawer) setDrawerOpen(false, true);
  });
  document.addEventListener('keydown', (event) => {
    if (!drawer?.classList.contains('open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setDrawerOpen(false, true);
      return;
    }
    if (event.key !== 'Tab' || !drawerLinks.length) return;
    const first = drawerLinks[0];
    const last = drawerLinks[drawerLinks.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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
      .normalize('NFC')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/(?<=\p{Script=Cyrillic})1|1(?=\p{Script=Cyrillic})/gu, 'i')
      .replace(/[iіӀӏⅠ]/g, 'i')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const normalizeWithOffsets = (value) => {
      const units = [];
      let sourceOffset = 0;
      for (const character of String(value)) {
        const end = sourceOffset + character.length;
        if (/\p{M}/u.test(character) && units.length) {
          units[units.length - 1].text += character;
          units[units.length - 1].end = end;
        } else {
          units.push({ text: character, start: sourceOffset, end });
        }
        sourceOffset = end;
      }

      const isCyrillic = (character) => Boolean(character && /\p{Script=Cyrillic}/u.test(character));
      let text = '';
      const starts = [];
      const ends = [];
      units.forEach((unit, i) => {
        let mapped = unit.text.normalize('NFC').toLowerCase().replace(/ё/g, 'е');
        if (unit.text === '1' && (isCyrillic(units[i - 1]?.text) || isCyrillic(units[i + 1]?.text))) mapped = 'i';
        mapped = mapped
          .replace(/[iіӀӏⅠ]/g, 'i')
          .replace(/[^\p{L}\p{N}\s]+/gu, ' ');

        for (const outputChar of mapped) {
          if (/\s/u.test(outputChar)) {
            if (text && text[text.length - 1] !== ' ') {
              text += ' ';
              starts.push(unit.start);
              ends.push(unit.end);
            }
            continue;
          }
          text += outputChar;
          starts.push(unit.start);
          ends.push(unit.end);
        }
      });

      if (text.endsWith(' ')) {
        text = text.slice(0, -1);
        starts.pop();
        ends.pop();
      }
      return { text, starts, ends };
    };

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
      if (titleN === q) best = Math.max(best, 500);
      else if (titleN.includes(q)) best = Math.max(best, 300);
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
    const poemsMain = document.querySelector('.poems-main');
    const readingThemeButtons = [];
    let isDarkReadingTheme = false;
    try { isDarkReadingTheme = localStorage.getItem('poem-reading-theme') === 'dark'; } catch {}
    const setReadingTheme = (isDark, persist = false) => {
      isDarkReadingTheme = isDark;
      poems.forEach(poem => poem.classList.toggle('is-dark', isDark));
      readingThemeButtons.forEach(button => {
        button.setAttribute('aria-pressed', String(isDark));
        button.setAttribute('aria-label', isDark ? 'Включить светлую тему' : 'Включить тёмную тему');
        button.innerHTML = isDark
          ? '<span class="poem-theme-toggle__icon" aria-hidden="true">☼</span><span>Светлая тема</span>'
          : '<span class="poem-theme-toggle__icon" aria-hidden="true">☾</span><span>Тёмная тема</span>';
      });
      if (persist) {
        try { localStorage.setItem('poem-reading-theme', isDark ? 'dark' : 'light'); } catch {}
      }
    };
    const sizeOutput = document.getElementById('reading-size');
    let readingSize = 100;
    try { readingSize = Number(localStorage.getItem('poem-reading-size')) || 100; } catch {}
    const updateReadingSize = () => {
      readingSize = Math.max(90, Math.min(130, readingSize));
      poemsMain.style.setProperty('--reading-scale', readingSize / 100);
      if (sizeOutput) sizeOutput.textContent = `${readingSize}%`;
      document.querySelectorAll('[data-reading-size]').forEach(button => {
        button.disabled = button.dataset.readingSize === 'smaller' ? readingSize <= 90 : readingSize >= 130;
      });
    };
    document.querySelectorAll('[data-reading-size]').forEach(button => button.addEventListener('click', () => {
      readingSize += button.dataset.readingSize === 'smaller' ? -10 : 10;
      updateReadingSize();
      try { localStorage.setItem('poem-reading-size', String(readingSize)); } catch {}
    }));
    updateReadingSize();
    const originalMainOrder = [...poemsMain.children];
    const poemIndex = document.querySelector('.poems-index');
    if (poemIndex && window.matchMedia('(min-width: 901px)').matches) poemIndex.open = true;
    let currentGroup = '';
    let currentLanguage = '';
    const tocOriginalOrder = [];

    poems.forEach((poem, i) => {
      const titleEl = poem.querySelector('.poem-block__title');
      const title = (titleEl?.textContent || `Стих ${i + 1}`).trim();
      const id = poem.id || `poem-${i + 1}`;
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
      let language = '';
      let node = poem.previousElementSibling;
      while (node) {
        if (node.classList?.contains('poems-lang-header')) {
          group = node.getAttribute('data-toc-group') || '';
          language = node.getAttribute('data-language') || '';
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

      currentLanguage = language || (group.includes('чечен') ? 'ce' : group.includes('русск') ? 'ru' : '');
      poem.dataset.language = currentLanguage;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${id}`;
      const titleSpan = document.createElement('span');
      titleSpan.textContent = title === '★ ★ ★' ? `Стихотворение № ${id.replace('poem-', '')}` : title;
      a.appendChild(titleSpan);
      const snippet = document.createElement('small');
      snippet.className = 'poems-toc__snippet';
      snippet.hidden = true;
      a.appendChild(snippet);
      a.dataset.poemId = id;
      a.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 900px)').matches && poemIndex) poemIndex.open = false;
        poem.classList.add('visible');
        poem.tabIndex = -1;
        poem.focus({ preventScroll: true });
      });
      li.appendChild(a);
      tocList.appendChild(li);
      tocOriginalOrder.push(li);

      const header = poem.querySelector('.poem-block__header');
      if (header) {
        const permalink = document.createElement('a');
        permalink.className = 'poem-permalink';
        permalink.href = `#${id}`;
        permalink.textContent = 'Ссылка на стихотворение';
        header.appendChild(permalink);

        const themeButton = document.createElement('button');
        themeButton.type = 'button';
        themeButton.className = 'poem-theme-toggle';
        themeButton.addEventListener('click', () => setReadingTheme(!isDarkReadingTheme, true));
        readingThemeButtons.push(themeButton);
        header.insertBefore(themeButton, header.firstChild);
      }
    });

    setReadingTheme(isDarkReadingTheme);
    const tocLinks = [...tocList.querySelectorAll('a')];


    const entries = poems.map((poem) => {
      const title = (poem.querySelector('.poem-block__title')?.textContent || '').trim();
      const meta = (poem.querySelector('.poem-block__year')?.textContent || '').trim();
      const body = (poem.querySelector('.poem-body')?.textContent || '').trim();
      const bodyIndex = normalizeWithOffsets(body);
      const link = tocLinks.find(a => a.dataset.poemId === poem.id);
      return { poem, link, title, meta, body, bodyIndex, language: poem.dataset.language, li: link?.parentElement };
    });

    const setActive = (id) => {
      tocLinks.forEach(l => {
        const on = l.dataset.poemId === id;
        l.classList.toggle('active', on);
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
    const languageFilter = document.getElementById('poems-language');
    const countEl = document.getElementById('poems-search-count');
    const indexSummary = poemIndex?.querySelector('summary');
    const highlightMatch = (element, query) => {
      if (!element) return;
      const text = element.textContent;
      element.textContent = '';
      const indexed = normalizeWithOffsets(text);
      const q = normalize(query);
      let cursor = 0;
      let match = q ? indexed.text.indexOf(q) : -1;
      while (match >= 0) {
        const start = indexed.starts[match];
        const end = indexed.ends[match + q.length - 1];
        element.appendChild(document.createTextNode(text.slice(cursor, start)));
        const mark = document.createElement('mark');
        mark.textContent = text.slice(start, end);
        element.appendChild(mark);
        cursor = end;
        match = indexed.text.indexOf(q, match + q.length);
      }
      element.appendChild(document.createTextNode(text.slice(cursor)));
    };

    const applySearch = (raw) => {
      const q = raw.trim();
      if (indexSummary) indexSummary.textContent = q ? 'Результаты поиска' : 'Все произведения';
      entries.forEach(e => highlightMatch(e.link?.querySelector('span'), q));
      const language = languageFilter?.value || '';
      if (poemIndex && !q && !language && window.matchMedia('(max-width: 900px)').matches) poemIndex.open = false;
      if (poemIndex && (q || language)) poemIndex.open = true;
      if (clearBtn) clearBtn.hidden = !q;

      if (!q && !language) {
        originalMainOrder.forEach(node => poemsMain.appendChild(node));
        entries.forEach(e => {
          e.poem.classList.remove('is-search-hidden');
          e.li?.classList.remove('is-search-hidden');
          const snippet = e.link?.querySelector('.poems-toc__snippet');
          if (snippet) {
            snippet.hidden = true;
            snippet.textContent = '';
          }
        });
        tocOriginalOrder.forEach(node => tocList.appendChild(node));
        tocList.querySelectorAll('.poems-toc__group').forEach(g => g.classList.remove('is-search-hidden'));
        document.querySelectorAll('.poems-lang-header').forEach(h => h.classList.remove('is-search-hidden'));
        if (emptyEl) emptyEl.hidden = true;
        if (countEl) countEl.textContent = `Всего: ${entries.length}`;
        return;
      }

      const ranked = entries
        .map(e => ({ e, s: scorePoem(q, e) }))
        .filter(x => (!language || x.e.language === language) && (!q || x.s >= SEARCH_THRESHOLD))
        .sort((a, b) => b.s - a.s);

      const hit = new Set(ranked.map(x => x.e.poem));
      ranked.forEach(({ e }) => poemsMain.appendChild(e.poem));
      entries.forEach(e => {
        const ok = hit.has(e.poem);
        e.poem.classList.toggle('is-search-hidden', !ok);
        e.li?.classList.toggle('is-search-hidden', !ok);
      });

      tocList.querySelectorAll('.poems-toc__group').forEach(g => g.classList.add('is-search-hidden'));
      ranked.forEach(({ e }) => {
        if (e.li) {
          const snippet = e.link?.querySelector('.poems-toc__snippet');
          const query = normalize(q);
          const index = query ? e.bodyIndex.text.indexOf(query) : -1;
          if (snippet) {
            if (!q) {
              snippet.hidden = true;
            } else if (index >= 0) {
              const start = e.bodyIndex.starts[index] ?? 0;
              const end = e.bodyIndex.ends[index + query.length - 1] ?? start;
              const from = Math.max(0, start - 34);
              const to = Math.min(e.body.length, end + 48);
              const excerpt = e.body.slice(from, to).replace(/\s+/g, ' ').trim();
              snippet.textContent = `${from ? '…' : ''}${excerpt}${to < e.body.length ? '…' : ''}`;
              snippet.hidden = false;
            } else {
              snippet.textContent = e.body.slice(0, 82).replace(/\s+/g, ' ').trim();
              snippet.hidden = !snippet.textContent;
            }
          }
          highlightMatch(snippet, q);
          e.li.classList.remove('is-search-hidden');
          tocList.appendChild(e.li);
        }
      });

      document.querySelectorAll('.poems-lang-header').forEach(h => h.classList.add('is-search-hidden'));

      if (emptyEl) emptyEl.hidden = ranked.length > 0;
      if (countEl) countEl.textContent = `Найдено: ${ranked.length}`;
    };

    let searchTimer = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applySearch(searchInput.value), 150);
    });
    languageFilter?.addEventListener('change', () => applySearch(searchInput?.value || ''));
    const initialQuery = new URLSearchParams(location.search).get('q') || '';
    if (searchInput) searchInput.value = initialQuery;
    applySearch(initialQuery);
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

  /* ── Shared player for the author's recordings ── */
  const voiceButtons = [...document.querySelectorAll('[data-voice-play]')];
  if (voiceButtons.length) {
    const player = document.createElement('aside');
    player.className = 'voice-player';
    player.hidden = true;
    player.setAttribute('role', 'region');
    player.setAttribute('aria-label', 'Проигрыватель аудиозаписей');
    player.innerHTML = `
      <div class="voice-player__track">
        <span class="voice-player__eyebrow">Голос автора</span>
        <strong class="voice-player__title"></strong>
        <span class="voice-player__status" aria-live="polite">Выберите запись</span>
      </div>
      <audio controls preload="none" aria-label="Управление воспроизведением"></audio>
      <button class="voice-player__close" type="button" aria-label="Закрыть проигрыватель"><span aria-hidden="true">×</span></button>
    `;
    document.body.appendChild(player);

    const audio = player.querySelector('audio');
    const playerTitle = player.querySelector('.voice-player__title');
    const playerStatus = player.querySelector('.voice-player__status');
    const closeButton = player.querySelector('.voice-player__close');
    let activeSource = '';
    let lastTrigger = null;

    const getButtonTitle = (button) => button.dataset.audioTitle || 'Аудиозапись';
    const getButtonSource = (button) => new URL(button.dataset.audioSrc, document.baseURI).href;
    const syncVoiceButtons = () => {
      voiceButtons.forEach((button) => {
        const selected = getButtonSource(button) === activeSource;
        const playing = selected && !audio.paused && !audio.ended;
        const label = button.querySelector('.voice-play__label');
        const icon = button.querySelector('.voice-play__icon');
        if (label) label.textContent = playing ? 'Пауза' : selected ? 'Продолжить' : 'Слушать';
        if (icon) icon.textContent = playing ? 'Ⅱ' : '▶';
        button.classList.toggle('is-current', selected);
        button.classList.toggle('is-playing', playing);
        button.setAttribute('aria-pressed', String(playing));
        button.setAttribute('aria-label', `${playing ? 'Приостановить' : selected ? 'Продолжить' : 'Слушать'} «${getButtonTitle(button)}»`);
      });
    };

    const showPlayer = () => {
      player.hidden = false;
      player.classList.remove('is-entering');
      requestAnimationFrame(() => player.classList.add('is-entering'));
      document.body.classList.add('has-voice-player');
    };

    voiceButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const source = getButtonSource(button);
        lastTrigger = button;
        if (source === activeSource && !audio.paused && !audio.ended) {
          audio.pause();
          return;
        }
        if (source !== activeSource) {
          activeSource = source;
          audio.src = source;
          playerTitle.textContent = getButtonTitle(button);
          playerStatus.textContent = 'Запись автора';
          audio.load();
        } else if (audio.ended) {
          audio.currentTime = 0;
        }
        showPlayer();
        syncVoiceButtons();
        audio.play().catch(() => {
          playerStatus.textContent = 'Не удалось открыть запись';
          syncVoiceButtons();
        });
      });
    });

    audio.addEventListener('play', () => {
      playerStatus.textContent = 'Сейчас звучит';
      syncVoiceButtons();
    });
    audio.addEventListener('pause', () => {
      if (!audio.ended) playerStatus.textContent = 'На паузе';
      syncVoiceButtons();
    });
    audio.addEventListener('ended', () => {
      playerStatus.textContent = 'Запись завершена';
      syncVoiceButtons();
    });
    audio.addEventListener('error', () => {
      playerStatus.textContent = 'Запись не удалось открыть';
      syncVoiceButtons();
    });
    closeButton.addEventListener('click', () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      activeSource = '';
      playerTitle.textContent = '';
      playerStatus.textContent = 'Выберите запись';
      player.hidden = true;
      player.classList.remove('is-entering');
      document.body.classList.remove('has-voice-player');
      syncVoiceButtons();
      lastTrigger?.focus({ preventScroll: true });
      lastTrigger = null;
    });
  }

})();
