# Smart Poem Search + TOC Sticky Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hybrid (exact + bigram) full-text poem search in the TOC, and keep the sticky TOC visible for the entire poems list.

**Architecture:** Client-only search in `js/main.js` after TOC build: normalize → exact substring → Dice bigrams. Filter TOC links and `.poem-block` visibility. Fix premature `</div>` closers so `.poems-layout` wraps all poems.

**Tech Stack:** Static HTML/CSS/JS (no new dependencies). Manual browser checks; small Node assert script for normalize/bigrams.

**Spec:** `docs/superpowers/specs/2026-09-08-smart-poem-search-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `stikhi.html` | Search markup in TOC; move closing wrappers to after last poem; bump asset `?v=` |
| `css/style.css` | Search field, clear btn, empty state, `.is-search-hidden` |
| `js/main.js` | Index, search, filter, TOC `scrollIntoView` |
| `js/poem-search-lib.js` | Pure helpers (normalize, bigrams, score) — optional extract if cleaner; prefer keep in `main.js` unless file gets huge |
| `scripts/test-poem-search.mjs` | Node unit checks for normalize/score |

---

### Task 1: Fix poems-layout HTML wrappers

**Files:**
- Modify: `stikhi.html` (~L1178–1179 and ~L3443–3445)

**Context:** Parser shows `poems-main` closes ~L1178 and `poems-layout` ~L1179, while poems continue to ~L3441 inside `.container` only. Sticky TOC dies mid-page.

- [ ] **Step 1: Remove premature closers**

Find the early `</div></div>` that close `poems-main` / `poems-layout` (around the Chechen→Russian section boundary). Delete those two closers only.

- [ ] **Step 2: Close wrappers after last poem**

Before `</section>`, ensure order:

```html
      </div><!-- last poem-block -->

        </div><!-- poems-main -->
      </div><!-- poems-layout -->
    </div><!-- container -->
  </section>
```

- [ ] **Step 3: Verify structure**

Run:

```bash
python -c "from html.parser import HTMLParser
# same stack script as exploration — poems-main and poems-layout must close near end (~3444)"
```

Expected: `poems-main` and `poems-layout` close after the last poem, not near L1178.

- [ ] **Step 4: Commit**

```bash
git add stikhi.html
git commit -m "fix: keep poems-layout wrapping all poems for sticky TOC"
```

---

### Task 2: Search UI markup + CSS

**Files:**
- Modify: `stikhi.html` (aside.poems-toc)
- Modify: `css/style.css` (poems TOC section)

- [ ] **Step 1: Add search controls in TOC**

Replace/extend aside content:

```html
<aside class="poems-toc reveal" aria-label="Оглавление">
  <div class="poems-toc__label">Содержание</div>
  <div class="poems-toc__search">
    <input type="search" id="poems-search" class="poems-toc__search-input"
           placeholder="Найти стих…" autocomplete="off" enterkeyhint="search">
    <button type="button" class="poems-toc__search-clear" id="poems-search-clear"
            aria-label="Очистить" hidden>&times;</button>
  </div>
  <p class="poems-toc__empty" id="poems-search-empty" hidden>Ничего не найдено</p>
  <ul class="poems-toc__list" id="poems-toc"></ul>
</aside>
```

- [ ] **Step 2: CSS**

Add after `.poems-toc__label`:

```css
.poems-toc__search {
  position: relative;
  margin-bottom: 0.85rem;
}
.poems-toc__search-input {
  width: 100%;
  padding: 0.5rem 1.75rem 0.5rem 0.7rem;
  font-family: var(--ff-body);
  font-size: 0.82rem;
  color: var(--cream);
  background: rgba(200,168,120,0.06);
  border: 1px solid var(--border);
  border-radius: 2px;
  outline: none;
}
.poems-toc__search-input:focus {
  border-color: rgba(200,168,120,0.45);
}
.poems-toc__search-input::placeholder { color: var(--muted); }
.poems-toc__search-clear {
  position: absolute;
  right: 0.35rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.25rem;
}
.poems-toc__search-clear:hover { color: var(--cream); }
.poems-toc__empty {
  font-size: 0.78rem;
  color: var(--muted);
  padding: 0.35rem 0.7rem 0.75rem;
}
.poem-block.is-search-hidden,
.poems-lang-header.is-search-hidden,
.poems-toc__list > li.is-search-hidden {
  display: none !important;
}
```

Bump `css/style.css?v=6` → `?v=7` and `main.js?v=6` → `?v=7` on `stikhi.html`.

- [ ] **Step 3: Commit**

```bash
git add stikhi.html css/style.css
git commit -m "feat: add poem search field in TOC"
```

---

### Task 3: Search helpers + unit script

**Files:**
- Create: `scripts/test-poem-search.mjs`
- Modify: `js/main.js` (add helpers at top of poems block or as functions in IIFE)

- [ ] **Step 1: Write test script**

```js
// scripts/test-poem-search.mjs
import assert from 'node:assert/strict';

