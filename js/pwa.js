(() => {
  if (
    !("serviceWorker" in navigator) ||
    !window.isSecureContext ||
    location.protocol === "file:"
  ) {
    return;
  }

  const pageBase = new URL("./", document.baseURI);
  const workerUrl = new URL("sw.js", pageBase);
  navigator.serviceWorker.register(workerUrl.href, { scope: pageBase.pathname })
    .catch((error) => {
      console.warn("Не удалось включить офлайн-доступ сайта.", error);
    });
})();
