const fs = require('./fs');
// const nodefs = require('fs').fs;
const path = require('path');
const mkdirp = require('./mkdirp');
const os = require('os');
// const util = require('util');
const log = require('electron-log');
const store = require('./store');

let basePath;
if(process.env.NODE_ENV === 'development'){
  basePath = path.join(__dirname);
} else {
  basePath = path.join(process.resourcesPath, 'app/main');
}


const SYSTEM_HOSTS_FILE = '/etc/hosts';
const DEFAULT_HOSTS_FILE = path.normalize(`${basePath}/default.txt`);

const DATA_DIR_NAME = process.env.NODE_ENV === 'dev' ? '.quickSwitch-dev' : '.quickSwitch';
const DATA_PATH = path.normalize(`${process.env.HOME}/${DATA_DIR_NAME}`);
const USER_PATH = path.normalize(`${process.env.HOME}/${DATA_DIR_NAME}/userData`);

const HOST_FILE = path.normalize(`${DATA_PATH}/hosts`);
const HOST_TEMP = path.normalize(`${DATA_PATH}/hosts.temp`);
const HOST_BACKUP = path.normalize(`${USER_PATH}/host.bak`);

exports.backup = async function backup() {
  fs.copyFile(SYSTEM_HOSTS_FILE, HOST_BACKUP);
}

exports.load = async function load() {
  await mkdirp(DATA_PATH);
  let list;
  try {
    const buffer = await fs.readFile(HOST_FILE);
    list = JSON.parse(buffer.toString()) || [];
  } catch (err) {
    if (err) console.error(err);
    list = [];
  }
  return list;
};

exports.getDefault = async function getDefault() {
  // 获取默认hosts
  log.warn('2.3 进入getDefault');
  const buffer = await fs.readFile(DEFAULT_HOSTS_FILE);
  return buffer.toString();
};

exports.save = async function save(list) {
  if (!list) return;

  await mkdirp(DATA_PATH);
  await fs.writeFile(HOST_FILE, JSON.stringify(list)); // 存储配置

  const usedList = list.filter(item => item.checked); // 筛选被选择的配置
  const defaultConfig = await this.getDefault();

  // const arrConfig = defaultConfig.split("\n").filter(Boolean)
  //   .map(v => v.split(" ")).reduce((a, b) => a.concat({name: 'default', url: b[0], hostname: b[1]}), [])
  // usedList.unshift(...arrConfig);
  const lines = usedList
    .map((item, i) => {
      const line = [];
      if (i > 0) {
        line.push(os.EOL);
      }
      line.push(`# ${item.name}${os.EOL}${item.url.trim()} ${item.hostname.trim()}`);
      return line.join('');
    });
  lines.unshift(defaultConfig);
  await fs.writeFile(HOST_TEMP, lines.join(os.EOL));
  return Promise.resolve(HOST_TEMP);
};

exports.safeSave = async function safeSave(list) {
  try {
    if (!list) return;
    // 获取备份的hosts文件
    let hostsArr = (await fs.readFile(SYSTEM_HOSTS_FILE)).toString().split(os.EOL);
  
    const qsMarkLineStart = `# quickSwitch`;
    const qsMarkLineEnd = `# quickSwitch End`;
    const startIndex = hostsArr.indexOf(qsMarkLineStart);
    const endIndex = hostsArr.lastIndexOf(qsMarkLineEnd);
    log.info(startIndex, endIndex);
    if (startIndex !== -1 && endIndex !== -1) {
      // 清除之前的记录
      log.info('清除之前的记录')
      hostsArr = [...hostsArr.slice(0,startIndex), ...hostsArr.slice(endIndex + 1)]
    }
    // 存储新的hosts备份
    fs.writeFile(HOST_BACKUP, hostsArr.join(os.EOL))
    await store.getItem('config').then((data) => {
      const obj = JSON.parse(data);
      // 注释掉已存在的配置项目
      Object.entries(obj).map(([k, v]) => {
        hostsArr = hostsArr.map(line => {
          if ((new RegExp(`^${v.ip}\\s+${v.hostname}$`)).exec(line) !== null) {
            return `# ${line}`;
          }
          return line;
        })
      })
      
      // 筛选需要启动的项目
      const qsHostsList = list.filter(item => item.checked)
        .map(item => `# ${item.name}${os.EOL}${item.url.trim()} ${item.hostname.trim()}`) || [];

      const lines = [
        ...hostsArr,
        qsMarkLineStart,
        ...qsHostsList,
        qsMarkLineEnd,
      ];
      fs.writeFile(HOST_FILE, lines.join(os.EOL));
      return true;
    })
  } catch (err) {
    return false;
  }
}