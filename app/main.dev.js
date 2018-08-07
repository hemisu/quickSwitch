/* eslint global-require: 0, flowtype-errors/show-errors: 0 */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 *
 * @flow
 */
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  dialog,
  Notification,
} from 'electron';
import MenuBuilder from './menu';
import store from './main/store';
import host from './main/host';
import fs from './main/fs';
import nodefs from 'fs';

const pkg = require('./package');
const path = require('path');
const sudo = require('sudo-prompt');
const open = require('open');
const log = require('electron-log');

const SYSTEM_HOSTS_FILE = '/etc/hosts';
const DATA_DIR_NAME = process.env.NODE_ENV === 'dev' ? '.quickSwitch-dev' : '.quickSwitch';
const DATA_PATH = path.normalize(`${process.env.HOME}/${DATA_DIR_NAME}`);
const USER_PATH = path.normalize(`${process.env.HOME}/${DATA_DIR_NAME}/userData`);

const HOST_FILE = path.normalize(`${DATA_PATH}/hosts`);
const HOST_BACKUP = path.normalize(`${USER_PATH}/host.bak`);
const NGINX_DIR = path.normalize(`${DATA_PATH}/userData/nginx`);

const getNginxPath = (nginxFileName) => path.normalize(`${USER_PATH}/nginx/${nginxFileName}.conf`);

let basePath;
if(process.env.NODE_ENV === 'development'){
  basePath = path.join(__dirname);
} else {
  basePath = path.join(process.resourcesPath, 'app');
}
let tray = null;
let win = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
  const p = path.join(__dirname, '..', 'app', 'node_modules');
  require('module').globalPaths.push(p);
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map(name => installer.default(installer[name], forceDownload))
  ).catch(console.log);
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    app.createWindow();
  }
})

app.createWindow = function createWindow() {
  // 创建浏览器窗口
  win = new BrowserWindow({
    backgroundColor: '#ffffff',
    width: 1000,
    height: 650,
    minWidth: 600,
    minHeight: 650,
    titileBarStyle: 'hidden-inset',
    title: 'quickSwitch 设置',
    icon: nativeImage.createFromPath(path.join(basePath, 'assets/icon.icns')),
    // frame: false,
    show: false
  })
  // 被关闭时释放引用
  win.on('closed', () => {
    // 取消win的引用
    win = null;
  });
  // 对话框偏移量
  win.setSheetOffset(0);
  // 不可全屏
  win.setFullScreenable(false);
  // 加载的html地址
  win.loadURL(`file://${__dirname}/app.html`);
  // 如果已经有打开的窗口，确定新窗口位置
  const activeWin = BrowserWindow.getFocusedWindow();
  if (activeWin) {
    const position = activeWin.getPosition();
    win.setPosition(position[0] + 30, position[1] + 30);
  }
  return new Promise(resolve => {
    win.once('ready-to-show', () => {
      win.show();
      win.focus();
      const menuBuilder = new MenuBuilder(win);
      menuBuilder.buildMenu();
      app.watchConfigFile();
      resolve(win);
    });
  });
}

app.watchConfigFile = () => { // 监听config文件
  nodefs.watchFile(path.normalize(`${USER_PATH}/config`), {interval: 500}, (curr, prev) => {
    log.info('检测到config文件变动',curr.mtime, ' ',prev.mtime);
    app.getConfig().then(data => { // TODO优化
      const list = scanNginxFile(JSON.parse(data));
      app.refreshTray();
      win.webContents.send(`GET_CONFIG_SUCCESS`, list);
    })
    .catch((err) => {
      win.webContents.send(`ERROR`, err);
    });
    app.refreshTray();
  });
}

app.showWindow = async () => {
  if(win) {
    return win.focus();
  }
  await app.createWindow();
}

