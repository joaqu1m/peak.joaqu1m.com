/* Página de odds (/items/): switch de bioma nas malas + modal de perfil.
 * Nomes/descrições vêm do pack da língua (P.itemName / P.itemDesc). */
(function () {
  var P = window.Peak;
  var POOLS = window.PEAK_ITEM_POOLS || {};   // prefab -> [[rótulo do pool, %], ...]

  var tabs = document.querySelectorAll(".tab-btn");
  function selectTab(i) {
    tabs.forEach(function (b) { b.classList.toggle("active", +b.dataset.region === i); });
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.style.display = +p.dataset.region === i ? "" : "none";
    });
  }
  tabs.forEach(function (b) { b.onclick = function () { selectTab(+b.dataset.region); }; });
  if (tabs.length) selectTab(0);

  var back = document.getElementById("item-modal");
  var body = document.getElementById("modal-body");
  if (!back) return;

  function openItem(prefab) {
    var el = document.querySelector('[data-item="' + (window.CSS && CSS.escape ? CSS.escape(prefab) : prefab) + '"]');
    var icon = el && el.dataset.icon;
    var weight = el && el.dataset.weight;
    var effects = [];
    try { effects = JSON.parse((el && el.dataset.effects) || "[]"); } catch (e) {}
    var pools = (POOLS[prefab] || []).map(function (pp) {
      return "<li>" + pp[0] + " — <strong>" + pp[1] + "%</strong></li>";
    }).join("");
    var fx = effects.map(function (f) { return "<li>" + f + "</li>"; }).join("");
    var desc = P.itemDesc(prefab);
    body.innerHTML =
      '<div class="modal-head">' +
      (icon ? '<img src="' + P.img("icons/" + icon) + '" alt="">' : "") +
      "<div><h3>" + P.itemName(prefab) + "</h3><div class='muted'>" +
      (weight ? P.t("items.weight", { k: weight }) : "") + "</div></div></div>" +
      (desc ? '<p class="modal-desc">' + desc + "</p>" : "") +
      (fx ? "<h4>" + P.t("items.effects") + "</h4><ul>" + fx + "</ul>" : "") +
      (pools ? "<h4>" + P.t("items.where") + "</h4><ul>" + pools + "</ul>"
             : '<p class="muted">' + P.t("items.not_loot") + "</p>") +
      '<p><a class="modal-link" href="' + P.lbase + "items/" + (el && el.dataset.slug) + '/">' +
      P.t("items.permalink") + "</a></p>";
    back.style.display = "flex";
    history.replaceState(null, "", "#item-" + encodeURIComponent(prefab));
  }
  function close() {
    back.style.display = "none";
    history.replaceState(null, "", location.pathname);
  }
  document.getElementById("modal-close").onclick = close;
  back.addEventListener("click", function (ev) { if (ev.target === back) close(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") close(); });
  document.querySelectorAll("[data-item]").forEach(function (el) {
    el.addEventListener("click", function (ev) {
      // o link "página do item" dentro da linha tem prioridade
      if (ev.target.closest("a")) return;
      openItem(el.dataset.item);
    });
  });
  if (location.hash.indexOf("#item-") === 0) openItem(decodeURIComponent(location.hash.slice(6)));
})();
