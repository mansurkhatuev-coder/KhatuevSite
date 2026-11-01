import {
  captureSelectedExcerpt,
  readPoem,
  splitIntoFrames,
} from './poem-export-content.js';
import {
  DEFAULT_POEM_EXPORT_OPTIONS,
  POEM_EXPORT_FORMATS,
  POEM_EXPORT_PRESETS,
  renderPoemCard,
} from './poem-export-renderer.js';
import { POEM_EXPORT_BACKGROUNDS } from './poem-export-backgrounds.js';

const renderCache = new Map();
let active = null;
let renderRevision = 0;
let previousBodyOverflow = '';

function make(tagName, className = '', text = '') {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function makeButton(label, className = '') {
  const button = make('button', className, label);
  button.type = 'button';
  return button;
}

const dialog = make('dialog', 'poem-export');
dialog.setAttribute('aria-labelledby', 'poem-export-title');
dialog.setAttribute('aria-describedby', 'poem-export-status');

const shell = make('div', 'poem-export__shell');
const header = make('header', 'poem-export__header');
const headingGroup = make('div', 'poem-export__heading-group');
const dialogTitle = make('h2', 'poem-export__title');
dialogTitle.id = 'poem-export-title';
const poemMeta = make('p', 'poem-export__poem-meta');
headingGroup.append(dialogTitle, poemMeta);
const closeButton = makeButton('Закрыть', 'poem-export__close');
closeButton.setAttribute('aria-label', 'Закрыть экспорт');
header.append(headingGroup, closeButton);

const layout = make('div', 'poem-export__layout');
const controls = make('div', 'poem-export__controls');
const previewColumn = make('section', 'poem-export__preview-column');
previewColumn.setAttribute('aria-label', 'Предпросмотр карточек');

function makeControlGroup(title, className = '') {
  const section = make('section', `poem-export__group ${className}`.trim());
  const heading = make('h3', 'poem-export__group-title', title);
  section.appendChild(heading);
  return section;
}

function makeButtonGroup(label, className = '') {
  const group = make('div', `poem-export__button-group ${className}`.trim());
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);
  return group;
}

const modeGroup = makeControlGroup('Что экспортировать');
const modeButtons = makeButtonGroup('Объём текста', 'poem-export__mode-buttons');
const fullModeButton = makeButton('Всё стихотворение', 'poem-export__choice');
const excerptModeButton = makeButton('Фрагмент', 'poem-export__choice');
fullModeButton.setAttribute('aria-pressed', 'true');
excerptModeButton.setAttribute('aria-pressed', 'false');
modeButtons.append(fullModeButton, excerptModeButton);
modeGroup.appendChild(modeButtons);
const excerptSection = make('div', 'poem-export__excerpt-sections');
excerptSection.hidden = true;
modeGroup.appendChild(excerptSection);

const formatGroup = makeControlGroup('Формат');
const formatButtons = makeButtonGroup('Формат карточек', 'poem-export__format-buttons');
const formatButtonById = new Map();
for (const [formatId, format] of Object.entries(POEM_EXPORT_FORMATS)) {
  const button = makeButton(formatId === 'story' ? '9:16 · История' : '4:5 · Публикация', 'poem-export__choice');
  button.dataset.formatId = formatId;
  button.setAttribute('aria-pressed', String(formatId === DEFAULT_POEM_EXPORT_OPTIONS.formatId));
  formatButtonById.set(formatId, button);
  formatButtons.appendChild(button);
}
formatGroup.appendChild(formatButtons);

