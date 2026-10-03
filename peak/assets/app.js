/* PEAK Daily Map — núcleo v3 (vanilla JS, i18n)
 * Dados: PEAK_ROTATION {version, maps[]}, PEAK_LEVELS[scene] {markers, views, alts},
 *        PEAK_LANG {code, slug, ui{}, g{}, biomes{}, items{prefab:[nome,desc]}}
 * Marcadores são neutros de língua: lk/gk/it/sk/dk são CHAVES resolvidas aqui. */
(function () {
  "use strict";

  var EPOCH_UTC = Date.UTC(2025, 5, 14, 17, 0, 0);
  var DAY_MS = 86400000;
  var P = (window.Peak = {});
  P.base = "";    // raiz de assets (../ conforme profundidade)
  P.lbase = "";   // raiz da LÍNGUA atual (base + "pt-br/" etc.)

  // ---------------- i18n ----------------
  var L = window.PEAK_LANG || { code: "en", ui: {}, g: {}, biomes: {} };
  // nomes/descricoes de item vem num pack separado, carregado so onde e preciso
  L.items = window.PEAK_LANG_ITEMS || {};
  P.langCode = L.code || "en";
  P.t = function (key, fmt) {
    var s = (L.ui && L.ui[key]) || key;
    if (fmt) for (var k in fmt) s = s.split("{" + k + "}").join(fmt[k]);
    return s;
  };
  P.itemName = function (prefab) {
    var it = L.items && L.items[prefab];
    return it ? it[0] : prefab;
  };
  P.itemDesc = function (prefab) {
    var it = L.items && L.items[prefab];
    return (it && it[1]) || "";
  };
  // hora local em que o mapa troca (17:00 UTC)
  P.switchTime = function () {
    var d = new Date();
    d.setUTCHours(17, 0, 0, 0);
    try {
      return d.toLocaleTimeString(P.langCode, { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return "17:00 UTC"; }
  };

  // ---------------- datas / rotação ----------------
  P.levelIndexForDate = function (ms) { return Math.floor((ms - EPOCH_UTC) / DAY_MS); };
  P.sceneForIndex = function (idx) {
    var n = window.PEAK_ROTATION.maps.length;
    return window.PEAK_ROTATION.maps[((idx % n) + n) % n];
  };
  // MODELO "DIA DE JOGO": a identidade de um dia e a data de ESTREIA do mapa
  // (17:00 UTC). Card, clique, F5 e /d/<data>/ resolvem SEMPRE o mesmo mapa.
  P.isoUTC = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
  P.gameDayIso = function () {
    var idx = P.levelIndexForDate(Date.now());
    return P.isoUTC(EPOCH_UTC + idx * DAY_MS);
  };
  P.indexForIso = function (iso) {
    return P.levelIndexForDate(Date.parse(iso + "T18:00:00Z"));
  };
  P.isoAddDays = function (iso, d) {
    return P.isoUTC(Date.parse(iso + "T12:00:00Z") + d * DAY_MS);
  };

  // URL de asset com a versao do jogo grudada. As capturas e os dados de cena
  // tem nome FIXO (top_b0.jpg, level_0.js), e a Cloudflare guarda /assets/ por
  // 30 dias: sem a versao na URL, o mapa novo de um patch so apareceria quando
  // o cache expirasse. Mudou o jogo, mudou a URL.
  P.ver = function (url) { return P.mapV ? url + "?v=" + P.mapV : url; };
  P.img = function (rel) { return P.ver(P.base + "assets/img/" + rel); };

  // nomes internos (enum) -> exibicao localizada (oficial do jogo, via pack)
  P.biomeName = function (enumName) { return (L.biomes && L.biomes[enumName]) || enumName; };
  // Kiln e Temple sao os DOIS finais possiveis da montanha. Kiln nao tem badge
  // propria nas 64 conquistas do jogo, mas e um bioma de lava/forja — reusa o
  // icone de "caldera" (vulcao em erupcao) em vez do Citadel, que nao combina.
  P.BIOME_SLUGS = { Volcano: "caldera", Temple: "the-citadel", Kiln: "caldera", Swamp: "gloom" };
  P.biomeSlug = function (enumName) {
    return P.BIOME_SLUGS[enumName] || enumName.toLowerCase().replace(/\s+/g, "-");
  };
  P.biomesOf = function (idx) {
    var info = P.sceneForIndex(idx);
    var out = [];
    for (var i = 0; i < 4; i++) {
      var n = info.biomes[i] || "?";
      out.push({ id: n, name: P.biomeName(n), variant: info.variants[i] || "" });
    }
    // o 5o segmento NAO esta no MapBaker: o jogo tem dois finais possiveis
    // (Kiln e Temple/Citadel), so um carregado por mapa. Vem pronto do
    // build (info.final) — nunca fixar, ou metade dos dias mostra o nome/
    // cor/icone errados (foi exatamente o bug que isto substitui).
    var fin = info.final || "Temple";
    out.push({ id: fin, name: P.biomeName(fin), variant: "" });
    return out;
  };
  P.biomeColor = function (id) {
    var map = { Shore: "--shore", Tropics: "--tropics", Roots: "--roots", Alpine: "--alpine",
                Mesa: "--mesa", Swamp: "--gloom", Temple: "--citadel", Kiln: "--caldera",
                Volcano: "--caldera" };
    return "var(" + (map[id] || "--accent") + ")";
  };
  P.hasVariant = function (b) {
    return b.variant && b.variant !== "Default" && b.variant !== "None" && b.variant !== "NoVariant";
  };

  // ---------------- carga por mapa ----------------
  var loadedCbs = {};
  P.loadLevel = function (scene, cb) {
    if (window.PEAK_LEVELS && window.PEAK_LEVELS[scene]) { cb(window.PEAK_LEVELS[scene]); return; }
    (loadedCbs[scene] = loadedCbs[scene] || []).push(cb);
    if (loadedCbs[scene].length > 1) return;
    var s = document.createElement("script");
    s.src = P.ver(P.base + "assets/data/" + scene.toLowerCase() + ".js");
    s.onload = function () {
      (loadedCbs[scene] || []).forEach(function (f) { f(window.PEAK_LEVELS[scene]); });
      loadedCbs[scene] = [];
    };
    document.head.appendChild(s);
  };

  // ---------------- vistas ----------------
  P.viewFor = function (yaw, pitch) {
    if (pitch >= 2) return "top";
    if (pitch === 1) return yaw === 0 ? "sidetop" : "fronttop";
    return yaw === 0 ? "side" : yaw === 1 ? "sidefront" : "front";
  };
  P.viewLabel = function (view) { return P.t("view." + view); };

  function project(m, g) {
    var dx = m.x - g.center[0], dy = m.y - g.center[1], dz = m.z - g.center[2];
    var pr = dx * g.right[0] + dy * g.right[1] + dz * g.right[2];
    var pu = dx * g.up[0] + dy * g.up[1] + dz * g.up[2];
    var left = 0.5 + pr / (2 * g.rw);
    var top = 0.5 - pu / (2 * g.ru);
    if (left < 0 || left > 1 || top < 0 || top > 1) return null;
    return { left: left * 100, top: top * 100 };
  }

  // ---------------- camadas ----------------
  P.LAYERS = [
    { key: "progress", icon: "campfire.png", on: true },
    { key: "structures", icon: "belltower.png", on: true },
    { key: "luggage", icon: "luggage_small.png", on: true },
    { key: "items", icon: "backpack.png", on: true },
    { key: "tricks", icon: "mimic.png", on: true },
    { key: "danger", icon: "danger.png", on: false },
  ];
  P.layerLabel = function (key) { return P.t("layer." + key); };

  // ---------------- resolucao de marcador (chaves -> texto) ----------------
  P.markerLabel = function (m) {
    if (m.gk) return (L.g && L.g[m.gk]) || m.gk;         // termo oficial do jogo
    if (m.lk) {
      var s = P.t(m.lk);
      if (m.it) s = s.split("{name}").join(P.itemName(m.it));
      return s;
    }
    if (m.it) return P.itemName(m.it);
    return P.t("marker.item_generic");
  };
  P.markerSub = function (m) { return m.sk ? P.t(m.sk) : ""; };
  P.markerDesc = function (m) {
    if (m.dk) return P.t(m.dk);
    if (m.it && !m.lk) {
      var d = P.itemDesc(m.it);
      return d.length > 140 ? d.slice(0, 140) + "…" : d;
    }
    return "";
  };
  P.markerHref = function (m) {
    if (!m.link) return null;
    if (m.link.t === "item") return P.lbase + "items/" + m.link.id + "/";
    if (m.link.t === "pool") return P.lbase + "items/#pool-" + m.link.id;
    if (m.link.t === "sec") return P.lbase + "items/#sec-" + m.link.id;
    return null;
  };

  // icones SVG (data URI) para malas sem icone custom
  function svgUri(svg) { return "url('data:image/svg+xml," + encodeURIComponent(svg) + "')"; }
  var CASE = function (fill) {
    return svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<rect x="3" y="8" width="18" height="12" rx="2" fill="' + fill + '" stroke="white" stroke-width="1.4"/>' +
      '<path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="white" stroke-width="1.8"/></svg>');
  };
  P.LUGGAGE_ICON = {
    "m-lug-small": CASE("#3f8ee0"),
    "m-lug-big": CASE("#2a5fa0"),
    "m-lug-epic": CASE("#9646c8"),
    "m-lug-ancient": CASE("#c07f28"),
  };

  // ---------------- tooltip ----------------
  var tt;
  function ensureTooltip() {
    if (!tt) { tt = document.createElement("div"); tt.id = "tooltip"; document.body.appendChild(tt); }
    return tt;
  }
  function showTooltip(ev, m) {
    var t = ensureTooltip();
    var desc = P.markerDesc(m);
    t.innerHTML = '<div class="tt-head">' +
      (m.icon ? '<img src="' + P.img("icons/" + m.icon) + '" alt="">' : "") +
      '<div><div class="tt-name">' + P.markerLabel(m) + "</div>" +
      '<div class="tt-sub">' + P.markerSub(m) + " · alt. " + Math.round(m.y) + " m</div></div></div>" +
      (desc ? '<div class="tt-desc">' + desc + "</div>" : "");
    t.style.display = "block";
    moveTooltip(ev);
  }
  function moveTooltip(ev) {
    var t = ensureTooltip();
    var x = ev.clientX + 14, y = ev.clientY + 14;
    var r = t.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    t.style.left = x + "px"; t.style.top = y + "px";
  }
  function hideTooltip() { ensureTooltip().style.display = "none"; }

  // ---------------- palco com zoom/pan ----------------
  function Stage(el) {
    this.el = el;
    el.classList.add("map-stage");
    this.inner = document.createElement("div");
    this.inner.className = "map-inner";
    el.appendChild(this.inner);
    this.z = 1; this.tx = 0; this.ty = 0;
    this._bind();
  }
  Stage.prototype._apply = function () {
    var W = this.el.clientWidth, H = this.el.clientHeight;
    var iw = W * this.z, ih = this.inner.offsetHeight * this.z;
    this.tx = Math.min(0, Math.max(W - iw, this.tx));
    this.ty = Math.min(0, Math.max(H - ih, this.ty));
    this.inner.style.transform = "translate(" + this.tx + "px," + this.ty + "px) scale(" + this.z + ")";
    this.inner.style.setProperty("--invz", 1 / this.z);
    // sem zoom, a pagina rola normalmente por cima do mapa (essencial no celular)
    this.el.style.touchAction = this.z > 1 ? "none" : "pan-y";
    this.el.style.cursor = this.z > 1 ? "grab" : "default";
    // so o ZOOM muda quem cobre quem; arrastar move tudo junto, entao refazer
    // o layout no pan seria trabalho jogado fora a cada quadro do arrasto
    if (this._relayout && this.z !== this._layoutZ) {
      this._layoutZ = this.z;
      var self = this;
      if (!this._layoutPending) {
        this._layoutPending = true;
        requestAnimationFrame(function () {
          self._layoutPending = false;
          self._relayout();
        });
      }
    }
  };
  Stage.prototype.zoomAt = function (f, cx, cy) {
    var nz = Math.min(8, Math.max(1, this.z * f));
    f = nz / this.z;
    this.tx = cx - (cx - this.tx) * f;
    this.ty = cy - (cy - this.ty) * f;
    this.z = nz;
    this._apply();
  };
  Stage.prototype.reset = function () { this.z = 1; this.tx = 0; this.ty = 0; this._apply(); };
  Stage.prototype._bind = function () {
    var self = this, dragging = false, lx = 0, ly = 0, moved = false;
    this.el.addEventListener("wheel", function (ev) {
      if (self.z === 1 && !ev.ctrlKey) return;
      ev.preventDefault();
      var r = self.el.getBoundingClientRect();
      self.zoomAt(ev.deltaY < 0 ? 1.2 : 1 / 1.2, ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });
    this.el.addEventListener("pointerdown", function (ev) {
      if (self.z === 1) return;
      dragging = true; moved = false; lx = ev.clientX; ly = ev.clientY;
      self.el.classList.add("dragging");
      self.el.setPointerCapture(ev.pointerId);
    });
    this.el.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      var dx = ev.clientX - lx, dy = ev.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      lx = ev.clientX; ly = ev.clientY;
      self.tx += dx; self.ty += dy;
      self._apply();
    });
    this.el.addEventListener("pointerup", function () { dragging = false; self.el.classList.remove("dragging"); });
    var pts = {};
    this.el.addEventListener("pointerdown", function (e) { pts[e.pointerId] = e; });
    this.el.addEventListener("pointermove", function (e) {
      if (!(e.pointerId in pts)) return;
      var prev = pts[e.pointerId]; pts[e.pointerId] = e;
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        var pa = a === e ? prev : a, pb = b === e ? prev : b;
        var d0 = Math.hypot(pa.clientX - pb.clientX, pa.clientY - pb.clientY);
        var d1 = Math.hypot(a.clientX - b.clientX, b.clientY - a.clientY);
        if (d0 > 0) {
          var r = self.el.getBoundingClientRect();
          self.zoomAt(d1 / d0, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top);
        }
      }
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (evn) {
      self.el.addEventListener(evn, function (e) { delete pts[e.pointerId]; });
    });
  };

  // renderiza uma vista no palco — opts: {scene, biomeIdx, view, layers:Set}
  Stage.prototype.render = function (opts) {
    var self = this;
    this.reset();
    this.inner.innerHTML = "";
    var img = document.createElement("img");
    img.className = "map-img";
    img.alt = P.t("alt.map_view", { v: P.viewLabel(opts.view) });
    img.src = P.img(opts.scene.toLowerCase() + "/" + opts.view + "_b" + opts.biomeIdx + ".jpg");
    this.inner.appendChild(img);

    P.loadLevel(opts.scene, function (data) {
      var g = data.views[opts.view + "_b" + opts.biomeIdx];
      if (!g) return;
      var placed = [];
      data.markers.forEach(function (m) {
        if (!opts.layers.has(m.layer)) return;
        // m.b = trecho onde o marcador REALMENTE aparece (o build decide olhando
        // a projeção); o corte por z é só o fallback de dados antigos
        if (m.b !== undefined ? m.b !== opts.biomeIdx : (m.z < g.zlo || m.z > g.zhi)) return;
        var pos = project(m, g);
        if (!pos) return;
        var el = document.createElement("div");
        el.className = "marker " + (m.cls || "");
        if (m.icon) {
          el.classList.add("icon");
          el.style.backgroundImage = "url('" + P.img("icons/" + m.icon) + "')";
        } else if (P.LUGGAGE_ICON[m.cls]) {
          el.classList.add("icon");
          el.style.backgroundImage = P.LUGGAGE_ICON[m.cls];
          el.style.backgroundColor = "transparent";
          el.style.border = "0";
          el.style.boxShadow = "none";
        }
        el.style.left = pos.left + "%";
        el.style.top = pos.top + "%";
        el.addEventListener("mouseenter", function (ev) { showTooltip(ev, m); });
        el.addEventListener("mousemove", moveTooltip);
        el.addEventListener("mouseleave", hideTooltip);
        var href = P.markerHref(m);
        if (href) {
          el.style.cursor = "pointer";
          el.addEventListener("click", function (ev) {
            ev.stopPropagation();
            location.href = href;
          });
        }
        self.inner.appendChild(el);
        placed.push({ el: el, pos: pos, danger: m.layer === "danger" });
      });
      // ---------- anti-overlap por retangulo real ----------
      // A versao antiga dividia a tela numa grade de 26px e so ENCOLHIA quem
      // caisse na mesma celula. Isso errava dos dois lados: dois marcadores na
      // MESMA coordenada continuavam empilhados (so que menores), e dois em
      // celulas vizinhas podiam se sobrepor inteiros sem ninguem notar.
      // Agora a grade e apenas INDICE ESPACIAL, para achar candidatos sem
      // comparar todos contra todos; quem decide e a sobreposicao real dos
      // retangulos como estao desenhados no zoom atual.
      //
      // Num mapa, deslocar um marcador e mentir sobre a posicao do item — por
      // isso o empurrao e limitado a MAX_SHIFT px de tela, e o que nao couber
      // nesse limite e resolvido encolhendo, nao empurrando mais.
      // O teto do empurrao acompanha o tamanho do marcador: um ponto de 13px sai
      // de cima do vizinho andando pouco, mas um icone de 26px precisa de quase
      // um diametro para se separar. Com um teto unico de 12px os icones grandes
      // ficavam presos meio sobrepostos no Mesa (288 marcadores).
      var MIN_SHIFT = 12;     // px de tela
      var SHIFT_PER_SIZE = 0.9;
      var ITER = 14;          // 8 nao convergia nos biomas mais cheios
      var sizeCache = {};

      function baseSize(p) {
        // medido UMA vez por classe (sao poucas) em vez de por elemento:
        // getComputedStyle por marcador custaria um reflow em cada um
        var k = p.el.className;
        if (sizeCache[k] == null) sizeCache[k] = p.el.offsetWidth || 20;
        return sizeCache[k];
      }

      function layoutPass() {
        var W = self.inner.clientWidth, H = self.inner.offsetHeight;
        if (!H || H < 40 || !placed.length) return;
        var z = self.z || 1;

        // devolve todo mundo ao tamanho e a posicao verdadeira antes de medir,
        // senao cada passe herdaria o resultado do anterior e o desvio somaria
        placed.forEach(function (p) {
          p.el.style.removeProperty("--msize");
          if (p.danger) p.el.style.setProperty("--msize", "11px");
        });
        placed.forEach(function (p) {
          p.x0 = p.pos.left / 100 * W;
          p.y0 = p.pos.top / 100 * H;
          p.x = p.x0; p.y = p.y0;
          // no espaco do inner o marcador ocupa offsetWidth/z, porque ele leva
          // scale(1/z) para manter o tamanho constante na tela
          p.r = baseSize(p) / z / 2;
        });

        // Indice espacial montado UMA vez. A celula leva folga do maior raio
        // MAIS do maior empurrao possivel, entao dois marcadores que so vao se
        // encontrar depois de andar ja entram na lista de candidatos agora —
        // e a lista continua valida durante toda a relaxacao.
        var maxR = 0;
        placed.forEach(function (p) { if (p.r > maxR) maxR = p.r; });
        var maxLim = Math.max(MIN_SHIFT / z, maxR * 2 * SHIFT_PER_SIZE);
        var cell = Math.max((maxR + maxLim) * 2, 1);

        var grid = {};
        for (var gi = 0; gi < placed.length; gi++) {
          var gp = placed[gi];
          var gk = ((gp.x / cell) | 0) + "_" + ((gp.y / cell) | 0);
          (grid[gk] = grid[gk] || []).push(gi);
        }
        // pares candidatos achatados em [i0,j0, i1,j1, ...]: percorrer um array
        // de numeros em 14 iteracoes nao aloca nada, enquanto refazer a busca a
        // cada passe custava dezenas de ms nos biomas cheios
        var pairs = [];
        for (var pi = 0; pi < placed.length; pi++) {
          var pp = placed[pi];
          var cx = (pp.x / cell) | 0, cy = (pp.y / cell) | 0;
          for (var a = -1; a <= 1; a++) {
            for (var b = -1; b <= 1; b++) {
              var g = grid[(cx + a) + "_" + (cy + b)];
              if (!g) continue;
              for (var n = 0; n < g.length; n++) {
                if (g[n] > pi) { pairs.push(pi); pairs.push(g[n]); }
              }
            }
          }
        }

        // 1) densidade REAL: quantos vizinhos cada um de fato cobre
        placed.forEach(function (p) { p.hits = 0; });
        for (var k = 0; k < pairs.length; k += 2) {
          var pa = placed[pairs[k]], pb = placed[pairs[k + 1]];
          if (Math.abs(pb.x - pa.x) < pa.r + pb.r && Math.abs(pb.y - pa.y) < pa.r + pb.r) {
            pa.hits++; pb.hits++;
          }
        }
        placed.forEach(function (p) {
          if (p.danger) return;                       // ja fixado em 11px
          var s = p.hits >= 5 ? 13 : p.hits >= 3 ? 15 : p.hits >= 1 ? 17 : null;
          if (s) { p.el.style.setProperty("--msize", s + "px"); p.r = (s + 4) / z / 2; }
        });
        // teto de deslocamento por marcador, ja no espaco do inner
        placed.forEach(function (p) {
          p.lim = Math.max(MIN_SHIFT / z, p.r * 2 * SHIFT_PER_SIZE);
        });

        // 2) relaxacao: separa os pares que ainda se cobrem
        for (var it = 0; it < ITER; it++) {
          var moved = false;
          for (var k2 = 0; k2 < pairs.length; k2 += 2) {
            var i2 = pairs[k2];
            var p = placed[i2], q = placed[pairs[k2 + 1]];
            var dx = q.x - p.x, dy = q.y - p.y;
            var ox = (p.r + q.r) - Math.abs(dx);
            var oy = (p.r + q.r) - Math.abs(dy);
            if (ox <= 0 || oy <= 0) continue;         // nao se tocam
            if (dx === 0 && dy === 0) {
              // exatamente na mesma coordenada: sem direcao para separar.
              // O angulo vem do indice, para o resultado ser sempre o mesmo
              var ang = i2 * 2.399963;                // ~angulo aureo
              dx = Math.cos(ang) * 0.01; dy = Math.sin(ang) * 0.01;
              ox = oy = p.r + q.r;
            }
            // empurra pelo eixo de menor penetracao: o caminho mais curto
            // para separar, e o que menos afasta da posicao verdadeira
            if (ox < oy) {
              var sx = (dx < 0 ? -1 : 1) * ox / 2;
              p.x -= sx; q.x += sx;
            } else {
              var sy = (dy < 0 ? -1 : 1) * oy / 2;
              p.y -= sy; q.y += sy;
            }
            moved = true;
          }
          // trava a distancia da posicao real DENTRO do laco: deixar para o fim
          // permitiria que um marcador cruzasse o mapa antes de ser puxado
          placed.forEach(function (p) {
            var dx = p.x - p.x0, dy = p.y - p.y0;
            var d = Math.hypot(dx, dy);
            if (d > p.lim) { p.x = p.x0 + dx / d * p.lim; p.y = p.y0 + dy / d * p.lim; }
          });
          if (!moved) break;
        }

        placed.forEach(function (p) {
          p.el.style.left = (p.x / W * 100) + "%";
          p.el.style.top = (p.y / H * 100) + "%";
        });
      }

      // o zoom afasta os marcadores mas nao muda o tamanho deles na tela, entao
      // o que se cobria com zoom 1 deixa de se cobrir — sem refazer o calculo,
      // eles ficavam encolhidos e deslocados a toa depois da aproximacao
      self._relayout = layoutPass;
      if (img.complete && img.naturalHeight) requestAnimationFrame(layoutPass);
      else img.addEventListener("load", function () { requestAnimationFrame(layoutPass); });
    });
  };

  P.Stage = Stage;
})();
