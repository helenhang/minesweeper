(function () {
  "use strict";

  var LEVELS = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 }
  };

  var boardEl = document.getElementById("board");
  var mineCounterEl = document.getElementById("mine-counter");
  var timerEl = document.getElementById("timer");
  var resetBtn = document.getElementById("reset-btn");
  var diffButtons = document.querySelectorAll(".diff-btn");

  var state = {
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

  function renderBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = "repeat(" + state.cols + ", 28px)";
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
        toggleFlag(parseInt(cell.dataset.r, 10), parseInt(cell.dataset.c, 10));
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
    if (state.over) return;
    var cell = state.grid[r][c];
    if (cell.revealed) return;

    if (!cell.flagged && state.flagsUsed >= state.mines) return;

    cell.flagged = !cell.flagged;
    state.flagsUsed += cell.flagged ? 1 : -1;
    updateMineCounter();

    var el = state.cellEls[r][c];
    el.classList.toggle("flag", cell.flagged);
    el.textContent = cell.flagged ? "🚩" : "";
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

  init(state.level);
})();
