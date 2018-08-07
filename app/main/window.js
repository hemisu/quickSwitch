const electron = require('electron');
const { BrowserWindow } = electron;
const { ipcMain } = electron;
const config = require('./config');

const list = [];
let win = null;

ipcMain.on('create-window', create);

function create () {
  win = new BrowserWindow({
    title: config.APP_NAME,
    backgroundColor: '#ffffff',
    width: 900,
    height: 500,
    minWidth: 600,
    minHeight: 37,
    titileBarStyle: 'hidden-inset',
    frame: false,
    show: false
  });

  win.loadURL(config.INDEX);
  win.setTitle(`${config.APP_NAME} - window ${win.id}`);
  list.push(win);

  if(config.DEBUG) win.webContents.openDevTools();

  win.webContents.on('did-finish-load', (id) => {
    win.webContents.send('id', id);
  });

  win.on('closed', () =>{
    destroy(win);
  });
}

function destroy() {
  const i = list.indexOf(win);
  if (i > -1) list.splice(i, 1);
  win = null;
}

module.exports = { list, create, destroy }