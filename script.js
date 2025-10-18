(() => {
  const DESKTOP = document.getElementById("desktop");
  const WINDOW_LAYER = document.getElementById("window-layer");
  const MENU_TIME = document.getElementById("menu-time");
  const MENU_STATUS = document.getElementById("menu-status");

  const templates = {
    window: document.getElementById("window-template"),
    finder: document.getElementById("finder-template"),
    notepad: document.getElementById("notepad-template"),
    calculator: document.getElementById("calculator-template"),
    terminal: document.getElementById("terminal-template"),
    utilities: document.getElementById("utilities-template"),
  };

  const eventBus = (() => {
    const listeners = {};
    return {
      on(event, handler) {
        listeners[event] = listeners[event] || new Set();
        listeners[event].add(handler);
      },
      off(event, handler) {
        listeners[event]?.delete(handler);
      },
      emit(event, payload) {
        listeners[event]?.forEach((handler) => handler(payload));
      },
    };
  })();

  const storage = {
    get(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };

  const OS_STATE = {
    theme: storage.get("webos.theme", "light"),
    prefs: storage.get("webos.prefs", {
      darkMode: false,
      reduceMotion: false,
    }),
  };

  const fileSystem = {
    Documents: [
      { name: "Resume.pdf", type: "file" },
      { name: "Budget.xlsx", type: "file" },
      { name: "Travel", type: "folder" },
    ],
    Projects: [
      { name: "macOS WebOS", type: "folder" },
      { name: "Design.sketch", type: "file" },
      { name: "Prototype.fig", type: "file" },
    ],
    Downloads: [
      { name: "Invoice_2024.pdf", type: "file" },
      { name: "macOS_wallpaper.jpg", type: "file" },
    ],
    System: [
      { name: "Preferences", type: "folder" },
      { name: "Logs", type: "folder" },
      { name: "Terminal.app", type: "app" },
    ],
  };

  const appDefinitions = {
    finder: {
      title: "Finder",
      width: 720,
      height: 480,
      init: initFinder,
    },
    notepad: {
      title: "Notes",
      width: 680,
      height: 460,
      init: initNotepad,
    },
    calculator: {
      title: "Calculator",
      width: 320,
      height: 420,
      init: initCalculator,
    },
    terminal: {
      title: "Terminal",
      width: 640,
      height: 440,
      init: initTerminal,
    },
    utilities: {
      title: "System Utilities",
      width: 620,
      height: 420,
      init: initUtilities,
    },
  };

  let zCounter = 10;

  const WindowManager = {
    windows: new Map(),

    open(appId) {
      if (this.windows.has(appId)) {
        const existing = this.windows.get(appId);
        this.bringToFront(existing.el);
        existing.el.classList.remove("minimized");
        existing.el.style.display = "flex";
        return existing;
      }

      const appDef = appDefinitions[appId];
      if (!appDef) return null;

      const windowFragment = templates.window.content.firstElementChild.cloneNode(
        true
      );
      const windowEl = windowFragment;
      const titleEl = windowEl.querySelector(".window-title");
      const contentEl = windowEl.querySelector(".window-content");

      titleEl.textContent = appDef.title;
      windowEl.style.width = `${appDef.width}px`;
      windowEl.style.height = `${appDef.height}px`;
      windowEl.style.left = `${120 + this.windows.size * 32}px`;
      windowEl.style.top = `${120 + this.windows.size * 32}px`;
      windowEl.dataset.appId = appId;

      WINDOW_LAYER.appendChild(windowEl);
      this.registerWindow(windowEl);
      const appContext = appDef.init(contentEl, windowEl);
      const windowState = { el: windowEl, appId, context: appContext };
      this.windows.set(appId, windowState);
      this.bringToFront(windowEl);
      eventBus.emit("window:opened", { appId });
      return windowState;
    },

    registerWindow(windowEl) {
      const header = windowEl.querySelector(".window-header");
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      const onMouseDown = (e) => {
        if (e.target.closest(".traffic-lights")) return;
        isDragging = true;
        windowEl.style.transition = "none";
        startX = e.clientX;
        startY = e.clientY;
        const rect = windowEl.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        header.classList.add("dragging");
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        windowEl.style.left = `${startLeft + dx}px`;
        windowEl.style.top = `${startTop + dy}px`;
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        header.classList.remove("dragging");
      };

      header.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);

      windowEl.addEventListener("mousedown", () => this.bringToFront(windowEl));

      windowEl.querySelectorAll(".traffic-lights button").forEach((button) => {
        button.addEventListener("click", (e) => {
          const action = e.currentTarget.dataset.action;
          const appId = windowEl.dataset.appId;
          if (action === "close") {
            this.close(appId);
          } else if (action === "minimize") {
            windowEl.classList.add("minimized");
            windowEl.style.display = "none";
            eventBus.emit("window:minimized", { appId });
          } else if (action === "maximize") {
            this.toggleMaximize(windowEl);
          }
        });
      });
    },

    toggleMaximize(windowEl) {
      if (windowEl.dataset.maximized === "true") {
        const prev = JSON.parse(windowEl.dataset.prevGeometry || "{}");
        windowEl.style.left = prev.left;
        windowEl.style.top = prev.top;
        windowEl.style.width = prev.width;
        windowEl.style.height = prev.height;
        windowEl.dataset.maximized = "false";
      } else {
        windowEl.dataset.prevGeometry = JSON.stringify({
          left: windowEl.style.left,
          top: windowEl.style.top,
          width: windowEl.style.width,
          height: windowEl.style.height,
        });
        const margin = 20;
        windowEl.style.left = `${margin}px`;
        windowEl.style.top = `${margin + 32}px`;
        windowEl.style.width = `calc(100% - ${margin * 2}px)`;
        windowEl.style.height = `calc(100% - ${margin * 2 + 80}px)`;
        windowEl.dataset.maximized = "true";
      }
    },

    bringToFront(windowEl) {
      zCounter += 1;
      windowEl.style.zIndex = zCounter;
      WINDOW_LAYER.querySelectorAll(".window").forEach((el) =>
        el.classList.remove("active")
      );
      windowEl.classList.add("active");
      eventBus.emit("window:focused", { appId: windowEl.dataset.appId });
    },

    close(appId) {
      const windowState = this.windows.get(appId);
      if (!windowState) return;
      windowState.el.remove();
      this.windows.delete(appId);
      eventBus.emit("window:closed", { appId });
    },
  };

  function initFinder(container, windowEl) {
    const sidebarItems = templates.finder.content
      .querySelector(".finder-sidebar")
      .cloneNode(true);
    const mainTemplate = templates.finder.content
      .querySelector(".finder-main")
      .cloneNode(true);
    container.appendChild(sidebarItems);
    container.appendChild(mainTemplate);

    const sidebar = container.querySelectorAll(".finder-sidebar li");
    const contentContainer = container.querySelector(".finder-content");
    let currentPath = "Documents";

    const renderFolder = (path) => {
      currentPath = path;
      contentContainer.innerHTML = "";
      const items = fileSystem[path] || [];
      items.forEach((item) => {
        const div = document.createElement("div");
        div.className = "finder-item";
        const icon = document.createElement("div");
        icon.className = "icon";
        icon.textContent = item.type === "folder" ? "📁" : "📄";
        const label = document.createElement("span");
        label.textContent = item.name;
        div.appendChild(icon);
        div.appendChild(label);
        div.addEventListener("dblclick", () => {
          if (item.type === "folder") {
            renderFolder(item.name);
          } else if (item.type === "app" && item.name === "Terminal.app") {
            openApp("terminal");
          } else {
            eventBus.emit("finder:open", { item });
            showStatus(`${item.name} opened`);
          }
        });
        contentContainer.appendChild(div);
      });

      sidebar.forEach((el) => {
        el.classList.toggle("active", el.dataset.path === path);
      });

      windowEl.querySelector(".window-title").textContent = `Finder · ${path}`;
      showStatus(`${path} — ${items.length} items`);
    };

    sidebar.forEach((item) => {
      item.addEventListener("click", () => renderFolder(item.dataset.path));
    });

    renderFolder(currentPath);

    return {
      getState: () => ({ currentPath }),
    };
  }

  function initNotepad(container, windowEl) {
    const content = templates.notepad.content.cloneNode(true);
    container.appendChild(content);
    const listEl = container.querySelector(".notes-list");
    const titleInput = container.querySelector(".note-title");
    const bodyTextarea = container.querySelector(".note-body");
    const saveBtn = container.querySelector('[data-action="save-note"]');
    const deleteBtn = container.querySelector('[data-action="delete-note"]');
    const newBtn = container.querySelector('[data-action="new-note"]');

    let notes = storage.get("webos.notes", []);
    let activeNoteId = null;

    const renderNotes = () => {
      listEl.innerHTML = "";
      notes.forEach((note) => {
        const li = document.createElement("li");
        li.dataset.id = note.id;
        li.textContent = note.title || "Untitled";
        if (activeNoteId === note.id) li.classList.add("active");
        li.addEventListener("click", () => selectNote(note.id));
        listEl.appendChild(li);
      });
    };

    const selectNote = (id) => {
      activeNoteId = id;
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      titleInput.value = note.title;
      bodyTextarea.value = note.body;
      renderNotes();
      showStatus(`Editing "${note.title || "Untitled"}"`);
    };

    const persist = () => {
      storage.set("webos.notes", notes);
      renderNotes();
    };

    const createNote = () => {
      const id = `note-${Date.now()}`;
      const newNote = { id, title: "New Note", body: "" };
      notes = [newNote, ...notes];
      persist();
      selectNote(id);
    };

    const saveNote = () => {
      if (!activeNoteId) return;
      const note = notes.find((n) => n.id === activeNoteId);
      note.title = titleInput.value.trim() || "Untitled";
      note.body = bodyTextarea.value;
      persist();
      showStatus(`Saved "${note.title}"`);
    };

    const deleteNote = () => {
      if (!activeNoteId) return;
      notes = notes.filter((n) => n.id !== activeNoteId);
      activeNoteId = notes[0]?.id || null;
      if (activeNoteId) {
        selectNote(activeNoteId);
      } else {
        titleInput.value = "";
        bodyTextarea.value = "";
      }
      persist();
      showStatus("Note deleted");
    };

    newBtn.addEventListener("click", createNote);
    saveBtn.addEventListener("click", saveNote);
    deleteBtn.addEventListener("click", deleteNote);
    titleInput.addEventListener("blur", saveNote);
    bodyTextarea.addEventListener("input", () => {
      if (OS_STATE.prefs.reduceMotion) return;
      container.querySelector(".note-editor").style.boxShadow =
        "inset 0 0 0 1px rgba(15,90,242,0.2)";
      setTimeout(() => {
        container.querySelector(".note-editor").style.boxShadow = "none";
      }, 300);
    });

    renderNotes();
    if (notes.length) {
      selectNote(notes[0].id);
    } else {
      createNote();
    }

    eventBus.on("finder:open", ({ item }) => {
      if (item.name.endsWith(".txt")) {
        const id = `external-${Date.now()}`;
        notes = [
          {
            id,
            title: item.name.replace(".txt", ""),
            body: `Imported from Finder: ${item.name}`,
          },
          ...notes,
        ];
        persist();
        selectNote(id);
      }
    });

    return {
      getState: () => ({ activeNoteId }),
      actions: { createNote, saveNote },
    };
  }

  function initCalculator(container) {
    const content = templates.calculator.content.cloneNode(true);
    container.appendChild(content);
    const display = container.querySelector(".calculator-display");
    let currentValue = "0";
    let storedValue = null;
    let currentOperator = null;
    let shouldReset = false;

    const updateDisplay = () => {
      display.textContent = currentValue;
    };

    const handleDigit = (digit) => {
      if (shouldReset) {
        currentValue = digit === "." ? "0." : digit;
        shouldReset = false;
      } else {
        if (digit === "." && currentValue.includes(".")) return;
        currentValue =
          currentValue === "0" && digit !== "." ? digit : currentValue + digit;
      }
      updateDisplay();
    };

    const handleOperator = (operator) => {
      if (storedValue === null) {
        storedValue = parseFloat(currentValue);
      } else if (!shouldReset) {
        compute();
      }
      currentOperator = operator;
      shouldReset = true;
    };

    const compute = () => {
      if (currentOperator === null || storedValue === null) return;
      const current = parseFloat(currentValue);
      let result = storedValue;
      switch (currentOperator) {
        case "+":
          result += current;
          break;
        case "-":
          result -= current;
          break;
        case "*":
          result *= current;
          break;
        case "/":
          result = current === 0 ? "Error" : result / current;
          break;
      }
      currentValue = `${Math.round(result * 1e10) / 1e10}`;
      storedValue = current === 0 && currentOperator === "/" ? null : result;
      currentOperator = null;
      shouldReset = true;
      updateDisplay();
    };

    const clear = () => {
      currentValue = "0";
      storedValue = null;
      currentOperator = null;
      shouldReset = false;
      updateDisplay();
    };

    const toggleSign = () => {
      currentValue =
        currentValue === "0" ? "0" : `${parseFloat(currentValue) * -1}`;
      updateDisplay();
    };

    const percent = () => {
      currentValue = `${parseFloat(currentValue) / 100}`;
      updateDisplay();
    };

    container
      .querySelectorAll(".calculator-buttons button")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const role = button.dataset.role;
          const value = button.dataset.value;
          if (role === "digit") {
            handleDigit(value);
          } else if (role === "operator") {
            handleOperator(value);
          } else if (role === "equals") {
            compute();
          } else if (value === "clear") {
            clear();
          } else if (value === "sign") {
            toggleSign();
          } else if (value === "percent") {
            percent();
          }
        });
      });

    updateDisplay();
  }

  function initTerminal(container, windowEl) {
    const content = templates.terminal.content.cloneNode(true);
    container.appendChild(content);
    const output = container.querySelector(".terminal-output");
    const input = container.querySelector(".terminal-input input");
    const prompt = "webos %";

    const history = [];
    let historyIndex = -1;

    const commands = {
      help() {
        return [
          "Available commands:",
          "help          List commands",
          "clear         Clear the terminal",
          "ls            List Finder directories",
          "open [app]    Launch application",
          "open [path]   Open Finder path",
          "date          Show current time",
          "echo [text]   Print text",
        ].join("\n");
      },
      clear() {
        output.innerHTML = "";
        return "";
      },
      ls() {
        return Object.keys(fileSystem).join("  ");
      },
      date() {
        return new Date().toString();
      },
      echo(args) {
        return args.join(" ");
      },
      open(args) {
        const target = args.join(" ");
        if (appDefinitions[target]) {
          openApp(target);
          return `Opening ${target}`;
        }
        if (fileSystem[target]) {
          const finder = WindowManager.open("finder");
          finder.context && finder.context.getState &&
            showStatus(`Finder navigated to ${target}`);
          eventBus.emit("finder:navigate", { path: target });
          return `Navigated to ${target}`;
        }
        return `open: no such app or directory: ${target}`;
      },
    };

    const printLine = (text = "") => {
      const line = document.createElement("div");
      line.textContent = text;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    };

    const execute = (commandLine) => {
      printLine(`${prompt} ${commandLine}`);
      const [command, ...args] = commandLine.trim().split(/\s+/);
      if (!command) return;
      const handler = commands[command];
      if (!handler) {
        printLine(`Command not found: ${command}`);
        return;
      }
      const result = handler(args);
      if (result) {
        result.split("\n").forEach((line) => printLine(line));
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const value = input.value.trim();
        if (!value) return;
        history.unshift(value);
        historyIndex = -1;
        execute(value);
        input.value = "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIndex + 1 < history.length) {
          historyIndex += 1;
          input.value = history[historyIndex];
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex -= 1;
          input.value = history[historyIndex];
        } else {
          historyIndex = -1;
          input.value = "";
        }
      }
    });

    windowEl.addEventListener("click", () => input.focus());
    input.focus();
  }

  function initUtilities(container) {
    const content = templates.utilities.content.cloneNode(true);
    container.appendChild(content);
    const uptimeEl = container.querySelector(".uptime-value");
    const memoryEl = container.querySelector(".memory-value");
    const darkToggle = container.querySelector('[data-pref="dark-mode"]');
    const motionToggle = container.querySelector('[data-pref="reduce-motion"]');

    const startTime = Date.now();

    const updateUptime = () => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      uptimeEl.textContent = `${minutes}m ${seconds}s`;
    };

    const updateMemory = () => {
      const usage = (Math.sin(Date.now() / 5000) + 1) * 22 + 38;
      memoryEl.textContent = `${Math.round(usage)}%`;
    };

    const syncPrefs = () => {
      darkToggle.checked = OS_STATE.prefs.darkMode;
      motionToggle.checked = OS_STATE.prefs.reduceMotion;
    };

    darkToggle.addEventListener("change", () => {
      OS_STATE.prefs.darkMode = darkToggle.checked;
      storage.set("webos.prefs", OS_STATE.prefs);
      applyTheme();
    });

    motionToggle.addEventListener("change", () => {
      OS_STATE.prefs.reduceMotion = motionToggle.checked;
      storage.set("webos.prefs", OS_STATE.prefs);
    });

    syncPrefs();
    updateUptime();
    updateMemory();

    const interval = setInterval(() => {
      updateUptime();
      updateMemory();
    }, 1000);

    return {
      dispose() {
        clearInterval(interval);
      },
    };
  }

  function applyTheme() {
    if (OS_STATE.prefs.darkMode) {
      DESKTOP.dataset.theme = "dark";
    } else {
      delete DESKTOP.dataset.theme;
    }
  }

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    MENU_TIME.textContent = time;
  }

  function showStatus(text) {
    MENU_STATUS.textContent = text;
    if (OS_STATE.prefs.reduceMotion) return;
    MENU_STATUS.style.opacity = "1";
    setTimeout(() => {
      MENU_STATUS.style.opacity = "0.75";
    }, 1800);
  }

  function openApp(appId) {
    const dockItem = document.querySelector(`.dock-item[data-app="${appId}"]`);
    if (dockItem && !OS_STATE.prefs.reduceMotion) {
      dockItem.classList.add("bounce");
      setTimeout(() => dockItem.classList.remove("bounce"), 600);
    }
    WindowManager.open(appId);
  }

  function bindDesktopInteractions() {
    document.querySelectorAll("[data-app]").forEach((el) => {
      el.addEventListener("dblclick", () => openApp(el.dataset.app));
      if (el.classList.contains("dock-item")) {
        el.addEventListener("click", () => openApp(el.dataset.app));
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.metaKey && e.key.toLowerCase() === "n") {
        openApp("notepad");
        const noteWindow = WindowManager.windows.get("notepad");
        noteWindow?.context?.actions?.createNote();
      } else if (e.metaKey && e.key === "`") {
        cycleWindows();
      }
    });

    eventBus.on("window:minimized", ({ appId }) => {
      showStatus(`${appDefinitions[appId]?.title || "App"} minimized`);
    });
    eventBus.on("window:focused", ({ appId }) => {
      const title = appDefinitions[appId]?.title || "Finder";
      document
        .querySelectorAll(".menu-item")
        .forEach((item) =>
          item.classList.toggle("active", item.dataset.app === appId)
        );
      showStatus(`${title} active`);
    });
    eventBus.on("window:closed", ({ appId }) => {
      showStatus(`${appDefinitions[appId]?.title || "App"} closed`);
    });
  }

  function cycleWindows() {
    const windows = Array.from(WindowManager.windows.values());
    if (!windows.length) return;
    windows.sort((a, b) => parseInt(a.el.style.zIndex, 10) - parseInt(b.el.style.zIndex, 10));
    const next = windows[windows.length - 1];
    WindowManager.bringToFront(next.el);
  }

  function initMenuInteractions() {
    document.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", () => openApp(item.dataset.app));
    });
  }

  function init() {
    applyTheme();
    bindDesktopInteractions();
    initMenuInteractions();
    updateClock();
    setInterval(updateClock, 15000);
    showStatus("Welcome to macOS WebOS");
    openApp("finder");
    openApp("notepad");

    eventBus.on("finder:navigate", ({ path }) => {
      const finderWindow = WindowManager.windows.get("finder");
      if (!finderWindow) return;
      const sidebarItems = finderWindow.el.querySelectorAll(
        ".finder-sidebar li"
      );
      sidebarItems.forEach((li) => {
        if (li.dataset.path === path) {
          li.click();
        }
      });
    });
  }

  init();
})();
