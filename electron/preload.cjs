const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("toolbelt", {
  listSites: () => ipcRenderer.invoke("library:list"),
  saveSite: (draft) => ipcRenderer.invoke("library:save", draft),
  toggleFavorite: (id) => ipcRenderer.invoke("library:toggle-favorite", id),
  archiveSite: (id) => ipcRenderer.invoke("library:archive", id),
  restoreSite: (id) => ipcRenderer.invoke("library:restore", id),
  markOpened: (id) => ipcRenderer.invoke("library:mark-opened", id),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  exportLibrary: () => ipcRenderer.invoke("library:export"),
  onLibraryChanged: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("library:changed", handler);
    return () => ipcRenderer.removeListener("library:changed", handler);
  },
});

