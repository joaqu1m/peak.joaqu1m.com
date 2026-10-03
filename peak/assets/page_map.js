/* Página do mapa (home, /today/, /tomorrow/, /d/<data>/).
 * Textos vêm de P.t (pack da língua); nada de string fixa aqui. */
(function () {
  var P = window.Peak;
  var PAGE = window.PEAK_PAGE || {};
  var GEO = window.PEAK_GEO;

  // Aceita so data que EXISTE. "2026-13-99" passa por um teste de formato mas
  // Date.parse devolve NaN, e o NaN viraria indice da rotacao e derrubaria a
  // pagina. Isso ficou mais facil de acontecer agora que ?d= e o caminho normal
  // de navegacao por dia (antes eram paginas /d/ geradas, sempre validas).
  function validIso(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var t = Date.parse(s + "T12:00:00Z");
    return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
  }

  // dia inicial: pagina de data fixa > ?d= > modo (live/tomorrow)
  function initialDay() {
    if (PAGE.date) return PAGE.date;
    var q = new URLSearchParams(location.search).get("d");
    if (q && validIso(q)) return q;
    var live = P.gameDayIso();
    return PAGE.mode === "tomorrow" ? P.isoAddDays(live, 1) : live;
  }

  var state = {
    day: initialDay(),
    biome: 0,
    yaw: 2, pitch: 2,
    layers: new Set(P.LAYERS.filter(function (l) { return l.on; }).map(function (l) { return l.key; })),
  };
  var stage = new P.Stage(document.getElementById("stage"));

  var VIEW2YP = { side: [0, 0], sidefront: [1, 0], front: [2, 0],
                  sidetop: [0, 1], fronttop: [2, 1], top: [2, 2] };
  function defaultViewFor(i) {
    if (i !== 4) return { yaw: 2, pitch: 2 };
    // O 5o segmento e um dos DOIS finais da montanha, nunca fixo (info.final
    // vem do mapa do dia). O Citadel se ve melhor de frente; o Kiln, de lado.
    var info = P.sceneForIndex(P.indexForIso(state.day));
    return info.final === "Kiln" ? { yaw: 0, pitch: 0 } : { yaw: 2, pitch: 0 };
  }

  var q0 = new URLSearchParams(location.search);
  if (q0.get("b") !== null) state.biome = Math.min(4, Math.max(0, parseInt(q0.get("b"), 10) || 0));
  if (q0.get("v") && VIEW2YP[q0.get("v")]) {
    state.yaw = VIEW2YP[q0.get("v")][0];
    state.pitch = VIEW2YP[q0.get("v")][1];
  } else {
    // sem ?v= na URL, vale a vista padrão DO BIOMA (a Citadel se vê de frente).
    // Sem isto, um link com ?b=4 caía no topo, que ali não mostra nada.
    var dv = defaultViewFor(state.biome);
    state.yaw = dv.yaw; state.pitch = dv.pitch;
  }
  // ?l=camada1,camada2 — mostra SÓ essas camadas (links dos guias e conquistas
  // chegam com o assunto isolado em vez de um mapa com centenas de marcadores)
  var known = P.LAYERS.map(function (l) { return l.key; });
  if (q0.get("l") !== null) {
    var want = q0.get("l").split(",").filter(function (k) { return known.indexOf(k) >= 0; });
    if (want.length) state.layers = new Set(want);
  }
  var fromUrl = q0.get("b") !== null || !!q0.get("v") || q0.get("l") !== null;
  var booted = false;

  function updateUrl() {
    if (!booted) return;
    var q = new URLSearchParams(location.search);
    q.set("b", state.biome);
    q.set("v", P.viewFor(state.yaw, state.pitch));
    // só mantém ?l= enquanto o conjunto difere do padrão (URL curta e honesta)
    var on = P.LAYERS.filter(function (l) { return state.layers.has(l.key); }).map(function (l) { return l.key; });
    var def = P.LAYERS.filter(function (l) { return l.on; }).map(function (l) { return l.key; });
    if (on.join() === def.join()) q.delete("l"); else q.set("l", on.join(","));
    history.replaceState(null, "", location.pathname + "?" + q.toString());
  }

  function setBiome(i) {
    state.biome = i;
    var dv = defaultViewFor(i);
    state.yaw = dv.yaw; state.pitch = dv.pitch;
    updateUrl();
    render();
  }

  function render() {
    var idx = P.indexForIso(state.day);
    var info = P.sceneForIndex(idx);
    var biomes = P.biomesOf(idx);

    var ver = (window.PEAK_ROTATION.version || "").split("-")[0];
    var pn = document.getElementById("patch-note");
    if (pn) pn.textContent = " " + P.t("footer.version", { v: ver + (PAGE.patch ? " (" + PAGE.patch + ")" : "") });

    // timeline por DIA DE JOGO (identidade = data de estreia às 17:00 UTC)
    var liveIso = P.gameDayIso();
    var tl = document.getElementById("timeline");
    tl.innerHTML = "";
    for (var d = -3; d <= 10; d++) (function (d) {
      var iso = P.isoAddDays(liveIso, d);
      var bs = P.biomesOf(P.indexForIso(iso));
      var a = document.createElement("a");
      a.className = "day" + (iso === state.day ? " selected" : "");
      // as paginas /d/<data>/ nao sao mais geradas; o dia vira parametro na
      // propria pagina. O href continua existindo para ctrl+clique e para o
      // menu de contexto — o clique normal ja era tratado no cliente.
      a.href = P.lbase + "?d=" + iso;
      var icons = bs.map(function (b) {
        return '<span class="biconwrap' + (P.hasVariant(b) ? " mod" : "") + '" title="' +
          b.name + (P.hasVariant(b) ? " — " + P.t("variant.tag", { v: b.variant }) : "") + '">' +
          '<img class="bicon" alt="' + b.name + '" src="' +
          P.img("biomes/" + P.biomeSlug(b.id) + ".png") + '"></span>';
      }).join("");
      var dref = new Date(iso + "T12:00:00Z");
      var dow;
      try {
        dow = dref.toLocaleDateString(P.langCode, { weekday: "short", timeZone: "UTC" });
      } catch (e) { dow = iso.slice(5); }
      a.innerHTML = '<div class="dow">' +
        (d === 0 ? P.t("today.live") : d === 1 ? P.t("today.tomorrow", { time: P.switchTime() }) : dow) +
        '</div><div class="dnum">' + parseInt(iso.slice(8, 10), 10) + '</div>' +
        '<div class="bdots">' + icons + "</div>";
      a.addEventListener("click", function (ev) {
        if (ev.button !== 0 || ev.metaKey || ev.ctrlKey) return;
        ev.preventDefault();
        state.day = iso;
        history.pushState(null, "", location.pathname + "?d=" + iso);
        setBiome(0);
      });
      tl.appendChild(a);
    })(d);

    // A faixa vai de 3 dias atras a 10 a frente e nasce no comeco, entao o dia
    // de hoje ficava fora da tela no celular e o leitor tinha de rolar para
    // achar justamente o que veio ver. Centraliza o dia selecionado.
    // scrollLeft direto, e nao scrollIntoView: este ultimo rolaria tambem a
    // PAGINA, jogando o topo do site para fora da tela ao abrir.
    var sel = tl.querySelector(".day.selected");
    if (sel) {
      var alvo = sel.offsetLeft - (tl.clientWidth - sel.offsetWidth) / 2;
      tl.scrollLeft = Math.max(0, alvo);
    }

    document.getElementById("overview").src =
      P.img(info.scene.toLowerCase() + "/preview.jpg");
    var regions = document.getElementById("regions");
    regions.innerHTML = "";
    var span = GEO.zMax - GEO.zMin;
    biomes.forEach(function (b, i) {
      var r = document.createElement("div");
      r.className = "region" + (i === state.biome ? " selected" : "");
      r.style.flex = "0 0 " + (100 * (GEO.cuts[i + 1] - GEO.cuts[i]) / span) + "%";
      r.title = b.name + (P.hasVariant(b) ? " (" + b.variant + ")" : "");
      r.onclick = function () { setBiome(i); };
      regions.appendChild(r);
    });

    var b = biomes[state.biome];
    var titleEl = document.getElementById("biome-title");
    titleEl.innerHTML = '<h2 style="color:' + P.biomeColor(b.id) + '">' + b.name + "</h2>" +
      (P.hasVariant(b) ? '<span class="variant-tag">' + P.t("variant.tag", { v: b.variant }) + "</span>" : "");
    P.loadLevel(info.scene, function (data) {
      var alt = (data.alts || {})["b" + state.biome];
      if (alt) {
        var s = document.createElement("span");
        s.className = "alt";
        s.textContent = P.t("alt.range", { a: Math.round(alt[0]), b: Math.round(alt[1]) });
        titleEl.appendChild(s);
      }
    });

    stage.render({ scene: info.scene, biomeIdx: state.biome,
                   view: P.viewFor(state.yaw, state.pitch), layers: state.layers });
    updateAngleUI();
    renderLayerChips();
  }

  function updateAngleUI() {
    document.getElementById("view-label").textContent = P.viewLabel(P.viewFor(state.yaw, state.pitch));
    document.getElementById("a-up").disabled = state.pitch >= 2;
    document.getElementById("a-down").disabled = state.pitch <= 0;
    document.getElementById("a-left").disabled = state.pitch >= 2 || state.yaw <= 0;
    document.getElementById("a-right").disabled = state.pitch >= 2 || state.yaw >= 2;
  }
  document.getElementById("a-up").onclick = function () {
    state.pitch = Math.min(2, state.pitch + 1); updateUrl(); render();
  };
  document.getElementById("a-down").onclick = function () {
    state.pitch = Math.max(0, state.pitch - 1); updateUrl(); render();
  };
  document.getElementById("a-left").onclick = function () {
    state.yaw = Math.max(0, state.yaw - 1); updateUrl(); render();
  };
  document.getElementById("a-right").onclick = function () {
    state.yaw = Math.min(2, state.yaw + 1); updateUrl(); render();
  };

  function renderLayerChips() {
    var el = document.getElementById("layers");
    el.innerHTML = "";
    P.LAYERS.forEach(function (l) {
      var on = state.layers.has(l.key);
      var b = document.createElement("button");
      b.className = "ov-btn ov-lbtn" + (on ? " on" : "");
      b.title = P.layerLabel(l.key) + " " + P.t(on ? "layer.visible" : "layer.hidden");
      b.setAttribute("aria-label", b.title);
      b.innerHTML = '<img src="' + P.img("icons/" + l.icon) +
        '" alt="' + P.layerLabel(l.key) + '">';
      b.onclick = function () {
        if (state.layers.has(l.key)) state.layers.delete(l.key); else state.layers.add(l.key);
        render();
      };
      el.appendChild(b);
    });
  }

  document.getElementById("z-in").onclick = function () {
    stage.zoomAt(1.4, stage.el.clientWidth / 2, stage.el.clientHeight / 2);
  };
  document.getElementById("z-out").onclick = function () {
    stage.zoomAt(1 / 1.4, stage.el.clientWidth / 2, stage.el.clientHeight / 2);
  };

  window.addEventListener("popstate", function () {
    // mesma validacao do carregamento: o botao voltar traz a URL de volta e ela
    // pode ter sido editada a mao
    var q = new URLSearchParams(location.search).get("d");
    state.day = (q && validIso(q)) ? q : initialDay();
    setBiome(0);
  });

  if (fromUrl) render(); else setBiome(0);
  booted = true;
})();