const backgroundsGroup = makeControlGroup('Фон');
const backgroundGallery = make('div', 'poem-export__backgrounds');
backgroundGallery.setAttribute('role', 'group');
backgroundGallery.setAttribute('aria-label', 'Фоны карточек');
const backgroundButtonById = new Map();
for (const background of POEM_EXPORT_BACKGROUNDS) {
  const button = makeButton('', 'poem-export__background');
  button.dataset.backgroundId = background.id;
  button.setAttribute('aria-label', background.label);
  button.setAttribute('aria-pressed', String(background.id === DEFAULT_POEM_EXPORT_OPTIONS.backgroundId));
  const image = make('img', 'poem-export__background-image');
  image.src = background.url;
  image.alt = background.alt;
  image.loading = 'lazy';
  const caption = make('span', 'poem-export__background-caption', background.label);
  button.append(image, caption);
  backgroundButtonById.set(background.id, button);
  backgroundGallery.appendChild(button);
}
backgroundsGroup.appendChild(backgroundGallery);

const presetGroup = makeControlGroup('Оформление');
const presetButtons = makeButtonGroup('Вариант оформления', 'poem-export__preset-buttons');
const presetButtonById = new Map();
for (const [presetId, preset] of Object.entries(POEM_EXPORT_PRESETS)) {
  const button = makeButton(preset.label, 'poem-export__choice');
  button.dataset.presetId = presetId;
  button.setAttribute('aria-pressed', String(presetId === DEFAULT_POEM_EXPORT_OPTIONS.presetId));
  presetButtonById.set(presetId, button);
  presetButtons.appendChild(button);
}
presetGroup.appendChild(presetButtons);

const adjustmentGroup = makeControlGroup('Настройки фона и подложки', 'poem-export__adjustments');
function makeRangeControl(id, labelText, min, max, step, value, suffix = '%') {
  const wrapper = make('div', 'poem-export__range-control');
  const labelRow = make('div', 'poem-export__range-label-row');
  const label = make('label', 'poem-export__range-label', labelText);
  label.htmlFor = id;
  const output = make('output', 'poem-export__range-value', `${Math.round(Number(value) * 100)}${suffix}`);
  output.htmlFor = id;
  labelRow.append(label, output);
  const input = make('input', 'poem-export__range');
  input.type = 'range';
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', labelText);
  wrapper.append(labelRow, input);
  return { wrapper, input, output };
}
const darkeningControl = makeRangeControl('poem-export-darkening', 'Затемнение фотографии', 0, 0.8, 0.01, DEFAULT_POEM_EXPORT_OPTIONS.darkening);
const opacityControl = makeRangeControl('poem-export-opacity', 'Прозрачность подложки', 0, 1, 0.01, DEFAULT_POEM_EXPORT_OPTIONS.panelOpacity);
adjustmentGroup.append(darkeningControl.wrapper, opacityControl.wrapper);

const excerptHint = make('p', 'poem-export__hint', 'Выделите строки в стихотворении перед нажатием «Поделиться» или выберите целые строфы выше.');
excerptHint.hidden = true;
controls.append(modeGroup, formatGroup, backgroundsGroup, presetGroup, adjustmentGroup, excerptHint);

const previewFrame = make('div', 'poem-export__preview-frame');
const previewCanvas = make('canvas', 'poem-export__canvas');
previewCanvas.width = POEM_EXPORT_FORMATS.story.width;
previewCanvas.height = POEM_EXPORT_FORMATS.story.height;
previewCanvas.setAttribute('role', 'img');
previewCanvas.setAttribute('aria-label', 'Предпросмотр карточки со стихотворением');
previewFrame.appendChild(previewCanvas);

const frameNavigation = make('div', 'poem-export__frame-navigation');
const previousFrameButton = makeButton('Предыдущий', 'poem-export__nav-button');
previousFrameButton.setAttribute('aria-label', 'Предыдущий кадр');
const frameCounter = make('p', 'poem-export__frame-counter', 'Подготовка предпросмотра');
const nextFrameButton = makeButton('Следующий', 'poem-export__nav-button');
nextFrameButton.setAttribute('aria-label', 'Следующий кадр');
frameNavigation.append(previousFrameButton, frameCounter, nextFrameButton);
const thumbnails = make('div', 'poem-export__thumbnails');
thumbnails.setAttribute('role', 'group');
thumbnails.setAttribute('aria-label', 'Кадры стихотворения');

