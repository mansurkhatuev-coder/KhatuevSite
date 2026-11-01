import { POEM_EXPORT_BACKGROUNDS } from './poem-export-backgrounds.js';
import { POEM_EXPORT_FORMATS } from './poem-export-content.js';

export { POEM_EXPORT_FORMATS };

export const POEM_EXPORT_PRESETS = {
  paperOverlay: { id: 'paperOverlay', label: 'Светлая подложка' },
  photoBacking: { id: 'photoBacking', label: 'Текст на фото' },
};

export const DEFAULT_POEM_EXPORT_OPTIONS = {
  formatId: 'story',
  presetId: 'paperOverlay',
  backgroundId: 'ushkaloy-dawn',
  darkening: 0.38,
  panelOpacity: 0.78,
};

const imagePromises = new Map();
let fontsReadyPromise;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getBackground(background) {
  const id = typeof background === 'string' ? background : background?.id;
  const match = POEM_EXPORT_BACKGROUNDS.find(item => item.id === id);
  if (!match) {
    throw new Error('Не удалось выбрать фон карточки. Выберите изображение из списка фонов.');
  }
  return match;
}

/** Load a local image from the static export manifest and cache its Promise. */
export function loadBackground(background) {
  let entry;
  try {
    entry = getBackground(background);
  } catch (error) {
    return Promise.reject(error);
  }

  const cached = imagePromises.get(entry.url);
  if (cached) return cached;

  const promise = new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Браузер не поддерживает загрузку изображения для карточки.'));
      return;
    }

    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error(`Фон «${entry.label}» загрузился без изображения.`));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error(`Не удалось загрузить фон «${entry.label}». Проверьте, что файл изображения доступен.`));
    };
    image.src = entry.url;
  });

  imagePromises.set(entry.url, promise);
  promise.catch(() => {
    if (imagePromises.get(entry.url) === promise) imagePromises.delete(entry.url);
  });
  return promise;
}

/** Draw an image with a cover crop centered on normalized focus coordinates. */
export function drawCoverImage(ctx, image, canvasWidth, canvasHeight, focusX = 0.5, focusY = 0.5) {
  const imageWidth = image?.naturalWidth || image?.width;
  const imageHeight = image?.naturalHeight || image?.height;
  if (!ctx || !Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) ||
      imageWidth <= 0 || imageHeight <= 0 || !Number.isFinite(canvasWidth) ||
      !Number.isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error('Не удалось разместить фон: размер изображения или карточки некорректен.');
  }

  const targetRatio = canvasWidth / canvasHeight;
  let sourceWidth = imageWidth;
  let sourceHeight = imageHeight;
  if (imageWidth / imageHeight > targetRatio) {
    sourceWidth = imageHeight * targetRatio;
  } else {
    sourceHeight = imageWidth / targetRatio;
  }

  const normalizedX = clamp(Number.isFinite(focusX) ? focusX : 0.5, 0, 1);
  const normalizedY = clamp(Number.isFinite(focusY) ? focusY : 0.5, 0, 1);
  const sourceX = clamp(normalizedX * imageWidth - sourceWidth / 2, 0, imageWidth - sourceWidth);
  const sourceY = clamp(normalizedY * imageHeight - sourceHeight / 2, 0, imageHeight - sourceHeight);

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvasWidth,
    canvasHeight
  );
}

function waitForFonts() {
  if (!fontsReadyPromise) {
    const ready = typeof document !== 'undefined' ? document.fonts?.ready : null;
    fontsReadyPromise = ready ? Promise.resolve(ready).catch(() => undefined) : Promise.resolve();
  }
  return fontsReadyPromise;
}

function fontString(size, family, italic = false) {
  const prefix = italic ? 'italic ' : '';
  if (family === 'display') return `${prefix}500 ${size}px "Cormorant Garamond", Georgia, serif`;
  return `${prefix}400 ${size}px "Crimson Pro", Georgia, serif`;
}

