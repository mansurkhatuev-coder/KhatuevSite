export const POEM_EXPORT_FORMATS = {
  story: { width: 1080, height: 1920, label: 'История / статус' },
  post: { width: 1080, height: 1350, label: 'Публикация' },
};

export function extractSectionLines(section) {
  const walker = document.createTreeWalker(
    section,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        return node.nodeType === Node.TEXT_NODE || node.tagName === 'BR'
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    }
  );

  let text = '';
  let lineStart = 0;
  let firstText = true;
  let afterBreak = false;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.ELEMENT_NODE) {
      // Newlines and indentation on either side of a <br> are HTML formatting.
      const currentLine = text.slice(lineStart);
      const cleanedLine = currentLine.replace(/(?:\r?\n[\t ]*)+$/, '');
      text = text.slice(0, lineStart) + cleanedLine + '\n';
      lineStart = text.length;
      afterBreak = true;
      continue;
    }

    let value = node.nodeValue || '';
    if (firstText || afterBreak) {
      value = value.replace(/^(?:[\t ]*\r?\n)+[\t ]*/, '');
    }
    text += value;
    firstText = false;
    afterBreak = false;
  }

  const lines = text.split(/\r?\n/);
  while (lines.length && /^[\t ]*$/.test(lines[0])) lines.shift();
  while (lines.length && /^[\t ]*$/.test(lines[lines.length - 1])) lines.pop();
  return lines;
}

export function readPoem(poemElement) {
  const body = poemElement.querySelector('.poem-body');
  if (!body) {
    throw new Error('Cannot read poem: .poem-body is missing.');
  }

  const sections = [...body.children]
    .filter(element => element.classList.contains('poem-stanza') ||
                       element.classList.contains('poem-refrain'))
    .map(element => {
      const lines = extractSectionLines(element);
      return {
        kind: element.classList.contains('poem-refrain') ? 'refrain' : 'stanza',
        text: lines.join('\n'),
        lines,
      };
    })
    .filter(section => section.lines.some(line => line.length > 0));

  const author = document.querySelector('.footer__logo')?.textContent
    .replace(/\s+/g, ' ').trim() || 'Хатуев Абдул-Хамид';

  return {
    id: poemElement.id,
    title: poemElement.querySelector('.poem-block__title')?.textContent.trim() || '',
    meta: poemElement.querySelector('.poem-block__year')?.textContent.trim() || '',
    language: poemElement.dataset.language || '',
    author,
    sections,
  };
}

export function captureSelectedExcerpt(poemElement) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return '';

  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode ||
      !poemElement.contains(anchorNode) || !poemElement.contains(focusNode)) return '';

  const text = selection.toString();
  return text.trim() ? text : '';
}

/** maxLinesPerFrame counts text lines and one visual gap between sections. */
export function splitIntoFrames(sections, maxLinesPerFrame) {
  if (!Number.isInteger(maxLinesPerFrame) || maxLinesPerFrame < 1) {
    throw new RangeError('maxLinesPerFrame must be a positive integer');
  }

  const frames = [];
  let current = [];
  let lineCount = 0;

  const flush = () => {
    if (current.length) frames.push(current);
    current = [];
    lineCount = 0;
  };

  for (const section of sections) {
    const lines = section.lines;
    if (!lines.length) continue;

    if (lines.length > maxLinesPerFrame) {
      flush();
      for (let start = 0; start < lines.length; start += maxLinesPerFrame) {
        const part = lines.slice(start, start + maxLinesPerFrame);
        current.push({ ...section, lines: part, text: part.join('\n') });
        lineCount = part.length;
        if (start + part.length < lines.length) flush();
      }
      continue;
    }

    const gap = current.length ? 1 : 0;
    if (lineCount + gap + lines.length > maxLinesPerFrame) flush();

    const nextGap = current.length ? 1 : 0;
    current.push({ ...section, lines, text: lines.join('\n') });
    lineCount += nextGap + lines.length;
  }

  flush();
  return frames.map((frameSections, index) => ({
    index: index + 1,
    count: frames.length,
    sections: frameSections,
  }));
}
