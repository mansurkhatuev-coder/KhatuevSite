# Smart poem search + TOC sticky fix

Date: 2026-09-08  
Page: `stikhi.html`  
Approach: client-only hybrid search (normalize → exact → bigrams)

## Goal

1. Add smart search over all poem text (title, subtitle/year, body).
2. Keep the left TOC («Содержание») visible while reading poems — it must not disappear near the bottom of the page.

## Out of scope

- Server-side search, external libraries (Fuse/MiniSearch), search on other pages.
- Changing poem content or adding new poems.

## UI

- Search input at the **top of the left TOC**, under the «Содержание» label.
- Placeholder e.g. «Найти стих…»; clear control (button and/or Escape).
- Debounce ~150ms.
- While query is non-empty:
  - TOC lists only matching poems, ordered by relevance (exact matches first, then bigram score).
  - Poem blocks that do not match are hidden (`hidden` / class); matching blocks keep **document order**.
  - Empty state: short message in TOC («Ничего не найдено»).
- Optional: light highlight of the query in TOC titles when exact substring matches; no heavy markup in poem bodies required for v1.
- Mobile: same input above the chip-style TOC list.

## Search logic

Built once on load into an in-memory index per `.poem-block`:

| Field | Source |
|-------|--------|
| title | `.poem-block__title` |
| meta | `.poem-block__year` |
| body | `.poem-body` text (after existing wrap-in-`poem-body` logic) |

**Normalize** (query and corpus):

- lowercase
- map `ё` → `е`
- unify Chechen Latin/Cyrillic lookalikes used on the site: `I` / `Ӏ` / `І` / `ӏ` → one canonical char
- collapse whitespace; strip punctuation noise for matching (keep letters/digits)

**Rank:**

1. Exact: normalized query is a substring of normalized title/meta/body → highest score (prefer title hits over body).
2. Bigrams: character bigrams of the query vs each field; Dice coefficient (or Jaccard). Use for ranking when exact is absent or to order partial typos. Drop results below a fixed threshold (tune ~0.35–0.5 on real titles).
3. Empty query → show all poems and full TOC in original order.

No network; all in `js/main.js` (or a small `js/poem-search.js` included only from `stikhi.html` if `main.js` grows unwieldy — prefer extending existing poems TOC block first).

## TOC sticky fix

**Problem:** Sticky aside scrolls away near the bottom when its containing block ends (and/or broken closing tags shrink the sticky ancestor).

**Fix:**

1. Audit/fix HTML structure in `stikhi.html`: `section.section` → `.container` → `.poems-layout` → (`aside.poems-toc` + `.poems-main`); all wrappers closed before footer.
2. Ensure `.poems-layout` spans the full poems height so `position: sticky` on `.poems-toc` remains active until the last poem leaves the viewport (sticky naturally releases only when the layout bottom passes).
3. When IntersectionObserver marks a poem active, `scrollIntoView({ block: 'nearest' })` on the corresponding TOC link **inside** `.poems-toc` (not the page), so the active item stays visible in the TOC scroller.
4. Do not hide the site header; only the left TOC was in scope.

## Components / files

| File | Change |
|------|--------|
| `stikhi.html` | Search input markup in TOC; fix wrapper closing tags; bump `?v=` on CSS/JS |
| `css/style.css` | Styles for search field, clear button, empty state; sticky/layout tweaks if needed |
| `js/main.js` | Index build, normalize, exact + bigram rank, filter TOC/poems, TOC `scrollIntoView` |

## Error / edge cases

- Query of 1 character: exact substring only; skip bigrams (need ≥2 chars).
- Title `★ ★ ★` stays labeled «Без названия» in TOC; searchable via body/meta.
- `prefers-reduced-motion`: no special search motion; keep existing site behavior.
- Very long query: still fine client-side given ~tens of poems.

## Testing

- Manual: type partial Chechen title with typo → still finds poem; Russian subtitle find; line from mid-poem find.
- Clear / Escape restores full list and all blocks.
- Scroll from first to last poem: TOC stays sticky; active link remains in TOC viewport.
- Near footer: TOC may unstick only after the poems layout ends — not mid-last-poems.
- Mobile width &lt;900px: search + filtered chips work.

## Success criteria

- Hybrid search over full poem text from TOC input.
- Left TOC does not vanish while reading poems near the bottom.
- No new dependencies.
