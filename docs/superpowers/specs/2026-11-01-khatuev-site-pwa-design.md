# PWA for the Khatuev literary site

## Status

The user selected the recommended offline scope: site pages and essential site resources are available offline; PDF books and audio remain online. This document is the review checkpoint before implementation.

## Goal

Let readers install the existing literary site on Android and iPhone as an app-like home-screen shortcut, with the site's identity and a useful offline experience for its main pages.

## Current project context

- The site is a static HTML/CSS/JavaScript website published on GitHub Pages under `/KhatuevSite/` and served over HTTPS.
- The main pages are `index.html`, `knigi.html`, `stikhi.html`, `kontakty.html`, and `reader.html`.
- The pages share `js/main.js`; books are displayed by the in-site reader using local PDF.js files.
- There is no web app manifest or service worker yet.
- The site already has a dark, bronze-and-cream visual identity and a Chechen rosette SVG that can inform the app icon.
- The current working tree contains unrelated uncommitted work. PWA changes must be kept scoped and must not absorb that work.

## Design

### Installation and appearance

Add a web app manifest with the existing site name, a short home-screen name, standalone display mode, theme and background colors matched to the site, and a `start_url` and `scope` that remain inside `/KhatuevSite/`. Provide standard 192×192 and 512×512 icons, including a maskable option, and an Apple touch icon derived from the existing rosette and dark background. Link the manifest and touch icon from every page and set the theme color metadata consistently.

On Android, installation is offered by the supporting browser. On iPhone, readers use Safari's Share menu and choose Add to Home Screen; standalone display metadata opens the saved site without normal browser chrome.

### Offline behavior

Add a root-level service worker, registered only where the browser supports it and the page is in a secure context. Its scope must resolve to the repository subpath, not the domain root. On installation, precache the five main HTML pages, the offline fallback page, the shared scripts and stylesheets needed by those pages, and the PWA icons. Use network-first behavior for page navigations, falling back to the cached page or a branded offline page; use cache-first with background refresh for versioned same-origin static assets. Version caches and remove obsolete versions on activation.

Do not precache or retain `files/*.pdf` or `audio/**` in the service-worker cache. They remain available online through the current reader and audio player. If a reader opens a book while offline, the existing PDF loading/error state is shown; this PWA change does not add a second offline copy of the book.

Pages opened from `file://` or unsupported browsers continue to work normally and skip service-worker registration. External font requests need not be cached; existing fallback fonts remain available offline.

## Scope boundaries

- No changes to poem text, reader controls, audio behavior, or visible download links.
- No automatic caching of books or recordings and no new download UI.
- No unrelated cleanup or staging of pre-existing working-tree changes.
- Publish the completed PWA change to the existing GitHub Pages site after implementation and source review.

## Acceptance criteria

- Every main page links to a valid manifest and the same app identity.
- Manifest icons have the declared dimensions and include maskable support.
- The service worker registers at the site's repository subpath over HTTPS, without claiming paths outside the site.
- The five main pages and essential local UI resources can be served after an initial online visit; an un-cached navigation without a connection receives the branded fallback.
- PDFs and MP3s are excluded from offline caches and continue to load over the network.
- Unsupported contexts such as `file://` do not produce registration errors that interfere with the site.
- Only PWA-related changes are committed and published; current unrelated edits remain unstaged and uncommitted.

## Review and validation approach

Review the final source diff to ensure the service-worker scope and precache paths include `/KhatuevSite/` correctly and exclude PDFs and audio. Before claiming install/offline support, verify manifest metadata, icon dimensions, service-worker registration and update behavior, and online/offline navigation on a phone-sized browser viewport. Do not run a production build because the site has no build step. Report the limits of desktop-only QA if physical iPhone or Android devices are unavailable.
