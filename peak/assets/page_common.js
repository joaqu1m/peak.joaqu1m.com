/* Comum a todas as páginas: tema claro/escuro e troca de idioma.
 * O tema já foi aplicado por um script inline no <head> (evita flash). */
(function () {
  var P = window.Peak;

  // escuro e o padrao; claro so por escolha explicita (salva em localStorage)
  var btn = document.getElementById("theme-toggle");
  if (btn) {
    // icones em vez de emoji: emoji renderiza diferente por SO/fonte e
    // denuncia site feito as pressas — o resto do site ja usa SVG (zoom, etc).
    var ICON_MOON = '<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.3A8.4 8.4 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8Z"/></svg>';
    var ICON_SUN = '<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.3"/><path d="M12 2.5v2.6M12 18.9v2.6M4.4 4.4l1.8 1.8M17.8 17.8l1.8 1.8M2.5 12h2.6M18.9 12h2.6M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8"/></svg>';
    var apply = function (t) {
      if (t === "light") document.documentElement.setAttribute("data-theme", "light");
      else document.documentElement.removeAttribute("data-theme");
      // o botao mostra PARA ONDE se vai, nao onde se esta
      btn.innerHTML = t === "light" ? ICON_MOON : ICON_SUN;
    };
    try { apply(localStorage.getItem("peak-theme")); } catch (e) { apply(null); }
    btn.onclick = function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      try { localStorage.setItem("peak-theme", next); } catch (e) {}
      apply(next);
    };
  }

  // seletor de idioma: navega para a MESMA página na outra língua
  var sel = document.getElementById("lang-select");
  if (sel) {
    sel.onchange = function () {
      try { localStorage.setItem("peak-lang", sel.value); } catch (e) {}
      var url = sel.options[sel.selectedIndex].dataset.href;
      if (url) location.href = url;
    };
  }

  // Detecção de idioma: SÓ na home em inglês (raiz), só na primeira visita e
  // só quando o navegador pede outra língua. Uma escolha explícita no seletor
  // (localStorage) desliga isto para sempre.
  if (window.PEAK_AUTOLANG) {
    var saved = null;
    try { saved = localStorage.getItem("peak-lang"); } catch (e) {}
    if (!saved) {
      var avail = window.PEAK_AUTOLANG;   // {hreflang-lower: url}
      var cands = (navigator.languages || [navigator.language || ""]);
      for (var i = 0; i < cands.length; i++) {
        var c = String(cands[i]).toLowerCase();
        var hit = avail[c] || avail[c.split("-")[0]];
        if (hit && hit.slug !== "en") { location.replace(hit.url); return; }
        if (hit) break;   // navegador em inglês: fica
      }
    }
  }
})();