const status = make('p', 'poem-export__status', 'Выберите стихотворение.');
status.id = 'poem-export-status';
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');
status.setAttribute('aria-atomic', 'true');
const progress = make('progress', 'poem-export__progress');
progress.max = 1;
progress.value = 0;
progress.hidden = true;
progress.setAttribute('aria-label', 'Подготовка карточек');

const actions = make('div', 'poem-export__actions');
const shareButton = makeButton('Поделиться', 'poem-export__action poem-export__action--share');
shareButton.disabled = true;
shareButton.hidden = true;
const downloadSeriesButton = makeButton('Скачать серию', 'poem-export__action poem-export__action--download-series');
downloadSeriesButton.disabled = true;
downloadSeriesButton.hidden = true;
const downloadCurrentButton = makeButton('Скачать эту карточку', 'poem-export__action poem-export__action--download-current');
downloadCurrentButton.disabled = true;
const retryButton = makeButton('Повторить подготовку', 'poem-export__action poem-export__action--retry');
retryButton.disabled = true;
retryButton.hidden = true;
actions.append(shareButton, downloadSeriesButton, downloadCurrentButton, retryButton);

previewColumn.append(previewFrame, frameNavigation, thumbnails, status, progress, actions);
layout.append(controls, previewColumn);
shell.append(header, layout);
dialog.appendChild(shell);
document.body.appendChild(dialog);

function updateStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function currentOptions() {
  return active ? { ...active.options } : { ...DEFAULT_POEM_EXPORT_OPTIONS };
}

function invalidateRenderCache() {
  renderCache.clear();
}

function getCachedRender(frame, poem, options) {
  const key = JSON.stringify({
    poem: { id: poem.id, title: poem.title, author: poem.author },
    frame,
    options,
  });
  if (renderCache.has(key)) return renderCache.get(key);

  const renderPromise = renderPoemCard(frame, poem, options);
  renderCache.set(key, renderPromise);
  renderPromise.catch(() => {
    if (renderCache.get(key) === renderPromise) renderCache.delete(key);
  });
  return renderPromise;
}

function splitSelectedText(text) {
  const lines = String(text).split(/\r\n|\n|\r/);
  return [{ kind: 'stanza', text, lines }];
}

function getSourceSections() {
  if (active.mode === 'full') return active.poem.sections;
  if (active.selectedText) return splitSelectedText(active.selectedText);
  return active.poem.sections.filter((section, index) => active.selectedSections.has(index));
}

function estimatedLineBudget(formatId) {
  const format = POEM_EXPORT_FORMATS[formatId];
  // The renderer reserves space for the title, ornament, author and padding.
  // These conservative budgets reflect the remaining text area at readable font sizes.
  const reservedHeight = formatId === 'story' ? 590 : 500;
  const comfortableLineHeight = formatId === 'story' ? 49 : 46;
  const availableTextHeight = Math.max(1, format.height - reservedHeight);
  return Math.max(4, Math.floor(availableTextHeight / comfortableLineHeight));
}

function setControlState() {
  if (!active) return;
  fullModeButton.setAttribute('aria-pressed', String(active.mode === 'full'));
  excerptModeButton.setAttribute('aria-pressed', String(active.mode === 'excerpt'));
  for (const [formatId, button] of formatButtonById) {
    button.setAttribute('aria-pressed', String(active.options.formatId === formatId));
  }
  for (const [backgroundId, button] of backgroundButtonById) {
    button.setAttribute('aria-pressed', String(active.options.backgroundId === backgroundId));
  }
  for (const [presetId, button] of presetButtonById) {
    button.setAttribute('aria-pressed', String(active.options.presetId === presetId));
  }

  const showSectionPicker = active.mode === 'excerpt' && !active.selectedText;
  excerptSection.hidden = !showSectionPicker;
  excerptHint.hidden = active.mode !== 'excerpt' || Boolean(active.selectedText);
  if (showSectionPicker) renderExcerptCheckboxes();
}