app.init = () => {
  // 检测应用是否是第一次启动 检测标志位
  store.getItem('init').then((isInit) => {
    if (!isInit) {
      win.webContents.on('did-finish-load', () => {
        win.webContents.send('init'); // 向信息端发送init
      })
      store.init(); // 创建userData、nginx文件夹
      host.backup(); // 备份已有的hosts文件
      
      log.warn(`即将执行的bash:
        /bin/chmod +a "\`/usr/bin/whoami\` allow read,write" /etc/hosts
        chmod g+rw /usr/local/var/log/nginx/access.log
        chmod g+rw /usr/local/var/log/nginx/error.log
      `);
      sudo.exec(`/bin/chmod +a "\`/usr/bin/whoami\` allow read,write" /etc/hosts
        chmod g+rw /usr/local/var/log/nginx/access.log
        chmod g+rw /usr/local/var/log/nginx/error.log
        `, {
          name: pkg.displayName,
          icns: path.join(basePath, 'assets/icon.icns'),
        },
        (error, stdout, stderr) => {
          if (error) return;
          store.setItem('init', 'start init'); // 留下标记文件
        }
      );
    }
  })
}

app.on('ready', async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }
  app.createWindow(); // 创建窗口
  app.refreshTray(); // 创建工具栏
  app.init(); // init
});

