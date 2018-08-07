const fs = require('fs');
const util = require('util');

exports.writeFile = util.promisify(fs.writeFile);
exports.readFile = util.promisify(fs.readFile);
exports.unlink = util.promisify(fs.unlink);
exports.copyFile = util.promisify(fs.copyFile);
exports.exists = async function exists(file) {
  return new Promise(resolve => {
    fs.stat(file, (err) => {
      if(err) resolve(false);
      resolve(true);
    });
  });
};