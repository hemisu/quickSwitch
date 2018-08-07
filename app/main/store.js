// const { app } = require('electron');
const path = require('path');
const mkdirp = require('./mkdirp');
const fs = require('./fs');


// const DATA_PATH = app.getPath('userData');
const DATA_DIR_NAME = process.env.NODE_ENV === 'dev' ? '.quickSwitch-dev' : '.quickSwitch';
const DATA_PATH = path.normalize(`${process.env.HOME}/${DATA_DIR_NAME}/userData`);
// const DATA_PATH = app.getPath('temp');

exports.init = async function init() {
  await mkdirp(DATA_PATH); // 创建userData文件夹
  await mkdirp(path.normalize(`${DATA_PATH}/nginx`)); // 创建nginx配置文件夹
}

exports.setItem = async function setItem (key, value) {
  await mkdirp(DATA_PATH);
  const storeFile = `${DATA_PATH}/${key}`;
  try {
    return await fs.writeFile(storeFile, value);
  } catch (err) {
    console.error('setItem', err);
  }
};

exports.getItem = async function getItem (key) {
  await mkdirp(DATA_PATH);
  const storeFile = `${DATA_PATH}/${key}`;
  // console.log(storeFile);
  try {
    const initExist = await fs.exists(storeFile);
    if(!initExist) return false; // 未初始化

    const buffer = await fs.readFile(storeFile);
    return buffer.toString();
  } catch (err) {
    console.error('getItem', err);
  }
};

exports.removeItem = async function removeItem (key) {
  await mkdirp(DATA_PATH);
  const storeFile = `${DATA_PATH}/${key}`;
  try {
    await fs.unlink(storeFile);
  } catch (err) {
    console.error('removeItem', err);
  }
};