app.createTray = function createTray(list = []) {
  if (!tray) {
    tray = new Tray(path.resolve(basePath, 'assets/menubarIconTemplate.png'));
    tray.setToolTip('快速切换测试环境.');
  }
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '设置界面', type: 'normal', click() {
        if (win === null) {
          app.createWindow(); // 创建窗口
        }
        win.show();
        win.focus();
      }
    },
    {
      label: '隐藏/显示Dock', type: 'normal', click() {
        // 隐藏dock
        // if(process.platform === 'darwin') app.dock.hide();
        app.dock.isVisible() ? app.dock.hide() : app.dock.show();
      }
    },
    {
      label: '复原配置', type: 'normal', click() {
        app.resetConfig();
      }
    },
    { type: 'separator' },
    ...list,
    { type: 'separator' },
    {
      label: '退出应用', type: 'normal', click() {
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
};

app.nofity = ({ 
  title = '', 
  subtitle = '',
  body = '',
  onClick = f => f,
  onClose = f => f,
 }) => {
  const nf = new Notification({
    title: title,
    subtitle: subtitle,
    body: body,
    sound: 'Tink',
    icon: path.resolve(basePath, 'assets/icon.png'),
  });
  nf.on('click', onClick);
  nf.on('close', onClose);
  return nf;
}

// 顶部Menu Bar添加点击事件
app.handleMenuBarItemClick = (list, key) => (menuItem, browserWindow, event) => {
  const newList = {...list};
  // 保持单选
  Object.keys(newList).forEach((key) => {
    newList[key].checked = false;
  })
  if (menuItem.checked) { // 激活某项目
    app.activeConfig(key).then(() => {
      newList[key].checked = menuItem.checked;
      app.setConfig(newList);
    }).catch((err) => {
      log.info('取消选择')
    })
  } else { // 取消选择某项目
    app.resetConfig().then(() => {
      newList[key].checked = menuItem.checked;
      app.setConfig(newList);
    }).catch((err) => {
      log.info('取消复原');
    })
  }
  // 刷新Menu Bar
  app.refreshTray();
}

// 从配置文件中生成顶部 MenuBar
app.refreshTray = () => {
  store.getItem('config').then(data => { // 获取配置文件
    const list = JSON.parse(data);
    const menuList = [];
    Object.keys(list).forEach((key) => {
      if (list[key].showOnTray) { // 判断是否显示在MenuBar
        menuList.push({
          id: key,
          label: list[key].applicationName,
          type: 'checkbox',
          click: app.handleMenuBarItemClick(list, key),
          checked: list[key].checked,
          enabled: !list[key].disabled,
        })
      }
    })
    app.createTray(menuList);
  });
}

/**
 * 检测nginx文件
 * @param {Object} 配置文件列表
 * @return {Object} 标记是否存在nginx的新list
 */
const scanNginxFile = (obj) => {
  const newObj = {...obj};
  Object.keys(newObj).forEach((key) => {
    if(!nodefs.existsSync(getNginxPath(newObj[key].nginxFileName))) {
      newObj[key]['disabled'] = true;
    } else {
      newObj[key]['disabled'] = false;
    }
  })
  return newObj;
}

/**
 * 存储配置文件
 * @param {Object} 配置文件 
 */
app.setConfig = (value) => store.setItem('config', JSON.stringify(scanNginxFile(value), null, 4));
/**
 * 获取配置文件
 * @return {Promise} Promise
 */
app.getConfig = () => store.getItem('config');
/**
 * 激活配置
 * @param {String} appName 项目标识名 
 * @param {Object} ev 事件对象 可以用于返回消息的事件对象 event.returnValue 或 event.sender.send 
 */
app.activeConfig = (appName, ev) => {
  return app.getConfig().then(data => {
    const obj = JSON.parse(data);
    if(!nodefs.existsSync(getNginxPath(obj[appName].nginxFileName))) {
      dialog.showMessageBox(null, {
        type: 'error',
        buttons: ['关闭'],
        message: '出错',
        detail: 'nginx文件不存在'
      });
    }
    return obj;
  }).then((obj) => {
    // sudo运行失败 TODO
    return new Promise((resolve, reject) => {
      log.warn(`即将执行的bash:
        cp ${HOST_FILE} /etc/hosts
        cp ${NGINX_DIR}/${obj[appName].nginxFileName}.conf /usr/local/etc/nginx/${obj[appName].nginxFileName}.conf
        /usr/local/bin/nginx -s stop
        /usr/local/bin/nginx -c /usr/local/etc/nginx/${obj[appName].nginxFileName}.conf
        /usr/local/bin/nginx -s reload
      `);
      sudo.exec(`cp ${HOST_FILE} /etc/hosts
      cp ${NGINX_DIR}/${obj[appName].nginxFileName}.conf /usr/local/etc/nginx/${obj[appName].nginxFileName}.conf
      /usr/local/bin/nginx -s stop
      /usr/local/bin/nginx -c /usr/local/etc/nginx/${obj[appName].nginxFileName}.conf
      /usr/local/bin/nginx -s reload
      `, {
        name: pkg.displayName,
        icns: path.join(basePath, 'assets/icon.icns'),
      },
      (error, stdout, stderr) => {
        if (error) return reject('切换失败');
        log.info('切换成功');
        const nf = app.nofity({
          title: '切换成功',
          subtitle: `${obj[appName]['applicationName']} - ${appName}`,
          body: `点击打开网页`,
          onClick: () => {
            open(`http://${obj[appName]['hostname']}`)
          },
        })
        nf.show();
        ev && ev.sender.send('ACTIVE_CONFIG_SUCCESS');
        resolve('切换成功');
      }
    );
    })
  }).catch(() => {
    return Promise.reject()
  })
}
/**
 * 重置配置
 * @param {Object} ev 事件对象 
 */
app.resetConfig = (ev) => {
  return new Promise((resolve, reject) => {
    log.warn(`即将执行的bash:
      cp ${HOST_BACKUP} /etc/hosts
      /usr/local/bin/nginx -s stop
    `);
    sudo.exec(`cp ${HOST_BACKUP} /etc/hosts
      /usr/local/bin/nginx -s stop
      `, {
        name: pkg.displayName,
        icns: path.join(basePath, 'assets/icon.icns'),
      },
      (error, stdout, stderr) => {
        log.error(error);
        if (error) return reject('切换失败');
        log.info('切换成功');
        const nf = app.nofity({
          title: '切换成功',
          subtitle: '清空配置',
          body: 'nginx停止运行，hosts文件恢复',
        })
        nf.show();
        ev && ev.sender.send('RESET_CONFIG_SUCCESS');
        resolve('取消成功');
      }
    );
  })
}
/** ipc **/
ipcMain.on('openTestWindow', (e, data) => {
  console.log(data);
  app.createTray(); // 创建工具栏
});

ipcMain.on('refreshTray', (e) => {
  // 获取配置文件
  app.refreshTray();
});

ipcMain.on('log', (e, data) => {
  console.log(data);
});

// 设置hosts
ipcMain.on('setHosts', (ev, list) => {
  host.safeSave(list).then(() => {
    ev.sender.send('SET_HOSTS_SUCCESS');
  });
})

// 配置失效
ipcMain.on('inactiveConfig', (ev) => {
  app.resetConfig(ev);
})

// 配置生效
ipcMain.on('activeConfig', (ev, config, appName) => {
  app.activeConfig(appName, ev);
})

// 打开（浏览器或者文件夹)
ipcMain.on('open', (ev, uri) => {
  if (uri === 'hostDir') open(SYSTEM_HOSTS_FILE);
  if (uri === 'nginxDir') open(NGINX_DIR);
  if (uri === 'config') open(`${DATA_PATH}/userData/config`);
})

// 设置值
ipcMain.on('setItem', (ev, key, value) => {
  store.setItem(key, value).then(() => {
    ev.sender.send(`SET_ITEM_${String.prototype.toUpperCase.call(value)}_SUCCESS`, value);
  }).catch((err) => {
    ev.sender.send(`ERROR`, err);
  });
});

// 获取值
ipcMain.on('getItem', (ev, key) => {
  // console.log(key);
  store.getItem(key).then(value => {
    // console.log('getItem', key, '\n', value);
    ev.sender.send(`GET_ITEM_${String.prototype.toUpperCase.call(key)}_SUCCESS`, value);
  })
  .catch((err) => {
    ev.sender.send(`ERROR`, err);
  });
});

// 设置配置
ipcMain.on('setConfig', (ev, value) => {
  app.setConfig(value).then(() => {
    ev.sender.send(`SET_CONFIG_SUCCESS`, value);
  }).catch((err) => {
    ev.sender.send(`ERROR`, err);
  });
});

// 获取配置
ipcMain.on('getConfig', (ev) => {
  app.getConfig().then(data => {
    const list = scanNginxFile(JSON.parse(data));
    ev.sender.send(`GET_CONFIG_SUCCESS`, list);
  })
  .catch((err) => {
    ev.sender.send(`ERROR`, err);
  });
});

// 导入配置文件
ipcMain.on('importConfig', () => {
  dialog.showOpenDialog(win, {
    title: '选择配置文件',
    properties: ['openFile'],
  }, (filepath) => {
    if (!filepath) return;
    // 检测配置文件的可靠性
    fs.copyFile(filepath[0], path.normalize(`${USER_PATH}/config`));
    win.webContents.send('GET_ITEM_CONFIG_SUCCESS');
  })
});

// 存储Nginx文件 读取文件->对比->如果不同则替换
ipcMain.on('importNginx', (ev, originFile, targetFile) => {
  try {
    fs.readFile(getNginxPath(originFile)).then((originBuf) => {
      log.info('路径orgin', getNginxPath(originFile));
      fs.readFile(targetFile).then((targetBuf) => {
        log.info('路径target', targetFile);
        if(! targetBuf.equals(originBuf)) { // 文件不相等 替换
          log.info('文件不相等')
          fs.copyFile(targetFile, getNginxPath(originFile));
        }
      });
    }).catch((error) => {
      log.info('originFile不存在');
      const targetFileName = path.parse(targetFile).name;
      fs.copyFile(targetFile, getNginxPath(targetFileName));
    });
  } catch (error) {
    log.error('导入nginx文件失败', error.message);
  }
});

// 退出应用
ipcMain.on('quitApp', () => {
  app.quit();
})