import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const BOOKS = {
  '1': { title: 'Йахалахъ, Нохчийчоь', src: 'files/1.pdf' },
  '2': { title: 'Берийн ирс', src: 'files/2.pdf' },
};

const params = new URLSearchParams(window.location.search);
const selectedBook = BOOKS[params.get('book')];
const title = document.getElementById('reader-title');
const meta = document.getElementById('reader-meta');
const status = document.getElementById('reader-status');
const toolbar = document.getElementById('reader-toolbar');
const frame = document.getElementById('reader-page-frame');
const canvas = document.getElementById('reader-canvas');
const context = canvas.getContext('2d', { alpha: false });
const errorPanel = document.getElementById('reader-error');
const errorMessage = document.getElementById('reader-error-message');
const pageNumber = document.getElementById('reader-page-number');
const pageCount = document.getElementById('reader-page-count');
const previousButton = document.getElementById('reader-prev');
const nextButton = document.getElementById('reader-next');
const zoomOutButton = document.getElementById('reader-zoom-out');
const zoomInButton = document.getElementById('reader-zoom-in');
const fitButton = document.getElementById('reader-fit');

let pdfDocument = null;
let renderTask = null;
let currentPage = 1;
let zoom = 1;
let resizeTimer = 0;
let renderGeneration = 0;

function showError(message) {
  status.hidden = true;
  toolbar.hidden = true;
  frame.hidden = true;
  errorMessage.textContent = message;
  errorPanel.hidden = false;
}

function syncControls() {
  previousButton.disabled = currentPage <= 1;
  nextButton.disabled = currentPage >= pdfDocument.numPages;
  pageNumber.value = String(currentPage);
  pageNumber.max = String(pdfDocument.numPages);
  zoomOutButton.disabled = zoom <= 0.6;
  zoomInButton.disabled = zoom >= 2.5;
  fitButton.disabled = zoom === 1;
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
  renderPage(currentPage);
}

previousButton.addEventListener('click', () => renderPage(currentPage - 1));
nextButton.addEventListener('click', () => renderPage(currentPage + 1));
pageNumber.addEventListener('change', () => renderPage(pageNumber.value));
pageNumber.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    renderPage(pageNumber.value);
    pageNumber.blur();
  }
});
zoomOutButton.addEventListener('click', () => setZoom(zoom - 0.1));
zoomInButton.addEventListener('click', () => setZoom(zoom + 0.1));
fitButton.addEventListener('click', () => setZoom(1));

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
      pageCount.textContent = String(pdf.numPages);
      pageNumber.disabled = false;
      toolbar.hidden = false;
      frame.hidden = false;
      meta.textContent = `Читать онлайн · ${pdf.numPages} страниц`;
      syncControls();
      await renderPage(1);
    })
    .catch(() => showError('Не удалось загрузить книгу. Проверьте соединение и попробуйте открыть её ещё раз.'));
}