function renderExcerptCheckboxes() {
  excerptSection.replaceChildren();
  if (!active) return;
  const label = make('p', 'poem-export__excerpt-label', 'Выберите одну или несколько строф:');
  excerptSection.appendChild(label);
  active.poem.sections.forEach((section, index) => {
    const row = make('label', 'poem-export__stanza-choice');
    const checkbox = make('input');
    checkbox.type = 'checkbox';
    checkbox.checked = active.selectedSections.has(index);
    checkbox.value = String(index);
    const summary = section.lines.join(' ');
    const shortSummary = summary.length > 92 ? `${summary.slice(0, 89).trimEnd()}…` : summary;
    const text = make('span', 'poem-export__stanza-text', `Строфа ${index + 1}: ${shortSummary}`);
    row.append(checkbox, text);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) active.selectedSections.add(index);
      else active.selectedSections.delete(index);
      invalidateRenderCache();
      rebuildSeries();
    });
    excerptSection.appendChild(row);
  });
}

function setPreviewSize(formatId) {
  const format = POEM_EXPORT_FORMATS[formatId];
  previewCanvas.width = format.width;
  previewCanvas.height = format.height;
  previewCanvas.style.aspectRatio = `${format.width} / ${format.height}`;
  previewCanvas.setAttribute('aria-label', `${format.label}: предпросмотр карточки`);
}

function updateFrameNavigation() {
  const hasFrames = Boolean(active?.cards?.length);
  const count = active?.cards?.length || 0;
  const index = active?.frameIndex || 0;
  frameCounter.textContent = count ? `Кадр ${index + 1} из ${count}` : 'Предпросмотр появится после подготовки';
  previousFrameButton.disabled = !hasFrames || index <= 0;
  nextFrameButton.disabled = !hasFrames || index >= count - 1;
  downloadCurrentButton.disabled = !hasFrames;

  if (!hasFrames) {
    const ctx = previewCanvas.getContext('2d');
    ctx?.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  } else {
    const current = active.cards[index];
    const ctx = previewCanvas.getContext('2d');
    if (ctx && current) {
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      ctx.drawImage(current.canvas, 0, 0, previewCanvas.width, previewCanvas.height);
    }
  }

  renderThumbnails();
}

function showFirstRenderedFrame(card, formatId, total) {
  setPreviewSize(formatId);
  const ctx = previewCanvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  ctx.drawImage(card.canvas, 0, 0, previewCanvas.width, previewCanvas.height);
  frameCounter.textContent = total > 1
    ? `Предпросмотр · кадр 1 из ${total}`
    : 'Предпросмотр карточки';
}

function renderThumbnails() {
  thumbnails.replaceChildren();
  if (!active?.cards?.length) return;

  active.cards.forEach((card, index) => {
    const button = makeButton('', 'poem-export__thumbnail');
    button.setAttribute('aria-label', `Показать кадр ${index + 1} из ${active.cards.length}`);
    button.setAttribute('aria-pressed', String(index === active.frameIndex));
    const thumb = make('canvas', 'poem-export__thumbnail-canvas');
    thumb.width = 96;
    thumb.height = Math.round(96 * card.canvas.height / card.canvas.width);
    thumb.setAttribute('aria-hidden', 'true');
    const ctx = thumb.getContext('2d');
    ctx?.drawImage(card.canvas, 0, 0, thumb.width, thumb.height);
    const label = make('span', 'poem-export__thumbnail-label', `${index + 1}`);
    button.append(thumb, label);
    button.addEventListener('click', () => {
      if (!active) return;
      active.frameIndex = index;
      updateFrameNavigation();
    });
    thumbnails.appendChild(button);
  });
}

function safeId(value) {
  const normalized = String(value || 'stih').normalize('NFKD').toLowerCase();
  const safe = normalized.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe || 'stih';
}