function measureWidth(ctx, text, font) {
  ctx.font = font;
  return ctx.measureText(text).width;
}

const combiningMarkPattern = (() => {
  try {
    return new RegExp('\\p{M}', 'u');
  } catch {
    return null;
  }
})();

function isCombiningMark(codePoint) {
  if (combiningMarkPattern?.test(codePoint)) return true;

  const value = codePoint.codePointAt(0);
  return (
    (value >= 0x0300 && value <= 0x036f) ||
    (value >= 0x0483 && value <= 0x0489) ||
    (value >= 0x0591 && value <= 0x05bd) ||
    value === 0x05bf ||
    (value >= 0x05c1 && value <= 0x05c2) ||
    (value >= 0x05c4 && value <= 0x05c5) ||
    (value >= 0x0610 && value <= 0x061a) ||
    (value >= 0x064b && value <= 0x065f) ||
    value === 0x0670 ||
    (value >= 0x06d6 && value <= 0x06ed) ||
    value === 0x0711 ||
    (value >= 0x0730 && value <= 0x074a) ||
    (value >= 0x07a6 && value <= 0x07b0) ||
    (value >= 0x07eb && value <= 0x07f3) ||
    (value >= 0x0816 && value <= 0x082d) ||
    (value >= 0x08d3 && value <= 0x0903) ||
    (value >= 0x093a && value <= 0x094f) ||
    (value >= 0x0981 && value <= 0x09cd) ||
    (value >= 0x0a01 && value <= 0x0a4d) ||
    (value >= 0x0a70 && value <= 0x0a71) ||
    (value >= 0x0b01 && value <= 0x0bcd) ||
    (value >= 0x0c00 && value <= 0x0ccd) ||
    (value >= 0x0d00 && value <= 0x0dca) ||
    (value >= 0x1ab0 && value <= 0x1aff) ||
    (value >= 0x1dc0 && value <= 0x1dff) ||
    (value >= 0x20d0 && value <= 0x20ff) ||
    (value >= 0xfe20 && value <= 0xfe2f)
  );
}

function isGraphemeExtender(codePoint) {
  const value = codePoint.codePointAt(0);
  return (
    isCombiningMark(codePoint) ||
    (value >= 0xfe00 && value <= 0xfe0f) ||
    (value >= 0xe0100 && value <= 0xe01ef) ||
    (value >= 0x1f3fb && value <= 0x1f3ff) ||
    (value >= 0xe0020 && value <= 0xe007f)
  );
}

function splitGraphemes(text) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), part => part.segment);
  }

  // Keep code points intact, then join the common multi-code-point grapheme forms.
  const codePoints = Array.from(text);
  const graphemes = [];
  let regionalIndicatorRun = 0;
  let previousWasJoiner = false;

  for (const codePoint of codePoints) {
    const value = codePoint.codePointAt(0);
    const isRegionalIndicator = value >= 0x1f1e6 && value <= 0x1f1ff;

    if (isRegionalIndicator) {
      if (regionalIndicatorRun % 2 === 1 && graphemes.length) {
        graphemes[graphemes.length - 1] += codePoint;
      } else {
        graphemes.push(codePoint);
      }
      regionalIndicatorRun += 1;
      previousWasJoiner = false;
      continue;
    }

    regionalIndicatorRun = 0;
    if (!graphemes.length || (!isGraphemeExtender(codePoint) && value !== 0x200d && !previousWasJoiner)) {
      graphemes.push(codePoint);
    } else {
      graphemes[graphemes.length - 1] += codePoint;
    }
    previousWasJoiner = value === 0x200d;
  }

  return graphemes;
}

