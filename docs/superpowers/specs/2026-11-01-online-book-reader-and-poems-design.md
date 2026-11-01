# In-site book reading and PDF poems

## Status

Design approved by the user on 2026-11-01. This document is the review checkpoint before implementation.

## Goal

Let readers open the two available books inside the Khatuev site on phones and computers, without a visible download action. Add the previously absent poems from those books to the existing shared poem archive, while leaving prose and duplicate poems out.

## Current project context

- `files/1.pdf` is a 240-page text-based PDF for «Йахалахъ, Нохчийчоь».
- `files/2.pdf` is a 176-page text-based PDF for «Берийн ирс».
- `index.html`, `knigi.html`, and `kontakty.html` currently expose PDF download links; `knigi.html` also opens the raw PDF in a new tab.
- `stikhi.html` contains 82 poem blocks with stable `#poem-N` anchors. `js/main.js` builds the catalogue, search, and language grouping from `.poem-block` markup.

## Design

### Book reader

Add a same-site reader page that takes a book identifier, shows the book title and a return link, and renders the selected PDF inside the site's visual frame. Use the PDF.js browser library to render one page at a time, fitted to the available width, with page navigation, page count, and zoom controls. Include a loading state and a readable error with a return path when the file cannot be opened. Controls must have accessible labels and work at phone widths.

Replace PDF download actions on the home page, books page, and contacts page with links to this reader. Keep the source PDFs available to the reader, but do not show a download action in the site interface. Since this is a static site and the PDFs remain public files, the change removes the visible download path; it cannot prevent someone from saving a publicly accessible file URL.

### Poem archive

Extract poems from both PDFs and add only works not already represented in the shared archive. Exclude introductions, commentary, stories, and other prose. Compare title and opening lines with the current catalogue and with the other book before adding a poem. Record the source collection and printed page in each new block. Preserve all existing IDs and assign new IDs sequentially after `poem-82` so old poem links keep working. Use the existing `.poem-block` markup so the current search and catalogue continue to include the new works automatically.

Retain the spelling and stanza breaks shown in the books. The text layer is extractable, but extracted text must be checked against the PDF when line breaks, split words, titles, or Chechen characters are uncertain. Do not silently invent missing text.

## Acceptance criteria

- Both available books open in a page belonging to the site, including on a phone-sized layout.
- A reader can move between pages and adjust zoom; the reader has no visible download control.
- All book PDF links on the three existing pages lead to the reader, and no PDF download buttons or labels remain there.
- Every newly added poem has its source book and printed page recorded; no stories or exact duplicate poems are added.
- Existing poem IDs `poem-1` through `poem-82` remain unchanged; new poems appear in the existing catalogue and search.
- Viewer loading and file errors are understandable and let the reader return to the book list.

## Review and validation approach

Before implementation, review this scope and the limitation around publicly accessible static PDFs. During implementation, compare extracted poems with their source pages and check the reader layout and controls at desktop and phone widths. Do not run a production build or publish the site as part of this change.
