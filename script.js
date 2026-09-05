(function () {
  "use strict";

  var LEVELS = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 }
  };

  var I18N = {
    zh: {
      htmlLang: "zh-CN",
      pageTitle: "扫雷 Minesweeper",
      heading: "扫雷 Minesweeper",
      beginner: "初级 9×9",
      intermediate: "中级 16×16",
      expert: "高级 16×30",
      resetTitle: "重新开始",
      hint: "左键：翻开　|　右键（长按）：插旗",
      langBtn: "EN",
      langBtnTitle: "切换到英文"
    },
    en: {
      htmlLang: "en",
      pageTitle: "Minesweeper",
      heading: "Minesweeper",
      beginner: "Beginner 9×9",
      intermediate: "Intermediate 16×16",
      expert: "Expert 16×30",
      resetTitle: "Restart",
      hint: "Left click: reveal  |  Right click / long-press: flag",
      langBtn: "中文",
      langBtnTitle: "Switch to Chinese"
    }
  };

  var boardEl = document.getElementById("board");
  var mineCounterEl = document.getElementById("mine-counter");
  var timerEl = document.getElementById("timer");
  var resetBtn = document.getElementById("reset-btn");
  var diffButtons = document.querySelectorAll(".diff-btn");
  var headingEl = document.getElementById("heading");
  var hintEl = document.getElementById("hint");
  var langBtn = document.getElementById("lang-btn");

  var state = {
    lang: "zh",
    level: "beginner",
    rows: 0,
    cols: 0,
    mines: 0,
    grid: [],        // grid[r][c] = { mine, revealed, flagged, adjacent }
    cellEls: [],      // mirrors grid, holds DOM nodes
    started: false,
    over: false,
    won: false,
    flagsUsed: 0,
    revealedCount: 0,
    timerId: null,
    elapsed: 0
  };

  function init(level) {
    stopTimer();
    var cfg = LEVELS[level];
    state.level = level;
    state.rows = cfg.rows;
    state.cols = cfg.cols;
    state.mines = cfg.mines;
    state.started = false;
    state.over = false;
    state.won = false;
    state.flagsUsed = 0;
    state.revealedCount = 0;
    state.elapsed = 0;

    state.grid = [];
    for (var r = 0; r < state.rows; r++) {
      var row = [];
      for (var c = 0; c < state.cols; c++) {
        row.push({ mine: false, revealed: false, flagged: false, adjacent: 0 });
      }
      state.grid.push(row);
    }

    updateMineCounter();
    updateTimerDisplay();
    setFace("🙂");
    renderBoard();
  }

  var CELL_MIN = 16;
  var CELL_MAX = 64;
  var boardWrapEl = document.querySelector(".board-wrap");

  function fitBoardCells() {
    if (!state.cols || !state.rows) return;
    var availW = boardWrapEl.clientWidth;
    var availH = boardWrapEl.clientHeight;
    if (!availW || !availH) return;

    var byWidth = Math.floor(availW / state.cols);
    var byHeight = Math.floor(availH / state.rows);
    var size = Math.max(CELL_MIN, Math.min(CELL_MAX, byWidth, byHeight));

    document.documentElement.style.setProperty("--cell-size", size + "px");
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitBoardCells, 100);
  });
  window.addEventListener("orientationchange", function () {
    setTimeout(fitBoardCells, 150);
  });

  function renderBoard() {
    fitBoardCells();
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = "repeat(" + state.cols + ", var(--cell-size))";
    state.cellEls = [];

    for (var r = 0; r < state.rows; r++) {
      var rowEls = [];
      for (var c = 0; c < state.cols; c++) {
        var cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;

        cell.addEventListener("click", onLeftClick);
        cell.addEventListener("contextmenu", onRightClick);
        cell.addEventListener("animationend", function (e) {
          if (e.animationName === "flagPulse") e.currentTarget.classList.remove("flag-pulse");
        });
        attachLongPress(cell);

        boardEl.appendChild(cell);
        rowEls.push(cell);
      }
      state.cellEls.push(rowEls);
    }
  }

  function attachLongPress(cell) {
    var timer = null;
    var longPressed = false;

    cell.addEventListener("touchstart", function (e) {
      longPressed = false;
      timer = setTimeout(function () {
        longPressed = true;
        var flagged = toggleFlag(parseInt(cell.dataset.r, 10), parseInt(cell.dataset.c, 10));
        if (flagged) vibrate(35);
      }, 450);
    }, { passive: true });

    cell.addEventListener("touchend", function (e) {
      if (timer) clearTimeout(timer);
      if (longPressed) {
        e.preventDefault();
      }
    });

    cell.addEventListener("touchmove", function () {
      if (timer) clearTimeout(timer);
    });
  }

  function onLeftClick(e) {
    var r = parseInt(e.currentTarget.dataset.r, 10);
    var c = parseInt(e.currentTarget.dataset.c, 10);
    handleReveal(r, c);
  }

  function onRightClick(e) {
    e.preventDefault();
    var r = parseInt(e.currentTarget.dataset.r, 10);
    var c = parseInt(e.currentTarget.dataset.c, 10);
    toggleFlag(r, c);
  }

  function toggleFlag(r, c) {
    if (state.over) return false;
    var cell = state.grid[r][c];
    if (cell.revealed) return false;

    if (!cell.flagged && state.flagsUsed >= state.mines) return false;

    cell.flagged = !cell.flagged;
    state.flagsUsed += cell.flagged ? 1 : -1;
    updateMineCounter();

    var el = state.cellEls[r][c];
    el.classList.toggle("flag", cell.flagged);
    el.textContent = cell.flagged ? "🚩" : "";
    pulseCell(el);
    return true;
  }

  function pulseCell(el) {
    el.classList.remove("flag-pulse");
    void el.offsetWidth; // force reflow so the animation restarts if it's still running
    el.classList.add("flag-pulse");
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function handleReveal(r, c) {
    if (state.over) return;
    var cell = state.grid[r][c];
    if (cell.flagged || cell.revealed) return;

    if (!state.started) {
      placeMines(r, c);
      state.started = true;
      startTimer();
    }

    if (cell.mine) {
      revealAllMines(r, c);
      endGame(false);
      return;
    }

    floodReveal(r, c);
    checkWin();
  }

  function placeMines(safeR, safeC) {
    var forbidden = new Set();
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var rr = safeR + dr, cc = safeC + dc;
        if (inBounds(rr, cc)) forbidden.add(rr + "," + cc);
      }
    }

    var placed = 0;
    while (placed < state.mines) {
      var r = Math.floor(Math.random() * state.rows);
      var c = Math.floor(Math.random() * state.cols);
      var key = r + "," + c;
      if (forbidden.has(key) || state.grid[r][c].mine) continue;
      state.grid[r][c].mine = true;
      placed++;
    }

    for (var r2 = 0; r2 < state.rows; r2++) {
      for (var c2 = 0; c2 < state.cols; c2++) {
        state.grid[r2][c2].adjacent = countAdjacentMines(r2, c2);
      }
    }
  }

  function countAdjacentMines(r, c) {
    var count = 0;
    forEachNeighbor(r, c, function (nr, nc) {
      if (state.grid[nr][nc].mine) count++;
    });
    return count;
  }

  function forEachNeighbor(r, c, fn) {
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc)) fn(nr, nc);
      }
    }
  }

  function inBounds(r, c) {
    return r >= 0 && r < state.rows && c >= 0 && c < state.cols;
  }

  function floodReveal(startR, startC) {
    var stack = [[startR, startC]];
    var seen = new Set();

    while (stack.length) {
      var pos = stack.pop();
      var r = pos[0], c = pos[1];
      var key = r + "," + c;
      if (seen.has(key)) continue;
      seen.add(key);

      var cell = state.grid[r][c];
      if (cell.revealed || cell.flagged) continue;

      cell.revealed = true;
      state.revealedCount++;
      renderCellRevealed(r, c);

      if (cell.adjacent === 0) {
        forEachNeighbor(r, c, function (nr, nc) {
          if (!state.grid[nr][nc].revealed) stack.push([nr, nc]);
        });
      }
    }
  }

  function renderCellRevealed(r, c) {
    var cell = state.grid[r][c];
    var el = state.cellEls[r][c];
    el.classList.add("revealed");
    el.classList.remove("flag");
    if (cell.adjacent > 0) {
      el.textContent = cell.adjacent;
      el.dataset.n = cell.adjacent;
    } else {
      el.textContent = "";
    }
  }

  function revealAllMines(explodedR, explodedC) {
    for (var r = 0; r < state.rows; r++) {
      for (var c = 0; c < state.cols; c++) {
        var cell = state.grid[r][c];
        var el = state.cellEls[r][c];
        if (cell.mine) {
          cell.revealed = true;
          el.classList.add("revealed", "mine");
          el.textContent = "💣";
          if (r === explodedR && c === explodedC) {
            el.classList.add("exploded");
          }
        } else if (cell.flagged && !cell.mine) {
          el.textContent = "❌";
        }
      }
    }
  }

  function checkWin() {
    var totalSafe = state.rows * state.cols - state.mines;
    if (state.revealedCount >= totalSafe) {
      flagAllMinesOnWin();
      endGame(true);
    }
  }

  function flagAllMinesOnWin() {
    for (var r = 0; r < state.rows; r++) {
      for (var c = 0; c < state.cols; c++) {
        var cell = state.grid[r][c];
        if (cell.mine && !cell.flagged) {
          cell.flagged = true;
          var el = state.cellEls[r][c];
          el.classList.add("flag");
          el.textContent = "🚩";
        }
      }
    }
    state.flagsUsed = state.mines;
    updateMineCounter();
  }

  function endGame(won) {
    state.over = true;
    state.won = won;
    stopTimer();
    setFace(won ? "😎" : "😵");
  }

  function updateMineCounter() {
    var remaining = state.mines - state.flagsUsed;
    mineCounterEl.textContent = formatCounter(remaining);
  }

  function updateTimerDisplay() {
    timerEl.textContent = formatCounter(state.elapsed);
  }

  function formatCounter(n) {
    var clamped = Math.max(-99, Math.min(999, n));
    var sign = clamped < 0 ? "-" : "";
    var abs = Math.abs(clamped);
    var digits = String(abs);
    while (digits.length < (clamped < 0 ? 2 : 3)) digits = "0" + digits;
    return sign + digits;
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(function () {
      state.elapsed++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function setFace(emoji) {
    resetBtn.textContent = emoji;
  }

  function detectInitialLang() {
    try {
      var saved = localStorage.getItem("ms-lang");
      if (saved === "zh" || saved === "en") return saved;
    } catch (e) {}
    var nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
    return nav.indexOf("zh") === 0 ? "zh" : "en";
  }

  function applyLanguage() {
    var t = I18N[state.lang];
    document.documentElement.lang = t.htmlLang;
    document.title = t.pageTitle;
    headingEl.textContent = t.heading;
    hintEl.textContent = t.hint;
    resetBtn.title = t.resetTitle;
    langBtn.textContent = t.langBtn;
    langBtn.title = t.langBtnTitle;
    diffButtons.forEach(function (btn) {
      btn.textContent = t[btn.dataset.level];
    });
  }

  function setLanguage(lang) {
    state.lang = lang;
    try { localStorage.setItem("ms-lang", lang); } catch (e) {}
    applyLanguage();
  }

  resetBtn.addEventListener("click", function () {
    init(state.level);
  });

  diffButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      diffButtons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      init(btn.dataset.level);
    });
  });

  langBtn.addEventListener("click", function () {
    setLanguage(state.lang === "zh" ? "en" : "zh");
  });

  setLanguage(detectInitialLang());
  init(state.level);
})();
