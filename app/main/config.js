const path = require('path');
const argv = require('minimist')(process.argv.slice(2))

module.exports = {
  APP_NAME: 'Quick Switch',
  INDEX: `file://${path.resolve(__dirname, '..' , 'app.html')}`,
  DEBUG: argv.debug
}