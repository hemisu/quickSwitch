const mkdirp = require('mkdirp');

module.exports = function mkdirp(path) {
  return new Promise((resolve, reject) => {
    mkdirp(path, err => {
      if (err) return reject(err);
      resolve(path);
    });
  });
};