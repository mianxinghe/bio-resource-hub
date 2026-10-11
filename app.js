/* 生科院学习资料库 - 前端逻辑 v2（含收藏/最近/主题/复制链接） */
(function () {
  "use strict";
  var DATA = window.DATA;
  var ALL = "全部";
  var LS_FAVS = "biohub_favs", LS_RECENT = "biohub_recent", LS_THEME = "biohub_theme";

  var CAT_COLOR = {
    "公共基础": "#607d8b", "化学基础": "#00897b", "专业核心": "#2e7d32",
    "专业方向": "#3949ab", "实验课": "#ef6c00",
  };
  var TYPE_COLOR = {
    "课件": "#2196f3", "复习题": "#ff9800", "试卷": "#e53935", "答案": "#4caf50",
    "名词解释": "#9c27b0", "复习大纲": "#00acc1", "其他": "#607d8b",
  };
  var EXT_ICON = {
    ".pdf": "📕", ".doc": "📘", ".docx": "📘", ".ppt": "📙", ".pptx": "📙",
    ".xls": "📗", ".xlsx": "📗", ".zip": "🗜️", ".rar": "🗜️", ".7z": "🗜️",
    ".jpg": "🖼️", ".jpeg": "🖼️", ".png": "🖼️", ".txt": "📄", ".md": "📄",
  };
  function icon(ext) { return EXT_ICON[ext] || "📄"; }
  function fmtSize(b) {
    if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB";
    if (b >= 1024) return Math.round(b / 1024) + " KB";
    return b + " B";
  }
  function loadJSON(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var allFiles = [];
  var courses = [];
  DATA.categories.forEach(function (cat) {
    cat.courses.forEach(function (c) {
      courses.push({ name: c.name, category: cat.name, count: c.count, files: c.files });
      c.files.forEach(function (f) {
        allFiles.push({ course: c.name, category: cat.name, f: f });
      });
    });
  });

  var $ = function (id) { return document.getElementById(id); };
  var grid = $("grid"), results = $("results"), detail = $("detail"),
      empty = $("empty"), cats = $("cats"), search = $("search"), themeBtn = $("theme");

  $("stats").textContent =
    " · " + DATA.stats.courses + " 门课程 · " + DATA.stats.files + " 份资料 · " + DATA.stats.sizeMB + " MB";

  var curCat = ALL, curQuery = "", curCourse = null, curType = ALL, curView = "grid";
  var favs = loadJSON(LS_FAVS, []);      // [{file, course, title, type, ext, size, preview}]
  var recent = loadJSON(LS_RECENT, []);

  /* ---------- theme ---------- */
  if (loadJSON(LS_THEME, "light") === "dark") document.body.classList.add("dark");
  themeBtn.onclick = function () {
    document.body.classList.toggle("dark");
    saveJSON(LS_THEME, document.body.classList.contains("dark") ? "dark" : "light");
    themeBtn.textContent = document.body.classList.contains("dark") ? "☀️ 浅色" : "🌙 深色";
  };
  themeBtn.textContent = document.body.classList.contains("dark") ? "☀️ 浅色" : "🌙 深色";

  /* ---------- favorites / recent helpers ---------- */
  function favKey(e) { return e.f.file; }
  function isFav(e) { return favs.some(function (x) { return x.file === e.f.file; }); }
  function toggleFav(e) {
    if (isFav(e)) { favs = favs.filter(function (x) { return x.file !== e.f.file; }); }
    else {
      favs.unshift({
        file: e.f.file, course: e.course, title: e.f.title, type: e.f.type,
        ext: e.f.ext, size: e.f.size, preview: e.f.preview, review: e.f.review,
      });
    }
    saveJSON(LS_FAVS, favs);
    refreshFavBadge();
  }
  function pushRecent(e) {
    var key = e.f.file;
    recent = recent.filter(function (x) { return x.file !== key; });
    recent.unshift({
      file: e.f.file, course: e.course, title: e.f.title, type: e.f.type,
      ext: e.f.ext, size: e.f.size, preview: e.f.preview, review: e.f.review,
    });
    recent = recent.slice(0, 30);
    saveJSON(LS_RECENT, recent);
  }
  function refreshFavBadge() {
    var b = $("favBadge");
    if (b) b.textContent = favs.length ? favs.length : "";
  }

  /* ---------- category chips ---------- */
  function renderCats() {
    cats.innerHTML = "";
    var chipDefs = [];
    chipDefs.push({ id: "grid", label: ALL + "（" + courses.length + "）" });
    chipDefs.push({ id: "fav", label: "⭐ 收藏（" + favs.length + "）" });
    chipDefs.push({ id: "recent", label: "🕘 最近" });
    chipDefs.push({ id: "remote", label: "📥 同学们上传（" + remoteFiles.length + "）" });
    DATA.categories.forEach(function (c) {
      chipDefs.push({ id: "cat:" + c.id, label: c.id + "（" + c.courses.length + "）" });
    });
    var activeKey = curView === "grid" ? (curCat === ALL ? "grid" : "cat:" + curCat) : curView;
    chipDefs.forEach(function (d) {
      var chip = document.createElement("button");
      chip.className = "cat-chip" + (d.id === activeKey ? " active" : "");
      chip.textContent = d.label;
      chip.onclick = function () {
        search.value = ""; curQuery = "";
        hideDetail();
        if (d.id === "fav" || d.id === "recent") {
          curView = d.id;
          renderCats(); renderList(d.id);
        } else if (d.id === "remote") {
          curView = "remote";
          renderCats(); renderRemote();
        } else if (d.id === "grid") {
          curView = "grid"; curCat = ALL;
          renderCats(); renderGrid();
        } else {
          curView = "grid"; curCat = d.id.slice(4);
          renderCats(); renderGrid();
        }
      };
      cats.appendChild(chip);
    });
  }

  /* ---------- course grid ---------- */
  function renderGrid() {
    results.classList.add("hidden");
    empty.classList.add("hidden");
    var list = courses.filter(function (c) { return curCat === ALL || c.category === curCat; });
    grid.classList.remove("hidden");
    grid.innerHTML = "";
    if (!list.length) { empty.classList.remove("hidden"); return; }
    list.forEach(function (c) {
      var card = document.createElement("div");
      card.className = "course-card";
      card.style.setProperty("--cat-color", CAT_COLOR[c.category] || "#2e7d32");
      var h = document.createElement("h3");
      h.textContent = c.name;
      var meta = document.createElement("div");
      meta.className = "meta";
      var tag = document.createElement("span");
      tag.className = "cat-tag";
      tag.textContent = c.category;
      var cnt = document.createElement("span");
      cnt.textContent = c.count + " 份资料";
      meta.appendChild(tag); meta.appendChild(cnt);
      card.appendChild(h); card.appendChild(meta);
      card.onclick = function () { openCourse(c.name); };
      grid.appendChild(card);
    });
  }

  /* ---------- favorites / recent list view ---------- */
  function renderList(view) {
    grid.classList.add("hidden");
    empty.classList.add("hidden");
    detail.classList.add("hidden");
    detail.innerHTML = "";
    results.classList.remove("hidden");
    results.innerHTML = "";
    var list = view === "fav" ? favs : recent;
    var h = document.createElement("h2");
    h.textContent = view === "fav"
      ? "⭐ 收藏的资料（" + list.length + "）"
      : "🕘 最近查看（" + list.length + "）";
    results.appendChild(h);
    if (!list.length) {
      var tip = document.createElement("p");
      tip.className = "empty";
      tip.style.padding = "20px 0";
      tip.textContent = view === "fav"
        ? "还没有收藏任何资料。点开任意课程，在文件右侧点 ⭐ 即可收藏。"
        : "还没有浏览记录。去点开几份资料看看吧～";
      results.appendChild(tip);
      return;
    }
    list.forEach(function (x) {
      results.appendChild(fileRow({ course: x.course, category: null, f: x }, true));
    });
  }

  /* ---------- file row builder ---------- */
  function fileRow(entry, showCourse) {
    var row = document.createElement("div");
    row.className = "file-row";
    var fi = document.createElement("div");
    fi.className = "ficon";
    fi.textContent = icon(entry.f.ext);
    var main = document.createElement("div");
    main.className = "fmain";
    var t = document.createElement("div");
    t.className = "ftitle";
    t.textContent = entry.f.title + (entry.f.review ? " ⚠️" : "");
    var sub = document.createElement("div");
    sub.className = "fsub";
    var b = document.createElement("span");
    b.className = "badge";
    b.style.background = TYPE_COLOR[entry.f.type] || "#607d8b";
    b.textContent = entry.f.type;
    sub.appendChild(b);
    if (showCourse) {
      var cs = document.createElement("span");
      cs.textContent = "📚 " + entry.course;
      sub.appendChild(cs);
    }
    var sz = document.createElement("span");
    sz.textContent = fmtSize(entry.f.size);
    sub.appendChild(sz);
    if (entry.f.review) {
      var rv = document.createElement("span");
      rv.className = "badge review";
      rv.textContent = "名字待确认";
      sub.appendChild(rv);
    }
    if (entry.f.remote) {
      var bd = document.createElement("span");
      bd.className = "badge";
      bd.style.background = "#8e24aa";
      bd.textContent = "同学上传";
      sub.appendChild(bd);
      var up = document.createElement("span");
      up.textContent = "👤 " + (entry.f.uploader || "匿名") + (entry.f.created_at ? " · " + entry.f.created_at.slice(0, 10) : "");
      sub.appendChild(up);
    }
    main.appendChild(t); main.appendChild(sub);

    var acts = document.createElement("div");
    acts.className = "file-actions";
    // star
    var star = document.createElement("button");
    star.className = "icon-btn" + (isFav(entry) ? " on" : "");
    star.title = "收藏 / 取消收藏";
    star.textContent = isFav(entry) ? "⭐" : "☆";
    star.onclick = function () { toggleFav(entry); star.textContent = isFav(entry) ? "⭐" : "☆"; star.classList.toggle("on", isFav(entry)); };
    acts.appendChild(star);
    // copy link
    var link = document.createElement("button");
    link.className = "icon-btn";
    link.title = "复制链接";
    link.textContent = "🔗";
    link.onclick = function () { copyLink(entry, link); };
    acts.appendChild(link);
    // view / download
    var href = entry.f.remote ? entry.f.url : entry.f.file;
    var viewBtn = document.createElement("a");
    viewBtn.className = "btn primary";
    viewBtn.href = entry.f.preview_pdf || href;
    viewBtn.textContent = entry.f.preview ? "查看" : "下载";
    viewBtn.target = "_blank";
    viewBtn.rel = "noopener";
    if (!entry.f.preview) viewBtn.setAttribute("download", "");
    viewBtn.onclick = function () { pushRecent(entry); renderCats(); };
    acts.appendChild(viewBtn);
    if (entry.f.preview) {
      var dl = document.createElement("a");
      dl.className = "btn";
      dl.href = href;
      dl.setAttribute("download", "");
      dl.textContent = "下载";
      dl.onclick = function () { pushRecent(entry); renderCats(); };
      acts.appendChild(dl);
    }
    if (entry.f.remote && adminMode) {
      var del = document.createElement("button");
      del.className = "icon-btn";
      del.title = "删除（管理员）";
      del.textContent = "🗑️";
      del.onclick = function () { doDelete(entry.f, del); };
      acts.appendChild(del);
    }
    row.appendChild(fi); row.appendChild(main); row.appendChild(acts);
    return row;
  }

  function copyLink(entry, btn) {
    var url = new URL(entry.f.remote ? entry.f.url : entry.f.file, location.href.split("#")[0]).href;
    function ok() { btn.textContent = "✅"; setTimeout(function () { btn.textContent = "🔗"; }, 1200); }
    function fail() {
      var ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) { btn.textContent = "❌"; }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, fail);
    } else fail();
  }

  /* ---------- course detail ---------- */
  function openCourse(name) {
    curCourse = name; curType = ALL;
    location.hash = "c=" + encodeURIComponent(name);
    var c = null;
    courses.forEach(function (x) { if (x.name === name) c = x; });
    if (!c) return;
    grid.classList.add("hidden");
    results.classList.add("hidden");
    empty.classList.add("hidden");
    detail.classList.remove("hidden");
    detail.innerHTML = "";
    var back = document.createElement("button");
    back.className = "back-btn";
    back.textContent = "← 返回课程列表";
    back.onclick = function () { hideDetail(); renderCats(); renderGrid(); };
    detail.appendChild(back);
    var head = document.createElement("div");
    head.className = "course-head";
    var h = document.createElement("span");
    h.className = "cname";
    h.textContent = c.name;
    var cc = document.createElement("span");
    cc.className = "ccount";
    cc.textContent = c.count + " 份资料";
    head.appendChild(h); head.appendChild(cc);
    detail.appendChild(head);

    var chips = document.createElement("div");
    chips.className = "type-chips";
    var types = [ALL].concat(c.files.map(function (f) { return f.type; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }));
    types.forEach(function (tp) {
      var chip = document.createElement("button");
      chip.className = "cat-chip" + (tp === curType ? " active" : "");
      chip.textContent = tp + "（" + (tp === ALL ? c.files.length :
        c.files.filter(function (f) { return f.type === tp; }).length) + "）";
      chip.onclick = function () { curType = tp; openCourse(name); };
      chips.appendChild(chip);
    });
    detail.appendChild(chips);

    var listWrap = document.createElement("div");
    detail.appendChild(listWrap);
    var q = (curQuery || "").toLowerCase();
    c.files.filter(function (f) {
      if (curType !== ALL && f.type !== curType) return false;
      if (!q) return true;
      return (f.title + f.type).toLowerCase().indexOf(q) >= 0;
    }).forEach(function (f) {
      listWrap.appendChild(fileRow({ course: c.name, category: null, f: f }, false));
    });
  }
  function hideDetail() {
    detail.classList.add("hidden");
    detail.innerHTML = "";
    curCourse = null;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  /* ---------- search ---------- */
  function doSearch() {
    curQuery = search.value.trim();
    if (location.hash) hideDetail();
    if (!curQuery) {
      if (curView === "fav") { renderList("fav"); return; }
      if (curView === "recent") { renderList("recent"); return; }
      if (curView === "remote") { renderRemote(); return; }
      renderGrid();
      return;
    }
    var q = curQuery.toLowerCase();
    grid.classList.add("hidden");
    results.classList.remove("hidden");
    results.innerHTML = "";
    var matchedCourses = courses.filter(function (c) {
      return c.name.toLowerCase().indexOf(q) >= 0;
    });
    var matchedFiles = allFiles.filter(function (e) {
      return (e.f.title + e.f.type + e.course).toLowerCase().indexOf(q) >= 0;
    });
    var matchedRemote = remoteFiles.filter(function (e) {
      return (e.f.title + e.f.type + e.course).toLowerCase().indexOf(q) >= 0;
    });
    var any = matchedCourses.length || matchedFiles.length || matchedRemote.length;
    empty.classList.toggle("hidden", any);
    if (matchedCourses.length) {
      var h1 = document.createElement("h2");
      h1.textContent = "📚 匹配的课程（" + matchedCourses.length + "）";
      results.appendChild(h1);
      var g = document.createElement("div");
      g.className = "grid";
      matchedCourses.forEach(function (c) {
        var card = document.createElement("div");
        card.className = "course-card";
        card.style.setProperty("--cat-color", CAT_COLOR[c.category] || "#2e7d32");
        var hh = document.createElement("h3");
        hh.textContent = c.name;
        card.appendChild(hh);
        card.onclick = function () { search.value = ""; curView = "grid"; openCourse(c.name); };
        g.appendChild(card);
      });
      results.appendChild(g);
    }
    if (matchedFiles.length) {
      var h2 = document.createElement("h2");
      h2.textContent = "📄 匹配的资料（" + matchedFiles.length + "）";
      results.appendChild(h2);
      matchedFiles.slice(0, 60).forEach(function (e) {
        results.appendChild(fileRow(e, true));
      });
    }
    if (matchedRemote.length) {
      var h3 = document.createElement("h2");
      h3.textContent = "📥 同学们上传的匹配（" + matchedRemote.length + "）";
      results.appendChild(h3);
      matchedRemote.slice(0, 40).forEach(function (e) {
        results.appendChild(fileRow(e, true));
      });
    }
  }

  search.addEventListener("input", doSearch);

  /* ---------- hash routing ---------- */
  function route() {
    var m = location.hash.match(/^#c=(.+)$/);
    if (m) {
      var name = decodeURIComponent(m[1]);
      var ok = courses.some(function (c) { return c.name === name; });
      if (ok) { curView = "grid"; openCourse(name); return; }
    }
    renderCats();
    renderGrid();
  }

  /* ---------- upload / admin / remote ---------- */
  var remoteFiles = [];
  var adminMode = !!sessionStorage.getItem("biohub_admin");

  function loadRemote() {
    if (!SUPA.enabled()) return;
    SUPA.listFiles().then(function (rows) {
      remoteFiles = (rows || []).map(function (r) {
        return {
          course: r.course,
          f: {
            title: r.title, type: r.type, ext: r.ext, size: r.size,
            preview: true, remote: true, url: SUPA.publicUrl(r.storage_path),
            id: r.id, uploader: r.uploader, created_at: r.created_at,
          },
        };
      });
      renderCats();
      if (curView === "remote") renderRemote();
      if (curQuery) doSearch();
    }).catch(function (e) { console.warn("loadRemote failed:", e); });
  }

  function renderRemote() {
    grid.classList.add("hidden");
    empty.classList.add("hidden");
    detail.classList.add("hidden");
    detail.innerHTML = "";
    results.classList.remove("hidden");
    results.innerHTML = "";
    var h = document.createElement("h2");
    h.textContent = "📥 同学们上传（" + remoteFiles.length + "，最新的在前）";
    results.appendChild(h);
    if (!SUPA.enabled()) {
      var tip = document.createElement("p");
      tip.className = "empty";
      tip.style.padding = "20px 0";
      tip.textContent = "上传功能需要后端支持，目前尚未配置（等待 Supabase 对接）。";
      results.appendChild(tip);
      return;
    }
    if (!remoteFiles.length) {
      var tip2 = document.createElement("p");
      tip2.className = "empty";
      tip2.style.padding = "20px 0";
      tip2.textContent = "还没有同学上传资料。点右上角「➕ 上传资料」做第一个分享的人～";
      results.appendChild(tip2);
      return;
    }
    remoteFiles.forEach(function (e) { results.appendChild(fileRow(e, true)); });
  }

  /* ---- auto classification ---- */
  var TYPE_RULES = [
    ["名词解释", /名词解释/],
    ["试卷", /带答案|及答案|及参考答案|含答案|试题\+答案|试题及答案/],
    ["答案", /答案|参考答案|评分标准|标准答案/],
    ["试卷", /模拟题|试题|试卷|真题|期中|期末|测试题|考题|考试|A卷|B卷/i],
    ["复习题", /复习题|习题|练习|题库|思考|简答|填空|选择|测验/],
    ["复习大纲", /提纲|大纲|要点|重点|小册子|复习/],
    ["课件", /课件|讲义|专题|第[一二三四五六七八九十\d]+[章节]/],
  ];
  function guessType(name) {
    for (var i = 0; i < TYPE_RULES.length; i++) {
      if (TYPE_RULES[i][1].test(name)) return TYPE_RULES[i][0];
    }
    return "其他";
  }
  var COURSE_KW = [
    ["生物化学A", ["生化", "生物化学", "section", "糖代谢", "脂质代谢", "核苷酸", "蛋白质", "氨基酸", "酶学"]],
    ["微生物", ["微生物"]],
    ["细胞生物学", ["细胞生物", "细胞学"]],
    ["动物生理学", ["动物生理", "生理学"]],
    ["动物生物学", ["动物生物", "动物学", "普通动物"]],
    ["植物生物学", ["植物生物", "植物学"]],
    ["发育生物学", ["发育生物", "发育学"]],
    ["遗传学", ["遗传"]],
    ["基因工程", ["基因工程"]],
    ["细胞工程", ["细胞工程"]],
    ["蛋白质与酶工程", ["蛋白质与酶", "酶工程", "蛋白工程"]],
    ["生物制药工程", ["生物制药", "制药"]],
    ["生物育种学", ["育种"]],
    ["现代仪器分析", ["仪器分析", "仪器"]],
    ["试验设计", ["试验设计", "实验设计"]],
    ["高等数学", ["高数", "高等数学"]],
    ["线性代数", ["线代", "线性代数"]],
    ["概率统计", ["概率", "概统"]],
    ["有机化学", ["有机化学", "有机"]],
    ["无机及分析化学1", ["无机及分析1", "无机化学1", "无及分1"]],
    ["无机及分析化学2", ["无机及分析2", "无机化学2", "无及分2"]],
    ["基础化学实验1", ["化学实验", "基础化学"]],
    ["思想政治", ["思政", "思想政治"]],
    ["习思想", ["习思想"]],
    ["马克思主义基本原理", ["马原", "马克思主义"]],
    ["毛泽东思想和中国特色社会主义理论体系概论", ["毛概", "毛泽东思想", "中特"]],
    ["中国近代史纲要", ["近代史", "史纲"]],
    ["动物生物学实验", ["动物实验", "动物学实验"]],
  ];
  function guessCourse(name) {
    var n = name.toLowerCase();
    for (var i = 0; i < COURSE_KW.length; i++) {
      var c = COURSE_KW[i][0];
      for (var j = 0; j < COURSE_KW[i][1].length; j++) {
        if (n.indexOf(COURSE_KW[i][1][j]) >= 0) return c;
      }
    }
    return "";
  }

  /* ---- modals ---- */
  function openModal(id) { $(id).classList.remove("hidden"); }
  function closeModal(id) { $(id).classList.add("hidden"); }
  document.querySelectorAll("[data-close]").forEach(function (b) {
    b.onclick = function () { closeModal(b.getAttribute("data-close")); };
  });
  $("uploadBtn").onclick = function () {
    if (!SUPA.enabled()) $("uploadBackendTip").classList.remove("hidden");
    else $("uploadBackendTip").classList.add("hidden");
    openModal("uploadModal");
  };
  $("adminBtn").onclick = function () { openModal("adminModal"); };

  /* ---- upload form ---- */
  var upCourse = $("upCourse"), upCourseCustom = $("upCourseCustom"),
      upType = $("upType"), upFiles = $("upFiles"), upTitle = $("upTitle"),
      upUploader = $("upUploader"), upStatus = $("upStatus"),
      courseTag = $("courseTag"), typeTag = $("typeTag");
  (function () {
    courses.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.name;
      o.textContent = c.name;
      upCourse.appendChild(o);
    });
    var oc = document.createElement("option");
    oc.value = "__custom";
    oc.textContent = "➕ 其他（新课程）";
    upCourse.appendChild(oc);
  })();
  upCourse.onchange = function () {
    upCourseCustom.classList.toggle("hidden", upCourse.value !== "__custom");
    if (upCourse.value !== "__custom") courseTag.textContent = "";
  };
  upFiles.onchange = function () {
    if (!upFiles.files.length) return;
    var n = upFiles.files[0].name;
    upType.value = guessType(n);
    typeTag.textContent = "已自动识别，可修改";
    var c = guessCourse(n);
    if (c) {
      upCourse.value = c;
      upCourseCustom.classList.add("hidden");
      courseTag.textContent = "已自动识别，可修改";
    } else {
      courseTag.textContent = "";
    }
  };
  $("uploadForm").onsubmit = function (ev) {
    ev.preventDefault();
    if (!SUPA.enabled()) {
      upStatus.className = "status err";
      upStatus.textContent = "⚠️ 后端尚未配置，暂时无法上传。";
      return;
    }
    var files = upFiles.files;
    if (!files.length) {
      upStatus.className = "status err";
      upStatus.textContent = "请先选择文件。";
      return;
    }
    var course = upCourse.value === "__custom"
      ? (upCourseCustom.value.trim() || "未分类")
      : upCourse.value;
    var meta = {
      course: course,
      title: upTitle.value.trim(),
      type: upType.value,
      uploader: upUploader.value.trim(),
    };
    var total = files.length, done = 0;
    upStatus.className = "status";
    upStatus.textContent = "上传中（0/" + total + "）...";
    var chain = Promise.resolve();
    for (var i = 0; i < files.length; i++) {
      (function (f) {
        chain = chain.then(function () {
          upStatus.textContent = "上传中（" + done + "/" + total + "）：" + f.name;
          return SUPA.uploadFile(f, meta).then(function () {
            done++;
            upStatus.textContent = "完成 " + done + "/" + total;
          });
        });
      })(files[i]);
    }
    chain.then(function () {
      upStatus.textContent = "✅ 全部上传成功！正在刷新列表...";
      upTitle.value = ""; upUploader.value = ""; upFiles.value = "";
      typeTag.textContent = ""; courseTag.textContent = "";
      setTimeout(function () {
        closeModal("uploadModal");
        loadRemote();
      }, 900);
    }).catch(function (e) {
      upStatus.className = "status err";
      upStatus.textContent = "上传失败：" + e.message;
    });
  };

  /* ---- admin ---- */
  $("adminLogin").onclick = function () {
    var p = $("adminPwd").value.trim();
    if (!p) {
      $("adminStatus").textContent = "请输入密码。";
      return;
    }
    sessionStorage.setItem("biohub_admin", p);
    adminMode = true;
    $("adminStatus").textContent = "✅ 已进入管理（本标签页会话内有效）。同学上传的文件旁会有 🗑️ 删除按钮。";
    setTimeout(function () {
      closeModal("adminModal");
      renderCats();
      if (curView === "remote") renderRemote();
      else if (curQuery) doSearch();
      else renderGrid();
    }, 700);
  };
  function doDelete(f, btn) {
    var pwd = sessionStorage.getItem("biohub_admin") || "";
    if (!confirm("确定删除这份资料吗？（删除后所有人不可见）")) return;
    btn.textContent = "…";
    SUPA.deleteFile(f.id, pwd).then(function (ok) {
      if (ok) {
        loadRemote();
      } else {
        alert("密码错误，已退出管理。");
        sessionStorage.removeItem("biohub_admin");
        adminMode = false;
        renderCats();
        if (curView === "remote") renderRemote();
      }
    }).catch(function (e) {
      alert("删除失败：" + e.message);
      btn.textContent = "🗑️";
    });
  }

  renderCats();
  route();
  loadRemote();
})();
