(function () {
  "use strict";

  var PAGE = 60;
  var H24 = 24 * 3600 * 1000;
  var state = { all: [], filtered: [], shown: PAGE, time: "24h", type: "all", lang: "all", tag: "all", q: "" };
  var REF = Date.now(); // 时间窗口的参照点：取最近一次更新时间

  var LANG_LABEL = { zh: "中文", en: "EN", ja: "日本語", ko: "한국어", ar: "AR", ru: "RU" };
  var LANG_FULL = { zh: "中文", en: "英文", ja: "日文", ko: "韩文", ar: "阿拉伯文", ru: "俄文" };

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

  function ts(it) { return new Date(it.date).getTime(); }

  function inWindow(it, w) {
    if (w === "all") return true;
    return (REF - ts(it)) <= H24;
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

  // ---------- 统计 ----------
  function countsOf(list) {
    var v = 0, l = 0, seen = {};
    list.forEach(function (it) {
      if (it.video) v++;
      else if (it.long) l++;
      seen[it.handle] = 1;
    });
    return { total: list.length, video: v, long: l, author: Object.keys(seen).length };
  }

  function renderStats(meta) {
    var all = state.all || [];
    var c = countsOf(all);
    el("s-total").textContent = c.total;
    el("s-video").textContent = c.video;
    el("s-long").textContent = c.long;
    el("s-author").textContent = c.author;

    var recent = all.filter(function (it) { return inWindow(it, "24h"); });
    var rc = countsOf(recent);
    el("statsNote").textContent = "其中最近 24 小时：" + rc.total + " 条动态 · " + rc.video + " 个演示视频 · " + rc.long + " 篇长文";

    var t = new Date(meta.generated_at || Date.now());
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    var fmt = function (d) { return p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); };
    el("windowText").textContent = fmt(t);
    el("genAt").textContent = fmt(t);
  }

  function renderFeatured(items) {
    var recent = items.filter(function (it) { return !it.pinned && inWindow(it, "24h"); });
    var rest = items.filter(function (it) { return !it.pinned && !inWindow(it, "24h"); });
    var byMetric = function (a, b) { return metric(b) - metric(a); };
    var top = recent.slice().sort(byMetric);
    if (top.length < 8) top = top.concat(rest.slice().sort(byMetric));
    el("featuredGrid").innerHTML = top.slice(0, 8).map(featuredHTML).join("");
  }

  // ---------- 筛选 ----------
  function buildChips(container, options, key) {
    container.innerHTML = options.map(function (o) {
      return '<button class="chip' + (o.value === state[key] ? " on" : "") +
        '" data-k="' + key + '" data-v="' + esc(o.value) + '">' + esc(o.label) +
        (o.count != null ? " " + o.count : "") + "</button>";
    }).join("");
  }

  // 统计时忽略 exceptKey 这一维度，从而让各维度计数随其他已选条件联动
  function baseMatch(it, exceptKey) {
    if (exceptKey !== "time" && !inWindow(it, state.time)) return false;
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
      else if (dim === "tag") { if ((it.tags || []).indexOf(value) >= 0) n++; }
      else if (dim === "time") { if (inWindow(it, value)) n++; }
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

    // 若某维度当前选中项在新条件下已无结果，自动回退到默认
    ["time", "type", "lang", "tag"].forEach(function (dim) {
      if (dim === "time") {
        if (countDim("time", state.time) === 0 && countDim("time", "all") > 0) state.time = "all";
      } else if (state[dim] !== "all" && countDim(dim, state[dim]) === 0) {
        state[dim] = "all";
      }
    });

    // 时间
    buildChips(el("timeChips"), [
      { value: "24h", label: "最近 24 小时", count: countDim("time", "24h") },
      { value: "all", label: "全部", count: countDim("time", "all") }
    ], "time");

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
      if (!inWindow(i, state.time)) return false;
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

  // ---------- 事件 ----------
  document.addEventListener("click", function (e) {
    var chip = e.target.closest ? e.target.closest(".chip") : null;
    if (!chip) return;
    state[chip.getAttribute("data-k")] = chip.getAttribute("data-v");
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

  // ---------- 启动 ----------
  fetch("data/posts.json")
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) {
      state.all = data.items || [];
      var meta = data.meta || {};
      var ref = new Date(meta.generated_at || meta.window_to || Date.now()).getTime();
      if (isFinite(ref)) REF = ref;
      renderStats(meta);
      renderFeatured(state.all);
      apply();
    })
    .catch(function (err) {
      el("grid").innerHTML = '<div class="empty">数据加载失败：' + esc(err.message) +
        "<br>请通过本地服务器或 GitHub Pages 访问。</div>";
    });
})();