function makeFilename(index, total) {
  const id = safeId(active?.poem.id);
  const number = String(index + 1).padStart(2, '0');
  const suffix = total > 1 ? `-of-${String(total).padStart(2, '0')}` : '';
  return `${id}-${number}${suffix}.png`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = make('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1200);
}

function wait(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

function updateActions() {
  const ready = Boolean(active?.cards?.length && active.cards.every(card => card.blob instanceof Blob && card.blob.size > 0));
  const files = ready && typeof File === 'function'
    ? active.cards.map((card, index) => new File([card.blob], makeFilename(index, active.cards.length), { type: 'image/png' }))
    : [];
  let canShareFiles = false;
  if (files.length && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      canShareFiles = navigator.canShare({ files });
    } catch {
      canShareFiles = false;
    }
  }

  shareButton.hidden = !canShareFiles;
  shareButton.disabled = !canShareFiles;
  downloadSeriesButton.hidden = !ready;
  downloadSeriesButton.disabled = !ready;
  downloadCurrentButton.disabled = !ready;
  return { ready, canShareFiles };
}

function setProgress(value, max, message) {
  progress.hidden = false;
  progress.max = Math.max(1, max);
  progress.value = Math.max(0, Math.min(value, progress.max));
  updateStatus(message);
}

function canRetryWithSmallerBudget(error) {
  return typeof error?.message === 'string' && error.message.includes('Текст не помещается на карточке');
}

async function renderFramesAtBudget(sections, poem, options, initialBudget, revision) {
  let budget = initialBudget;
  let lastLayoutError = null;

  while (budget >= 4) {
    const frames = splitIntoFrames(sections, budget);
    if (!frames.length) return { frames, cards: [], budget };
    const cards = [];
    let overflowError = null;

    for (let index = 0; index < frames.length; index += 1) {
      if (revision !== renderRevision) return null;
      setProgress(index, frames.length, frames.length > 1
        ? `Подготовка кадра ${index + 1} из ${frames.length}…`
        : 'Подготовка карточки…');
      try {
        const card = await getCachedRender(frames[index], poem, options);
        cards.push(card);
        if (index === 0 && revision === renderRevision) {
          showFirstRenderedFrame(card, options.formatId, frames.length);
        }
      } catch (error) {
        if (canRetryWithSmallerBudget(error)) {
          overflowError = error;
          break;
        }
        throw error;
      }
    }

    if (revision !== renderRevision) return null;
    if (!overflowError && cards.length === frames.length) return { frames, cards, budget };
    lastLayoutError = overflowError;
    const smaller = Math.max(4, Math.floor(budget * 0.78));
    if (smaller >= budget) break;
    budget = smaller;
  }

  throw lastLayoutError || new Error('Не удалось разместить текст. Попробуйте выбрать более короткий фрагмент.');
}

async function rebuildSeries() {
  if (!active) return;
  const revision = ++renderRevision;
  previewColumn.scrollTop = 0;
  retryButton.hidden = true;
  retryButton.disabled = true;
  active.cards = [];
  active.frames = [];
  active.frameIndex = 0;
  updateFrameNavigation();
  const { ready } = updateActions();
  if (!ready) {
    shareButton.hidden = true;
    downloadSeriesButton.hidden = true;
  }

  const sections = getSourceSections();
  if (!sections.length || !sections.some(section => section.lines?.some(line => String(line).trim()))) {
    progress.hidden = true;
    updateStatus(active.mode === 'excerpt' && !active.selectedText
      ? 'Отметьте одну или несколько строф для экспорта.'
      : 'В этом стихотворении не найден текст для экспорта.');
    updateActions();
    return;
  }

  const options = currentOptions();
  const budget = estimatedLineBudget(options.formatId);
  setPreviewSize(options.formatId);
  progress.hidden = false;
  progress.value = 0;
  progress.max = 1;
  updateStatus('Подготовка фона и текста…');

  try {
    const result = await renderFramesAtBudget(sections, active.poem, options, budget, revision);
    if (!result || revision !== renderRevision || !active) return;
    active.frames = result.frames;
    active.cards = result.cards;
    active.frameIndex = 0;
    progress.value = progress.max;
    progress.hidden = true;
    setPreviewSize(options.formatId);
    updateFrameNavigation();
    const { canShareFiles } = updateActions();
    const countText = result.cards.length === 1 ? '1 карточка готова.' : `Готово: ${result.cards.length} карточек.`;
    updateStatus(canShareFiles
      ? countText
      : `${countText} Системная отправка файлов недоступна — скачайте карточки.`);
  } catch (error) {
    if (revision !== renderRevision || !active) return;
    progress.hidden = true;
    progress.value = 0;
    active.cards = [];
    active.frames = [];
    updateFrameNavigation();
    updateActions();
    updateStatus(error?.message || 'Не удалось создать карточки. Попробуйте ещё раз.', true);
    retryButton.hidden = false;
    retryButton.disabled = false;
  }
}

function setMode(mode) {
  if (!active || !['full', 'excerpt'].includes(mode)) return;
  if (active.mode === mode) return;
  active.mode = mode;
  active.frameIndex = 0;
  invalidateRenderCache();
  setControlState();
  rebuildSeries();
}

function changeOption(key, value) {
  if (!active || active.options[key] === value) return;
  active.options[key] = value;
  invalidateRenderCache();
  setControlState();
  rebuildSeries();
}

function openDialog(poemElement, trigger, selectedText) {
  let poem;
  try {
    poem = readPoem(poemElement);
  } catch (error) {
    window.alert(error?.message || 'Не удалось прочитать стихотворение.');
    return;
  }

  invalidateRenderCache();
  dialog.classList.toggle('is-dark', poemElement.classList.contains('is-dark'));
  active = {
    poemElement,
    poem,
    trigger,
    selectedText: selectedText || '',
    mode: selectedText ? 'excerpt' : 'full',
    selectedSections: new Set(),
    options: { ...DEFAULT_POEM_EXPORT_OPTIONS },
    frames: [],
    cards: [],
    frameIndex: 0,
  };
  dialogTitle.textContent = poem.title || 'Стихотворение';
  poemMeta.textContent = poem.meta ? `${poem.meta} · ${poem.author}` : poem.author;
  darkeningControl.input.value = String(active.options.darkening);
  darkeningControl.output.textContent = `${Math.round(active.options.darkening * 100)}%`;
  opacityControl.input.value = String(active.options.panelOpacity);
  opacityControl.output.textContent = `${Math.round(active.options.panelOpacity * 100)}%`;
  setPreviewSize(active.options.formatId);
  setControlState();
  updateFrameNavigation();
  updateActions();
  progress.hidden = true;
  updateStatus(selectedText
    ? 'Выбранный фрагмент готовится к экспорту.'
    : 'Все стихотворение готовится к экспорту.');

  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  layout.scrollTop = 0;
  previewColumn.scrollTop = 0;
  closeButton.focus({ preventScroll: true });
  rebuildSeries();
}

function closeDialog() {
  if (!dialog.open && !dialog.hasAttribute('open')) return;
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else {
    dialog.removeAttribute('open');
    restoreAfterClose();
  }
}

function restoreAfterClose() {
  renderRevision += 1;
  progress.hidden = true;
  document.body.style.overflow = previousBodyOverflow;
  const trigger = active?.trigger;
  active = null;
  renderCache.clear();
  trigger?.focus({ preventScroll: true });
}

closeButton.addEventListener('click', closeDialog);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeDialog();
});
dialog.addEventListener('close', restoreAfterClose);

