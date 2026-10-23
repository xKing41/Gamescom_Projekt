// Desktop-Fassung von Hort: ein Fenster, das die gebaute Seite aus dist/desktop lädt.
// Kein Netz, keine Node-APIs im Spiel. Der Spielstand liegt als Datei im Ordner save/,
// den die Steam Cloud abgleichen kann (Windows: %APPDATA%\Hort\save, Linux: ~/.config/Hort/save).

const { app, BrowserWindow, ipcMain, session, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.setName('Hort');
app.setPath('userData', path.join(app.getPath('appData'), 'Hort'));

if (!app.requestSingleInstanceLock()) app.quit();

const PAGE = path.join(__dirname, '..', 'dist', 'desktop', 'index.html');
const saveDir = () => path.join(app.getPath('userData'), 'save');
const profileFile = () => path.join(saveDir(), 'profile.json');
const backupFile = () => path.join(saveDir(), 'profile.bak.json');
const windowFile = () => path.join(app.getPath('userData'), 'window.json');

// Steam setzt auf dem Steam Deck SteamDeck=1 – dort immer Vollbild
const onDeck = process.env.SteamDeck === '1';
let win = null;

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Erst in eine Zwischendatei schreiben, dann umbenennen: Ein Absturz mitten im Schreiben zerstört nie den Stand
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function createWindow() {
  const saved = readJSON(windowFile()) ?? {};
  const fullscreen = onDeck || process.argv.includes('--fullscreen') || (saved.fullscreen === true && !process.argv.includes('--windowed'));
  win = new BrowserWindow({
    width: saved.width ?? 1280,
    height: saved.height ?? 800,
    minWidth: 960,
    minHeight: 600,
    fullscreen,
    backgroundColor: '#15121a',
    title: 'Hort',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: !app.isPackaged,
      // Der Ton der Höhle darf ohne ersten Klick starten
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.once('ready-to-show', () => win.show());

  // F11 und Alt+Enter schalten das Vollbild um, wie in den meisten PC-Spielen
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  // Größe und Vollbild für den nächsten Start merken
  const remember = () => {
    if (!win || win.isDestroyed()) return;
    const { width, height } = win.getNormalBounds();
    try {
      writeAtomic(windowFile(), JSON.stringify({ width, height, fullscreen: win.isFullScreen() }));
    } catch {
      // Ohne Schreibrechte startet das Fenster eben mit Standardgröße
    }
  };
  win.on('close', remember);

  // Stürzt die Seite ab, lädt sie neu – der Spielstand liegt ja in der Datei
  win.webContents.on('render-process-gone', (_, details) => {
    if (details.reason !== 'clean-exit') win.loadFile(PAGE);
  });

  win.loadFile(PAGE);
}

// Nur Nachrichten aus dem eigenen Fenster mit der eigenen Seite annehmen
const trusted = (event) => !!win && event.sender === win.webContents && event.senderFrame?.url.startsWith('file://');

ipcMain.handle('profile:load', (event) => {
  if (!trusted(event)) return null;
  for (const file of [profileFile(), backupFile()]) {
    const data = readJSON(file);
    if (data && typeof data === 'object') return JSON.stringify(data);
  }
  return null;
});

ipcMain.handle('profile:save', (event, text) => {
  if (!trusted(event) || typeof text !== 'string' || text.length > 2_000_000) return false;
  try {
    JSON.parse(text);
    if (fs.existsSync(profileFile())) fs.copyFileSync(profileFile(), backupFile());
    writeAtomic(profileFile(), text);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('window:fullscreen', (event, on) => {
  if (!trusted(event)) return false;
  win.setFullScreen(!!on);
  return win.isFullScreen();
});

ipcMain.handle('window:is-fullscreen', (event) => trusted(event) && win.isFullScreen());

ipcMain.on('app:quit', (event) => {
  if (trusted(event)) app.quit();
});

// Keine neuen Fenster, kein Wegnavigieren, keine eingebetteten Seiten
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => event.preventDefault());
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // Das Spiel braucht kein Netz und keine Berechtigungen
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_, callback) => callback({ cancel: true }));
  createWindow();
});

app.on('window-all-closed', () => app.quit());