function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[iіӀӏ]/g, 'i')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(s) {
  const t = normalize(s);
  if (t.length < 2) return new Set();
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function dice(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

function scorePoem(query, { title, meta, body }) {
  const q = normalize(query);
  if (!q) return 1;
  const fields = [
    { text: title, w: 3 },
    { text: meta, w: 2 },
    { text: body, w: 1 },
  ];
  let best = 0;
  for (const { text, w } of fields) {
    const n = normalize(text);
    if (!n) continue;
    if (n.includes(q)) best = Math.max(best, 100 * w);
    else if (q.length >= 2) best = Math.max(best, dice(q, n) * 10 * w);
  }
  return best;
}

assert.equal(normalize('Ёлка Iаьржа'), 'елка iаьржа');
assert.ok(normalize('Нохчийчоь').includes('нохчийчо'));
assert.ok(scorePoem('Нохчйчо', { title: 'Бусулба сан Нохчийчоь', meta: '', body: '' }) > 5);
assert.ok(scorePoem('Песнь орла', { title: 'Аьрзунан илли', meta: '«Песнь орла» · 1997', body: '' }) >= 200);
assert.equal(scorePoem('zzzqqq', { title: 'Аьрзунан', meta: '', body: '' }) < 3.5, true);

console.log('ok');
```

Threshold note: fuzzy threshold in UI will be `score >= 3.5` (tune if needed).

- [ ] **Step 2: Run tests**

```bash
node scripts/test-poem-search.mjs
```

Expected: `ok`

- [ ] **Step 3: Port the same three functions into `js/main.js` poems block** (copy identical logic; no module bundler).

- [ ] **Step 4: Commit**

```bash
git add scripts/test-poem-search.mjs js/main.js
git commit -m "feat: add normalize and bigram scoring helpers"
```

---

### Task 4: Wire search + filter + active TOC scroll

**Files:**
- Modify: `js/main.js` (poems TOC section)

- [ ] **Step 1: After building TOC links, build index**

```js
const entries = poems.map((poem, i) => {
  const titleEl = poem.querySelector('.poem-block__title');
  const title = (titleEl?.textContent || '').trim();
  const meta = (poem.querySelector('.poem-block__year')?.textContent || '').trim();
  const body = (poem.querySelector('.poem-body')?.textContent || '').trim();
  const link = tocLinks.find(a => a.dataset.poemId === poem.id);
  return { poem, link, title, meta, body, li: link?.parentElement };
});
```

- [ ] **Step 2: setActive scrolls TOC link into view**

```js
const setActive = (id) => {
  tocLinks.forEach(l => {
    const on = l.dataset.poemId === id;
    l.classList.toggle('active', on);
    if (on) l.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
};
```

- [ ] **Step 3: applySearch(query)**

- Score each entry; `THRESHOLD = 3.5`
- Empty query: show all `li`, all poems, all `.poems-lang-header`, hide empty msg, clear btn hidden
- Non-empty: hide non-matching poems + their TOC `li`; hide group headers with no visible links after them until next group; show empty msg if zero matches
- Reorder TOC: for filtered mode, optionally leave DOM order and only hide — **spec says TOC ordered by relevance**. Reorder by moving `li` nodes: sort matching by score desc, append after group headers carefully OR flatten during search (simpler: keep document order for v1 if reorder is fragile — **follow spec: reorder matching links**).

Practical approach matching spec:

```js
function applySearch(raw) {
  const q = raw.trim();
  const emptyEl = document.getElementById('poems-search-empty');
  const clearBtn = document.getElementById('poems-search-clear');
  clearBtn.hidden = !q;
  if (!q) {
    entries.forEach(e => {
      e.poem.classList.remove('is-search-hidden');
      e.li?.classList.remove('is-search-hidden');
    });
    tocList.querySelectorAll('.poems-toc__group').forEach(g => g.classList.remove('is-search-hidden'));
    document.querySelectorAll('.poems-lang-header').forEach(h => h.classList.remove('is-search-hidden'));
    emptyEl.hidden = true;
    return;
  }
  const ranked = entries.map(e => ({ e, s: scorePoem(q, e) }))
    .filter(x => x.s >= 3.5)
    .sort((a, b) => b.s - a.s);
  const hit = new Set(ranked.map(x => x.e.poem));
  entries.forEach(e => {
    const ok = hit.has(e.poem);
    e.poem.classList.toggle('is-search-hidden', !ok);
    e.li?.classList.toggle('is-search-hidden', !ok);
  });
  // move visible li to top of list (after rebuilding groups visibility)
  ranked.forEach(({ e }) => { if (e.li) tocList.appendChild(e.li); });
  tocList.querySelectorAll('.poems-toc__group').forEach(g => g.classList.add('is-search-hidden'));
  document.querySelectorAll('.poems-lang-header').forEach(h => {
    let n = h.nextElementSibling, any = false;
    while (n && !n.classList.contains('poems-lang-header')) {
      if (n.classList.contains('poem-block') && !n.classList.contains('is-search-hidden')) any = true;
      n = n.nextElementSibling;
    }
    h.classList.toggle('is-search-hidden', !any);
  });
  emptyEl.hidden = ranked.length > 0;
}
```

On clear, rebuild original TOC order by re-appending group+li in original sequence (store `originalOrder` array of nodes when first building TOC).

- [ ] **Step 4: Events**

```js
const input = document.getElementById('poems-search');
const clearBtn = document.getElementById('poems-search-clear');
let t = null;
input?.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => applySearch(input.value), 150);
});
clearBtn?.addEventListener('click', () => {
  input.value = '';
  applySearch('');
  input.focus();
});
input?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { input.value = ''; applySearch(''); }
});
```

- [ ] **Step 5: Manual check + commit**

Open `stikhi.html`: search «орла», typo title, scroll to bottom — TOC sticky. Escape clears.

```bash
git add js/main.js
git commit -m "feat: wire hybrid poem search and TOC active scroll"
```

---

### Task 5: Verification pass

- [ ] **Step 1:** `node scripts/test-poem-search.mjs` → `ok`
- [ ] **Step 2:** Browser: sticky TOC through last poems; search hybrid; mobile chips + search
- [ ] **Step 3:** Mark plan checkboxes done in this file if desired

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Hybrid exact + bigrams | 3–4 |
| Full text index | 4 |
| TOC search UI | 2 |
| Sticky TOC full height | 1 |
| Active link scrollIntoView | 4 |
| No new deps | all |
| Empty / Escape / debounce | 4 |
