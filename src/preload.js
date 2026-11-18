const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  getState: () => ipcRenderer.invoke('state:get'),
  login: () => ipcRenderer.invoke('spotify:login'),
  logout: () => ipcRenderer.invoke('spotify:logout'),
  start: () => ipcRenderer.invoke('engine:start'),
  stop: () => ipcRenderer.invoke('engine:stop'),
  nudgeOffset: (delta) => ipcRenderer.invoke('offset:nudge', delta),
  setOffset: (ms) => ipcRenderer.invoke('offset:set', ms),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
});
