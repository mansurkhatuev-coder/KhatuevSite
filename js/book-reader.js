import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const BOOKS = {
  '1': { title: 'Йахалахъ, Нохчийчоь', src: 'files/1.pdf' },
  '2': { title: 'Берийн ирс', src: 'files/2.pdf' },
  '3': { title: 'Хьуна – хьекъал, суна – хьекъал!', src: 'files/mudrost-tebe-mudrost-mne-2026.pdf' },
  '4': { title: 'Я веду себя на расстрел', src: 'files/ya-vedu-sebya-na-rasstrel-2008.pdf' },
};

const params = new URLSearchParams(window.location.search);
const selectedBook = BOOKS[params.get('book')];
const title = document.getElementById('reader-title');
const meta = document.getElementById('reader-meta');
const status = document.getElementById('reader-status');
const toolbar = document.getElementById('reader-toolbar');
const bottomToolbar = document.getElementById('reader-toolbar-bottom');
const frame = document.getElementById('reader-page-frame');
const canvas = document.getElementById('reader-canvas');
const context = canvas.getContext('2d', { alpha: false });
const errorPanel = document.getElementById('reader-error');
const errorMessage = document.getElementById('reader-error-message');
const pageNumbers = [
  document.getElementById('reader-page-number'),
  document.getElementById('reader-page-number-bottom'),
];
const pageCounts = [
  document.getElementById('reader-page-count'),
  document.getElementById('reader-page-count-bottom'),
];
const previousButtons = [
  document.getElementById('reader-prev'),
  document.getElementById('reader-prev-bottom'),
];
const nextButtons = [
  document.getElementById('reader-next'),
  document.getElementById('reader-next-bottom'),
];
const zoomOutButton = document.getElementById('reader-zoom-out');
const zoomInButton = document.getElementById('reader-zoom-in');
const fitButton = document.getElementById('reader-fit');
const swipeNote = document.getElementById('reader-swipe-note');
const supportsPointerSwipe = typeof window.PointerEvent === 'function'
  && (navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);
const supportsTouchSwipe = supportsPointerSwipe || (!window.PointerEvent && 'ontouchstart' in window);

let pdfDocument = null;
let renderTask = null;
let currentPage = 1;
let zoom = 1;
let resizeTimer = 0;
let renderGeneration = 0;
let swipeStart = null;

function showError(message) {
  status.hidden = true;
  toolbar.hidden = true;
  bottomToolbar.hidden = true;
  frame.hidden = true;
  frame.classList.remove('reader-page-frame--swipe-enabled');
  swipeNote.hidden = true;
  errorMessage.textContent = message;
  errorPanel.hidden = false;
}

function syncControls() {
  previousButtons.forEach(button => { button.disabled = currentPage <= 1; });
  nextButtons.forEach(button => { button.disabled = currentPage >= pdfDocument.numPages; });
  pageNumbers.forEach(input => {
    input.value = String(currentPage);
    input.max = String(pdfDocument.numPages);
  });
  pageCounts.forEach(count => { count.textContent = String(pdfDocument.numPages); });
  zoomOutButton.disabled = zoom <= 0.6;
  zoomInButton.disabled = zoom >= 2.5;
  fitButton.disabled = zoom === 1;
}

function syncSwipeMode() {
  const swipeEnabled = supportsTouchSwipe && zoom === 1;
  frame.classList.toggle('reader-page-frame--swipe-enabled', swipeEnabled);
  swipeNote.hidden = !supportsTouchSwipe;
}

function getSwipeStart(x, y) {
  if (!supportsTouchSwipe || zoom !== 1 || x < 40 || x > window.innerWidth - 40) return null;
  return { x, y };
}

function navigateBySwipe(start, x, y) {
  if (!start) return;
  const deltaX = x - start.x;
  const deltaY = y - start.y;
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
  const requestedPage = currentPage + (deltaX < 0 ? 1 : -1);
  if (requestedPage >= 1 && requestedPage <= pdfDocument.numPages) renderPage(requestedPage);
}