function wrapExplicitLine(ctx, text, maxWidth, font) {
  const value = String(text ?? '');
  ctx.font = font;
  if (value === '') return [''];

  const tokens = value.match(/\s+|\S+/gu) || [];
  const result = [];
  let current = '';

  const appendGraphemes = token => {
    for (const grapheme of splitGraphemes(token)) {
      const candidate = current + grapheme;
      if (current && measureWidth(ctx, candidate, font) > maxWidth) {
        result.push(current);
        current = grapheme;
      } else {
        current = candidate;
      }
    }
  };

  for (const token of tokens) {
    if (measureWidth(ctx, current + token, font) <= maxWidth) {
      current += token;
      continue;
    }

    if (current) {
      result.push(current);
      current = '';
    }
    appendGraphemes(token);
  }

  if (current || !result.length) result.push(current);
  return result;
}

function wrapText(ctx, value, maxWidth, font) {
  return String(value ?? '').split(/\r\n|\n|\r/).flatMap(line =>
    wrapExplicitLine(ctx, line, maxWidth, font)
  );
}

function normalizeFrameSections(sections) {
  if (!Array.isArray(sections)) {
    throw new Error('В кадре не найдены строки стихотворения.');
  }

  return sections.map(section => {
    const sourceLines = Array.isArray(section?.lines) && section.lines.length
      ? section.lines
      : (typeof section?.text === 'string' ? section.text.split(/\r\n|\n|\r/) : []);
    const lines = sourceLines.flatMap(line => String(line ?? '').split(/\r\n|\n|\r/));
    return { kind: section?.kind === 'refrain' ? 'refrain' : 'stanza', lines };
  });
}

function wrapSections(ctx, sections, textWidth, fontSize) {
  return sections.map(section => {
    const font = fontString(fontSize, 'poem', section.kind === 'refrain');
    const lines = section.lines.flatMap(line => wrapExplicitLine(ctx, line, textWidth, font));
    return { kind: section.kind, lines };
  });
}

function poemBlockHeight(sections, lineHeight, sectionGap) {
  let total = 0;
  sections.forEach((section, index) => {
    total += section.lines.length * lineHeight;
    if (index < sections.length - 1) total += sectionGap;
  });
  return total;
}

function makeLayout(ctx, poem, frame, textWidth, maxBlockHeight, formatId) {
  const isStory = formatId === 'story';
  const poemStart = isStory ? 48 : 43;
  const poemMinimum = isStory ? 32 : 30;
  const titleStart = isStory ? 62 : 56;
  const titleMinimum = isStory ? 44 : 40;
  const titleText = String(poem.title || 'Без названия');
  const authorText = String(poem.author || 'Хатуев Абдул-Хамид');
  const normalizedSections = normalizeFrameSections(frame.sections);
  const frameCount = Number.isInteger(frame.count) && frame.count > 0 ? frame.count : 1;
  const frameIndex = Number.isInteger(frame.index) && frame.index > 0
    ? Math.min(frame.index, frameCount)
    : 1;
  const hasCounter = frameCount > 1;
  const titleLineHeightFactor = 1.08;
  const authorFontSize = isStory ? 29 : 27;
  const authorLineHeight = authorFontSize * 1.22;
  const counterHeight = hasCounter ? 26 : 0;

  for (let poemSize = poemStart; poemSize >= poemMinimum; poemSize -= 2) {
    const shrink = poemStart - poemSize;
    const titleSize = Math.max(titleMinimum, titleStart - shrink);
    const titleFont = fontString(titleSize, 'display');
    const titleLines = wrapText(ctx, titleText, textWidth, titleFont);
    const titleLineHeight = titleSize * titleLineHeightFactor;
    const sections = wrapSections(ctx, normalizedSections, textWidth, poemSize);
    const lineHeight = poemSize * 1.34;
    const stanzaGap = poemSize * 0.76;
    const poemHeight = poemBlockHeight(sections, lineHeight, stanzaGap);
    const authorFont = fontString(authorFontSize, 'poem');
    const authorLines = wrapText(ctx, authorText, textWidth, authorFont);
    const authorHeight = authorLines.length * authorLineHeight;

    const ornamentHeight = 24;
    const titleOffset = ornamentHeight + 18;
    const titleHeight = titleLines.length * titleLineHeight;
    const dividerOffset = titleOffset + titleHeight + 22;
    const poemOffset = dividerOffset + 1 + 32;
    const authorOffset = poemOffset + poemHeight + 34;
    const counterOffset = authorOffset + authorHeight + (hasCounter ? 15 : 0);
    const blockHeight = counterOffset + counterHeight + 12;

    if (blockHeight <= maxBlockHeight) {
      return {
        titleLines,
        titleSize,
        titleLineHeight,
        titleOffset,
        dividerOffset,
        sections,
        poemSize,
        lineHeight,
        stanzaGap,
        poemOffset,
        poemHeight,
        authorLines,
        authorFontSize,
        authorLineHeight,
        authorOffset,
        counterOffset,
        frameIndex,
        frameCount,
        hasCounter,
        blockHeight,
      };
    }
  }

  throw new Error('Текст не помещается на карточке при минимальном читаемом размере. Разделите его на большее число кадров.');
}