fullModeButton.addEventListener('click', () => setMode('full'));
excerptModeButton.addEventListener('click', () => setMode('excerpt'));
for (const [formatId, button] of formatButtonById) {
  button.addEventListener('click', () => {
    if (!active) return;
    setPreviewSize(formatId);
    changeOption('formatId', formatId);
  });
}
for (const [backgroundId, button] of backgroundButtonById) {
  button.addEventListener('click', () => changeOption('backgroundId', backgroundId));
}
for (const [presetId, button] of presetButtonById) {
  button.addEventListener('click', () => changeOption('presetId', presetId));
}

darkeningControl.input.addEventListener('input', () => {
  const value = Number(darkeningControl.input.value);
  darkeningControl.output.textContent = `${Math.round(value * 100)}%`;
  changeOption('darkening', value);
});
opacityControl.input.addEventListener('input', () => {
  const value = Number(opacityControl.input.value);
  opacityControl.output.textContent = `${Math.round(value * 100)}%`;
  changeOption('panelOpacity', value);
});

previousFrameButton.addEventListener('click', () => {
  if (!active?.cards.length || active.frameIndex <= 0) return;
  active.frameIndex -= 1;
  updateFrameNavigation();
});
nextFrameButton.addEventListener('click', () => {
  if (!active?.cards.length || active.frameIndex >= active.cards.length - 1) return;
  active.frameIndex += 1;
  updateFrameNavigation();
});

