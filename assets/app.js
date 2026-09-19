(function () {
  "use strict";

  var PAGE = 60;
  var state = { all: [], filtered: [], shown: PAGE, type: "all", lang: "all", tag: "all", q: "" };

  var LANG_LABEL = { zh: "中文", en: "EN", ja: "日本語", ko: "한국어", ar: "AR", ru: "RU" };
  var LANG_FULL = { zh: "中文", en: "英文", ja: "日文", ko: "韩文", ar: "阿拉伯文", ru: "俄文" };
  var TYPE_LABEL = { video: "演示视频", long: "长文", post: "讨论" };

  var el = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function metric(it) {
    var v = (it.metrics && it.metrics.vals) || [];
    return v.length ? Math.max.apply(null, v) : 0;
  }

  function typeOf(it) {
    if (it.video) return "video";
    if (it.long) return "long";
    return "post";
  }

  function hashHue(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }

  function initials(name, handle) {
    var n = (name || handle || "?").trim();
    if (/[\u4e00-\u9fff]/.test(n)) return n.slice(0, 1);
    var parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }

  function avatarHTML(it) {
    var h = hashHue(it.handle || it.author || "x");
    var bg = "linear-gradient(135deg,hsl(" + h + ",70%,62%),hsl(" + ((h + 40) % 360) + ",70%,52%))";
    var ini = esc(initials(it.author, it.handle));
    var img = "https://unavatar.io/twitter/" + encodeURIComponent(it.handle);
    return '<div class="avatar" style="background:' + bg + '">' +
      '<span style="position:absolute;z-index:0">' + ini + "</span>" +
      '<img style="position:relative;z-index:1" src="' + img + '" alt="" loading="lazy" ' +
      'onerror="this.style.display=\'none\'">' +
      "</div>";
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return (d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function thumbHTML(it) {
    var badge = it.video ? '<span class="badge">▶ 演示</span>' : "";
    if (it.pinned) badge = '<span class="badge pin">★ 小白入门</span>';
    var lang = '<span class="lang">' + (LANG_LABEL[it.lang] || it.lang) + "</span>";
    var inner = it.thumb
      ? '<img src="' + esc(it.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : "";
    var play = it.video ? '<div class="play"><span>▶</span></div>' : "";
    return '<div class="thumb">' + inner + play + badge + lang + "</div>";
  }

  function tagsHTML(it) {
    return (it.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
  }

  function cardHTML(it) {
    return '<a class="card' + (it.pinned ? " pinned" : "") + '" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
      thumbHTML(it) +
      '<div class="card-body">' +
        '<div class="card-meta">' + avatarHTML(it) +
          '<div class="who"><b>' + esc(it.author || it.handle) + "</b><span>@" + esc(it.handle) + "</span></div>" +
        "</div>" +
        '<p class="card-text">' + esc(it.text) + "</p>" +
        '<div class="card-tags">' + tagsHTML(it) + "</div>" +
      "</div>" +
      '<div class="card-foot"><span>' + fmtDate(it.date) + "</span>" +
        '<span class="go">查看原帖 →</span></div>' +
      "</a>";
  }

  function featuredHTML(it) {
    var thumb = it.thumb
      ? '<img src="' + esc(it.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : (it.video ? '<div class="play"><span>▶</span></div>' : "");
    return '<a class="fcard" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
      '<div class="fthumb">' + thumb + "</div>" +
      '<div class="fcard-body">' +
        '<div class="fcard-meta"><span class="fcard-author">' + esc(it.author || it.handle) + "</span>" +
          "<span>@" + esc(it.handle) + "</span><span>·</span><span>" + fmtDate(it.date) + "</span></div>" +
        '<p class="fcard-text">' + esc(it.text) + "</p>" +
        '<div class="fcard-tags">' + tagsHTML(it) + "</div>" +
      "</div></a>";
  }

  // ---------- render ----------
  function renderStats(meta) {
    // 与类型标签保持同一口径：视频优先，长文指「非视频的长文」，三者互斥
    var all = state.all || [];
    var v = 0, l = 0, seen = {};
    all.forEach(function (it) {
      if (it.video) v++;
      else if (it.long) l++;
      seen[it.handle] = 1;
    });
    el("s-total").textContent = all.length;
    el("s-video").textContent = v;
    el("s-long").textContent = l;
    el("s-author").textContent = Object.keys(seen).length;
    var f = new Date(meta.window_from), t = new Date(meta.window_to);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    var fmt = function (d) { return p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); };
    el("windowText").textContent = fmt(f) + " – " + fmt(t);
    el("genAt").textContent = fmt(t);
  }

  function renderFeatured(items) {
    var top = items.slice().sort(function (a, b) { return metric(b) - metric(a); }).slice(0, 8);
    el("featuredGrid").innerHTML = top.map(featuredHTML).join("");
  }

  function buildChips(container, options, key) {
    container.innerHTML = options.map(function (o) {
      return '<button class="chip' + (o.value === state[key] ? " on" : "") +
        '" data-k="' + key + '" data-v="' + esc(o.value) + '">' + esc(o.label) +
        (o.count != null ? " " + o.count : "") + "</button>";
    }).join("");
  }

  // 统计时忽略 exceptKey 这一维度，从而让各维度计数随其他已选条件联动
  function baseMatch(it, exceptKey) {
    if (exceptKey !== "type" && state.type !== "all" && typeOf(it) !== state.type) return false;
    if (exceptKey !== "lang" && state.lang !== "all" && it.lang !== state.lang) return false;
    if (exceptKey !== "tag" && state.tag !== "all" && (it.tags || []).indexOf(state.tag) < 0) return false;
    return true;
  }

  function countDim(dim, value) {
    var n = 0;
    state.all.forEach(function (it) {
      if (!baseMatch(it, dim)) return;
      if (dim === "type") { if (typeOf(it) === value) n++; }
      else if (dim === "lang") { if (it.lang === value) n++; }
      else if ((it.tags || []).indexOf(value) >= 0) n++;
    });
    return n;
  }

  function totalDim(dim) {
    var n = 0;
    state.all.forEach(function (it) { if (baseMatch(it, dim)) n++; });
    return n;
  }

  function renderFilters() {
    var all = state.all;

    // 若某维度当前选中项在新条件下已无结果，自动回退到「全部」
    ["type", "lang", "tag"].forEach(function (dim) {
      if (state[dim] !== "all" && countDim(dim, state[dim]) === 0) state[dim] = "all";
    });

    // 类型
    var tOpts = [{ value: "all", label: "全部", count: totalDim("type") }];
    [["video", "演示视频"], ["long", "长文"], ["post", "讨论"]].forEach(function (p) {
      var c = countDim("type", p[0]);
      if (c > 0 || state.type === p[0]) tOpts.push({ value: p[0], label: p[1], count: c });
    });
    buildChips(el("typeChips"), tOpts, "type");

    // 语言
    var langs = {};
    all.forEach(function (i) { langs[i.lang] = (langs[i.lang] || 0) + 1; });
    var langOpts = [{ value: "all", label: "全部", count: totalDim("lang") }];
    Object.keys(langs).sort(function (a, b) { return langs[b] - langs[a]; }).forEach(function (l) {
      var c = countDim("lang", l);
      if (c > 0 || state.lang === l) langOpts.push({ value: l, label: LANG_FULL[l] || l, count: c });
    });
    buildChips(el("langChips"), langOpts, "lang");

    // 主题
    var tags = {};
    all.forEach(function (i) { (i.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var tagOpts = [{ value: "all", label: "全部", count: totalDim("tag") }];
    Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; }).forEach(function (t) {
      var c = countDim("tag", t);
      if (c > 0 || state.tag === t) tagOpts.push({ value: t, label: t, count: c });
    });
    buildChips(el("tagChips"), tagOpts, "tag");
  }

  function apply() {
    renderFilters();
    var q = state.q.trim().toLowerCase();
    state.filtered = state.all.filter(function (i) {
      if (state.type !== "all" && typeOf(i) !== state.type) return false;
      if (state.lang !== "all" && i.lang !== state.lang) return false;
      if (state.tag !== "all" && (i.tags || []).indexOf(state.tag) < 0) return false;
      if (q) {
        var hay = (i.text + " " + i.author + " " + i.handle + " " + (i.tags || []).join(" ")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    state.shown = PAGE;
    renderGrid();
  }

  function renderGrid() {
    var list = state.filtered.slice(0, state.shown);
    var grid = el("grid");
    if (!list.length) {
      grid.innerHTML = '<div class="empty">没有匹配的动态，换个筛选条件试试。</div>';
    } else {
      grid.innerHTML = list.map(cardHTML).join("");
    }
    el("resultCount").textContent = "共 " + state.filtered.length + " 条";
    el("loadMore").hidden = state.shown >= state.filtered.length;
  }

  // ---------- events ----------
  document.addEventListener("click", function (e) {
    var chip = e.target.closest ? e.target.closest(".chip") : null;
    if (!chip) return;
    var k = chip.getAttribute("data-k"), v = chip.getAttribute("data-v");
    state[k] = v;
    apply();
  });

  var searchTimer;
  el("search").addEventListener("input", function (e) {
    clearTimeout(searchTimer);
    var val = e.target.value;
    searchTimer = setTimeout(function () { state.q = val; apply(); }, 180);
  });

  el("loadMore").addEventListener("click", function () {
    state.shown += PAGE;
    renderGrid();
  });

  // ---------- boot ----------
  fetch("data/posts.json")
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) {
      state.all = data.items || [];
      renderStats(data.meta || {});
      renderFeatured(state.all);
      apply();
    })
    .catch(function (err) {
      el("grid").innerHTML = '<div class="empty">数据加载失败：' + esc(err.message) +
        "<br>请通过本地服务器或 GitHub Pages 访问。</div>";
    });
})();