function drawOrnament(ctx, centerX, y, width, color) {
  const half = Math.min(46, width * 0.11);
  const sideInset = Math.min(56, width * 0.14);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(centerX - width / 2 + sideInset, y);
  ctx.lineTo(centerX - half, y);
  ctx.moveTo(centerX + half, y);
  ctx.lineTo(centerX + width / 2 - sideInset, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX, y - 7);
  ctx.lineTo(centerX + 7, y);
  ctx.lineTo(centerX, y + 7);
  ctx.lineTo(centerX - 7, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDivider(ctx, centerX, y, width, color) {
  const inset = width * 0.13;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - width / 2 + inset, y);
  ctx.lineTo(centerX + width / 2 - inset, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX, y - 4);
  ctx.lineTo(centerX + 4, y);
  ctx.lineTo(centerX, y + 4);
  ctx.lineTo(centerX - 4, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHairlineBorder(ctx, rect, isPaper) {
  const inset = 11;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isPaper ? 'rgba(124, 94, 46, 0.58)' : 'rgba(245, 235, 211, 0.52)';
  ctx.strokeRect(rect.x + inset, rect.y + inset, rect.width - inset * 2, rect.height - inset * 2);
  ctx.restore();
}

function drawLayout(ctx, layout, rect, textWidth, isPaper) {
  const centerX = rect.x + rect.width / 2;
  const blockY = rect.y + (rect.height - layout.blockHeight) / 2;
  const ink = isPaper ? '#292820' : '#FFF9ED';
  const accent = isPaper ? 'rgba(139, 105, 49, 0.7)' : 'rgba(239, 217, 173, 0.74)';
  const textX = centerX;

  drawOrnament(ctx, centerX, blockY + 12, Math.min(textWidth, 620), accent);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;
  ctx.font = fontString(layout.titleSize, 'display');
  layout.titleLines.forEach((line, index) => {
    ctx.fillText(line, textX, blockY + layout.titleOffset + (index + 0.84) * layout.titleLineHeight);
  });

  drawDivider(ctx, centerX, blockY + layout.dividerOffset, Math.min(textWidth, 680), accent);

  let y = blockY + layout.poemOffset;
  for (const section of layout.sections) {
    ctx.font = fontString(layout.poemSize, 'poem', section.kind === 'refrain');
    if (!isPaper) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
    }
    for (const line of section.lines) {
      ctx.fillText(line, textX, y + layout.poemSize * 0.86);
      y += layout.lineHeight;
    }
    y += layout.stanzaGap;
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = fontString(layout.authorFontSize, 'poem');
  layout.authorLines.forEach((line, index) => {
    ctx.fillText(line, textX, blockY + layout.authorOffset + (index + 0.84) * layout.authorLineHeight);
  });

  if (layout.hasCounter) {
    ctx.font = fontString(22, 'poem');
    ctx.fillStyle = isPaper ? 'rgba(63, 57, 44, 0.76)' : 'rgba(255, 249, 237, 0.88)';
    ctx.fillText(
      `${layout.frameIndex} / ${layout.frameCount}`,
      textX,
      blockY + layout.counterOffset + 20
    );
  }
  ctx.restore();
}

function createCanvas() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error('Для создания карточки нужен браузер с поддержкой Canvas.');
  }
  const canvas = document.createElement('canvas');
  if (!canvas.getContext) {
    throw new Error('Этот браузер не поддерживает Canvas для экспорта карточки.');
  }
  return canvas;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('Браузер не поддерживает экспорт карточки в PNG.'));
      return;
    }

    try {
      canvas.toBlob(blob => {
        if (!blob || blob.size <= 0) {
          reject(new Error('Не удалось создать PNG-файл карточки. Попробуйте ещё раз.'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    } catch {
      reject(new Error('Не удалось сохранить карточку в PNG. Попробуйте ещё раз.'));
    }
  });
}

/** Render one frame and return its exact-size canvas plus a PNG Blob. */
export async function renderPoemCard(frame, poem, options = {}) {
  if (!frame || !poem || typeof poem !== 'object') {
    throw new Error('Не удалось создать карточку: данные стихотворения или кадра отсутствуют.');
  }

  const settings = { ...DEFAULT_POEM_EXPORT_OPTIONS, ...(options || {}) };
  const format = POEM_EXPORT_FORMATS[settings.formatId];
  if (!format) throw new Error('Не удалось выбрать размер карточки. Выберите формат истории или публикации.');

  const preset = POEM_EXPORT_PRESETS[settings.presetId];
  if (!preset) throw new Error('Не удалось выбрать оформление карточки. Выберите один из доступных вариантов.');

  const backgroundEntry = getBackground(settings.backgroundId);
  const darkening = clamp(Number.isFinite(settings.darkening) ? settings.darkening : DEFAULT_POEM_EXPORT_OPTIONS.darkening, 0, 1);
  const panelOpacity = clamp(Number.isFinite(settings.panelOpacity) ? settings.panelOpacity : DEFAULT_POEM_EXPORT_OPTIONS.panelOpacity, 0, 1);

  const image = await loadBackground(backgroundEntry);
  await waitForFonts();

  const canvas = createCanvas();
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось подготовить холст для карточки.');

  drawCoverImage(ctx, image, format.width, format.height, backgroundEntry.focusX, backgroundEntry.focusY);
  ctx.fillStyle = `rgba(0, 0, 0, ${darkening})`;
  ctx.fillRect(0, 0, format.width, format.height);

  const isPaper = preset.id === 'paperOverlay';
  const panelWidth = isPaper ? format.width - 132 : format.width - 196;
  const sidePadding = isPaper ? 74 : 56;
  const textWidth = panelWidth - sidePadding * 2;
  const verticalPadding = isPaper ? 62 : 54;
  const maxPanelHeight = isPaper ? format.height - 164 : format.height - 140;
  const maxBlockHeight = maxPanelHeight - verticalPadding * 2;
  const layout = makeLayout(ctx, poem, frame, textWidth, maxBlockHeight, settings.formatId);
  const panelHeight = isPaper ? maxPanelHeight : layout.blockHeight + verticalPadding * 2;
  const rect = {
    x: isPaper ? 66 : 98,
    y: isPaper ? 82 : (format.height - panelHeight) / 2,
    width: panelWidth,
    height: panelHeight,
  };

  ctx.save();
  ctx.fillStyle = isPaper
    ? `rgba(248, 244, 234, ${panelOpacity})`
    : `rgba(14, 19, 19, ${panelOpacity})`;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  drawHairlineBorder(ctx, rect, isPaper);
  drawLayout(ctx, layout, rect, textWidth, isPaper);
  ctx.restore();

  const blob = await canvasToPngBlob(canvas);
  return { canvas, blob };
}