downloadCurrentButton.addEventListener('click', () => {
  if (!active?.cards.length) return;
  const index = active.frameIndex;
  downloadBlob(active.cards[index].blob, makeFilename(index, active.cards.length));
  updateStatus(`Кадр ${index + 1} скачивается.`);
});

downloadSeriesButton.addEventListener('click', async () => {
  if (!active?.cards.length) return;
  const cards = [...active.cards];
  const poemId = active.poem.id;
  const total = cards.length;
  for (let index = 0; index < cards.length; index += 1) {
    if (!active || active.poem.id !== poemId) return;
    downloadBlob(cards[index].blob, makeFilename(index, total));
    updateStatus(`Скачивание карточки ${index + 1} из ${total}…`);
    if (index < cards.length - 1) await wait(350);
  }
  if (active?.poem.id === poemId) updateStatus(`Скачивание серии из ${total} карточек начато.`);
});

retryButton.addEventListener('click', () => {
  if (!active) return;
  invalidateRenderCache();
  retryButton.hidden = true;
  retryButton.disabled = true;
  rebuildSeries();
});

shareButton.addEventListener('click', () => {
  if (!active?.cards.length) return;
  let files;
  let supported = false;
  try {
    if (typeof File === 'function') {
      files = active.cards.map((card, index) => new File(
        [card.blob],
        makeFilename(index, active.cards.length),
        { type: 'image/png' }
      ));
      supported = typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files });
    }
  } catch {
    supported = false;
  }
  if (!supported) {
    shareButton.hidden = true;
    downloadSeriesButton.hidden = false;
    updateStatus('Системная отправка файлов недоступна — скачайте карточки.');
    return;
  }

  let sharePromise;
  try {
    // Call share synchronously from this user gesture; rendering is already complete.
    sharePromise = navigator.share({ title: active.poem.title || 'Стихотворение', files });
  } catch (error) {
    updateStatus(error?.message || 'Не удалось открыть меню отправки.', true);
    return;
  }
  const poemId = active.poem.id;
  Promise.resolve(sharePromise).then(() => {
    if (active?.poem.id === poemId) updateStatus('Карточки переданы в меню отправки.');
  }).catch(error => {
    if (!active || active.poem.id !== poemId) return;
    if (error?.name === 'AbortError') {
      updateStatus('Отправка отменена. Карточки остались готовы к скачиванию.');
      return;
    }
    updateStatus(error?.message || 'Не удалось поделиться карточками. Можно скачать их вручную.', true);
  });
});

for (const poemElement of document.querySelectorAll('.poem-block')) {
  const headerElement = poemElement.querySelector('.poem-block__header');
  if (!headerElement) continue;
  const trigger = makeButton('Поделиться', 'poem-share-trigger');
  trigger.setAttribute('aria-label', `Поделиться стихотворением: ${poemElement.querySelector('.poem-block__title')?.textContent.trim() || 'без названия'}`);
  let pointerSelection = '';
  trigger.addEventListener('pointerdown', () => {
    pointerSelection = captureSelectedExcerpt(poemElement);
  });
  trigger.addEventListener('click', () => {
    const selectedText = pointerSelection || captureSelectedExcerpt(poemElement);
    pointerSelection = '';
    openDialog(poemElement, trigger, selectedText);
  });
  headerElement.appendChild(trigger);
}
