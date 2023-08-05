const { Redis } = require('ioredis')

const { url } = require('./config').redis

module.exports = new Redis(url)
