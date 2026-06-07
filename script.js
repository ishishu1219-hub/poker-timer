(function () {
  "use strict";

  const STORAGE_KEY = "texasHoldemTournamentTimerSettings";
  const defaultStructure = [
    { sb: 100, bb: 200 },
    { sb: 200, bb: 400 },
    { sb: 300, bb: 600 },
    { sb: 500, bb: 1000 },
    { sb: 1000, bb: 2000 },
    { sb: 1500, bb: 3000 },
    { sb: 2000, bb: 4000 },
    { sb: 3000, bb: 6000 }
  ];

  const el = {
    actionSeconds: document.getElementById("actionSeconds"),
    actionTime: document.getElementById("actionTime"),
    actionStatus: document.getElementById("actionStatus"),
    actionStart: document.getElementById("actionStart"),
    nextPlayer: document.getElementById("nextPlayer"),
    actionReset: document.getElementById("actionReset"),
    levelMinutes: document.getElementById("levelMinutes"),
    levelTime: document.getElementById("levelTime"),
    levelStatus: document.getElementById("levelStatus"),
    levelStart: document.getElementById("levelStart"),
    levelStop: document.getElementById("levelStop"),
    levelReset: document.getElementById("levelReset"),
    levelDown: document.getElementById("levelDown"),
    levelUp: document.getElementById("levelUp"),
    currentLevel: document.getElementById("currentLevel"),
    currentSB: document.getElementById("currentSB"),
    currentBB: document.getElementById("currentBB"),
    addLevel: document.getElementById("addLevel"),
    saveStructure: document.getElementById("saveStructure"),
    structureBody: document.getElementById("structureBody")
  };

  let settings = loadSettings();
  let currentLevelIndex = 0;
  let actionRemaining = settings.actionSeconds;
  let levelRemaining = settings.levelMinutes * 60;
  let actionTimer = null;
  let levelTimer = null;
  let audioContext = null;
  let flashTimer = null;

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) {
        return makeDefaultSettings();
      }
      return {
        actionSeconds: clampNumber(saved.actionSeconds, 5, 300, 30),
        levelMinutes: clampNumber(saved.levelMinutes, 1, 180, 10),
        structure: normalizeStructure(saved.structure)
      };
    } catch (error) {
      return makeDefaultSettings();
    }
  }

  function makeDefaultSettings() {
    return {
      actionSeconds: 30,
      levelMinutes: 10,
      structure: defaultStructure.slice()
    };
  }

  function normalizeStructure(structure) {
    if (!Array.isArray(structure) || structure.length === 0) {
      return defaultStructure.slice();
    }

    const rows = structure
      .map((row) => ({
        sb: Math.max(1, parseInt(row.sb, 10) || 1),
        bb: Math.max(1, parseInt(row.bb, 10) || 1)
      }))
      .filter((row) => row.sb > 0 && row.bb > 0);

    return rows.length ? rows : defaultStructure.slice();
  }

  function clampNumber(value, min, max, fallback) {
    const number = parseInt(value, 10);
    if (Number.isNaN(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function formatSeconds(seconds) {
    return String(Math.max(0, seconds));
  }

  function formatMinutes(seconds) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function init() {
    el.actionSeconds.value = settings.actionSeconds;
    el.levelMinutes.value = settings.levelMinutes;
    renderAction();
    renderLevelTimer();
    renderCurrentBlinds();
    renderStructureEditor();
    bindEvents();

  }

  function bindEvents() {
    const updateActionSeconds = () => {
      settings.actionSeconds = clampNumber(el.actionSeconds.value, 5, 300, 30);
      el.actionSeconds.value = settings.actionSeconds;
      if (!actionTimer) {
        actionRemaining = settings.actionSeconds;
        renderAction();
      }
      saveSettings();
    };

    const updateLevelMinutes = () => {
      settings.levelMinutes = clampNumber(el.levelMinutes.value, 1, 180, 10);
      el.levelMinutes.value = settings.levelMinutes;
      if (!levelTimer) {
        levelRemaining = settings.levelMinutes * 60;
        renderLevelTimer();
      }
      saveSettings();
    };

    el.actionSeconds.addEventListener("input", updateActionSeconds);
    el.actionSeconds.addEventListener("change", updateActionSeconds);
    el.levelMinutes.addEventListener("input", updateLevelMinutes);
    el.levelMinutes.addEventListener("change", updateLevelMinutes);

    el.actionStart.addEventListener("click", startActionTimer);
    el.nextPlayer.addEventListener("click", nextPlayer);
    el.actionReset.addEventListener("click", resetActionTimer);
    el.levelStart.addEventListener("click", startLevelTimer);
    el.levelStop.addEventListener("click", stopLevelTimer);
    el.levelReset.addEventListener("click", resetLevelTimer);
    el.levelUp.addEventListener("click", () => changeLevel(1, true));
    el.levelDown.addEventListener("click", () => changeLevel(-1, true));
    el.addLevel.addEventListener("click", addLevelRow);
    el.saveStructure.addEventListener("click", readStructureFromEditor);
  }

  function renderAction() {
    el.actionTime.textContent = formatSeconds(actionRemaining);
  }

  function startActionTimer() {
    clearAlert();
    stopActionTimer();
    if (actionRemaining <= 0) {
      actionRemaining = settings.actionSeconds;
    }
    el.actionStatus.textContent = "COUNTING";
    actionTimer = setInterval(() => {
      actionRemaining -= 1;
      renderAction();
      if (actionRemaining <= 0) {
        stopActionTimer();
        actionRemaining = 0;
        renderAction();
        el.actionStatus.textContent = "TIME UP";
        el.actionStatus.classList.add("alert");
        fireAlarm(880, 0.8);
        startFlash();
      }
    }, 1000);
  }

  function stopActionTimer() {
    if (actionTimer) {
      clearInterval(actionTimer);
      actionTimer = null;
    }
  }

  function nextPlayer() {
    clearAlert();
    stopActionTimer();
    actionRemaining = settings.actionSeconds;
    renderAction();
    startActionTimer();
  }

  function resetActionTimer() {
    stopActionTimer();
    clearAlert();
    actionRemaining = settings.actionSeconds;
    el.actionStatus.textContent = "READY";
    el.actionStatus.classList.remove("alert");
    renderAction();
  }

  function renderLevelTimer() {
    el.levelTime.textContent = formatMinutes(levelRemaining);
  }

  function startLevelTimer(keepStatus) {
    if (!keepStatus) {
      clearAlert();
    }
    if (levelTimer) {
      return;
    }
    if (levelRemaining <= 0) {
      levelRemaining = settings.levelMinutes * 60;
    }
    if (!keepStatus) {
      el.levelStatus.textContent = "LEVEL TIMER RUNNING";
    }
    levelTimer = setInterval(() => {
      levelRemaining -= 1;
      renderLevelTimer();
      if (levelRemaining <= 0) {
        fireLevelUp();
      }
    }, 1000);
  }

  function stopLevelTimer() {
    if (levelTimer) {
      clearInterval(levelTimer);
      levelTimer = null;
    }
    el.levelStatus.textContent = "LEVEL TIMER STOPPED";
  }

  function resetLevelTimer() {
    if (levelTimer) {
      clearInterval(levelTimer);
      levelTimer = null;
    }
    currentLevelIndex = 0;
    levelRemaining = settings.levelMinutes * 60;
    el.levelStatus.textContent = "LEVEL TIMER READY";
    el.levelStatus.classList.remove("level-alert");
    clearAlert();
    renderLevelTimer();
    renderCurrentBlinds();
  }

  function fireLevelUp() {
    clearInterval(levelTimer);
    levelTimer = null;
    changeLevel(1, false);
    levelRemaining = settings.levelMinutes * 60;
    renderLevelTimer();
    el.levelStatus.textContent = "LEVEL UP";
    el.levelStatus.classList.add("level-alert");
    fireAlarm(560, 1);
    startFlash();
    startLevelTimer(true);
    setTimeout(() => {
      if (levelTimer) {
        el.levelStatus.textContent = "LEVEL TIMER RUNNING";
        el.levelStatus.classList.remove("level-alert");
      }
    }, 2500);
  }

  function changeLevel(delta, manual) {
    const maxIndex = settings.structure.length - 1;
    currentLevelIndex = Math.min(maxIndex, Math.max(0, currentLevelIndex + delta));
    if (manual) {
      el.levelStatus.textContent = `LEVEL ${currentLevelIndex + 1}`;
      el.levelStatus.classList.remove("level-alert");
    }
    renderCurrentBlinds();
  }

  function renderCurrentBlinds() {
    const current = settings.structure[currentLevelIndex] || settings.structure[0];
    el.currentLevel.textContent = String(currentLevelIndex + 1);
    el.currentSB.textContent = String(current.sb);
    el.currentBB.textContent = String(current.bb);
  }

  function renderStructureEditor() {
    el.structureBody.innerHTML = "";
    settings.structure.forEach((level, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td><input type="number" min="1" step="1" inputmode="numeric" value="${level.sb}" aria-label="Level ${index + 1} SB"></td>
        <td><input type="number" min="1" step="1" inputmode="numeric" value="${level.bb}" aria-label="Level ${index + 1} BB"></td>
        <td><button type="button" data-delete="${index}">Delete</button></td>
      `;
      el.structureBody.appendChild(row);
    });

    el.structureBody.querySelectorAll("button[data-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        deleteLevel(parseInt(button.dataset.delete, 10));
      });
    });
  }

  function readStructureFromEditor() {
    const rows = Array.from(el.structureBody.querySelectorAll("tr"));
    const nextStructure = rows.map((row) => {
      const inputs = row.querySelectorAll("input");
      return {
        sb: Math.max(1, parseInt(inputs[0].value, 10) || 1),
        bb: Math.max(1, parseInt(inputs[1].value, 10) || 1)
      };
    });

    settings.structure = normalizeStructure(nextStructure);
    currentLevelIndex = Math.min(currentLevelIndex, settings.structure.length - 1);
    saveSettings();
    renderStructureEditor();
    renderCurrentBlinds();
  }

  function addLevelRow() {
    readStructureFromEditor();
    const last = settings.structure[settings.structure.length - 1] || { sb: 100, bb: 200 };
    settings.structure.push({
      sb: last.sb * 2,
      bb: last.bb * 2
    });
    saveSettings();
    renderStructureEditor();
    renderCurrentBlinds();
  }

  function deleteLevel(index) {
    if (settings.structure.length <= 1) {
      return;
    }
    settings.structure.splice(index, 1);
    currentLevelIndex = Math.min(currentLevelIndex, settings.structure.length - 1);
    saveSettings();
    renderStructureEditor();
    renderCurrentBlinds();
  }

  function fireAlarm(frequency, duration) {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(0.001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      // Audio can be blocked until the user has interacted with the page.
    }
  }

  function startFlash() {
    document.body.classList.add("flash");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      document.body.classList.remove("flash");
    }, 2400);
  }

  function clearAlert() {
    document.body.classList.remove("flash");
    clearTimeout(flashTimer);
    el.actionStatus.classList.remove("alert");
    el.levelStatus.classList.remove("level-alert");
  }

  init();
})();
