// Die einzige Brücke zwischen Spiel und Rechner: Spielstand lesen und schreiben, Vollbild, Beenden.
// Das Spiel selbst bekommt keinen Zugriff auf Dateien oder Node.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hortDesktop', {
  platform: process.platform,
  profile: {
    load: () => ipcRenderer.invoke('profile:load'),
    save: (text) => ipcRenderer.invoke('profile:save', String(text)),
  },
  setFullscreen: (on) => ipcRenderer.invoke('window:fullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  quit: () => ipcRenderer.send('app:quit'),
});
