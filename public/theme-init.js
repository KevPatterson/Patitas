/**
 * Bootstrap del tema: se ejecuta de forma síncrona en el head para evitar el
 * "flash" de tema incorrecto antes de que cargue React.
 *
 * Vive en un archivo externo (y no inline en index.html) porque la CSP en
 * producción solo permite `script-src 'self'`: un HTML inline sin nonce/hash
 * sería bloqueado por la política.
 */
(function () {
  var storageKey = 'patitas-theme';
  var theme = localStorage.getItem(storageKey);
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = theme === 'dark' || (!theme && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
  var meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', isDark ? '#170d07' : '#ff8c42');
})();