async function renderPage(requestedPage = currentPage) {
  if (!pdfDocument) return;
  const generation = ++renderGeneration;
  currentPage = Math.max(1, Math.min(pdfDocument.numPages, Math.trunc(Number(requestedPage) || 1)));
  syncControls();

  if (renderTask) {
    const cancelledTask = renderTask;
    cancelledTask.cancel();
    try {
      await cancelledTask.promise;
    } catch {
      // A cancelled PDF.js render rejects its promise after releasing the canvas.
    }
    if (generation !== renderGeneration) return;
  }

  let task = null;
  try {
    const page = await pdfDocument.getPage(currentPage);
    if (generation !== renderGeneration) return;
    const naturalViewport = page.getViewport({ scale: 1 });
    const frameStyle = window.getComputedStyle(frame);
    const horizontalPadding = Number.parseFloat(frameStyle.paddingLeft) + Number.parseFloat(frameStyle.paddingRight);
    const availableWidth = Math.max(240, frame.clientWidth - horizontalPadding);
    const fitScale = availableWidth / naturalViewport.width;
    const scale = fitScale * zoom;
    const viewport = page.getViewport({ scale });
    const outputScale = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    task = page.render({
      canvasContext: context,
      viewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
    });
    renderTask = task;
    await task.promise;
    if (renderTask === task) renderTask = null;
    if (generation !== renderGeneration) return;
    canvas.setAttribute('aria-label', `Страница ${currentPage} книги «${selectedBook.title}»`);
    status.textContent = `Страница ${currentPage} из ${pdfDocument.numPages}`;
  } catch (error) {
    if (renderTask === task) renderTask = null;
    if (generation !== renderGeneration || error?.name === 'RenderingCancelledException') return;
    showError('Не удалось отобразить страницу. Обновите страницу или вернитесь к списку книг.');
  }
}

function setZoom(nextZoom) {
  zoom = Math.max(0.6, Math.min(2.5, Math.round(nextZoom * 10) / 10));
  syncSwipeMode();
  renderPage(currentPage);
}

previousButtons.forEach(button => button.addEventListener('click', () => renderPage(currentPage - 1)));
nextButtons.forEach(button => button.addEventListener('click', () => renderPage(currentPage + 1)));
pageNumbers.forEach(input => {
  input.addEventListener('change', () => renderPage(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renderPage(input.value);
      input.blur();
    }
  });
});
zoomOutButton.addEventListener('click', () => setZoom(zoom - 0.1));
zoomInButton.addEventListener('click', () => setZoom(zoom + 0.1));
fitButton.addEventListener('click', () => setZoom(1));

if (supportsPointerSwipe) {
  frame.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    if (event.isPrimary === false) {
      swipeStart = null;
      return;
    }
    swipeStart = getSwipeStart(event.clientX, event.clientY);
  }, { passive: true });
  frame.addEventListener('pointerup', event => {
    navigateBySwipe(swipeStart, event.clientX, event.clientY);
    swipeStart = null;
  }, { passive: true });
  frame.addEventListener('pointercancel', () => { swipeStart = null; }, { passive: true });
} else if (supportsTouchSwipe) {
  frame.addEventListener('touchstart', event => {
    if (event.touches.length > 1) {
      swipeStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    swipeStart = getSwipeStart(touch.clientX, touch.clientY);
  }, { passive: true });
  frame.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    navigateBySwipe(swipeStart, touch.clientX, touch.clientY);
    swipeStart = null;
  }, { passive: true });
  frame.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });
}

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => renderPage(currentPage), 120);
}, { passive: true });

if (!selectedBook) {
  title.textContent = 'Книга не выбрана';
  meta.textContent = 'Выберите издание в каталоге книг.';
  showError('Не удалось определить книгу. Вернитесь к каталогу и выберите издание.');
} else {
  title.textContent = selectedBook.title;
  document.title = `${selectedBook.title} — Читать онлайн`;

  pdfjsLib.getDocument({ url: selectedBook.src }).promise
    .then(async pdf => {
      pdfDocument = pdf;
      pageNumbers.forEach(input => { input.disabled = false; });
      toolbar.hidden = false;
      bottomToolbar.hidden = false;
      frame.hidden = false;
      meta.textContent = `Читать онлайн · ${pdf.numPages} страниц`;
      syncControls();
      syncSwipeMode();
      await renderPage(1);
    })
    .catch(() => showError('Не удалось загрузить книгу. Проверьте соединение и попробуйте открыть её ещё раз.'));
}
