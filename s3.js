const knox = require('knox')
const xtend = require('xtend')
const async = require('async')
const through2 = require('through2')

const cache = require('./cache')
const config = require('./config')

module.exports = createClient(config.s3)

function createClient (config) {
  const client = knox.createClient(config)

  const dirCache = cache((dir, cb) => getDirTime(client, dir, cb))
  const urlCache = cache((file, cb) => getFileUrl(client, file, cb))

  return {
    list: (dir, cb) => {
      if (dir[dir.length - 1] !== '/') dir += '/'
      dir = dir.replace(/^\//, '')
      const opts = { prefix: dir, delimiter: '/' }

      const buf = []
      s3List(client, opts)
        .on('error', cb || (() => {}))
        .on('data', item => buf.push(item))
        .on('end', onEnd)

      function onEnd () {
        async.mapLimit(buf, 8, getCache, cb)
      }

      function getCache (item, cb) {
        if (item.Prefix) {
          dirCache(item.Prefix, (err, time) => {
            if (err) return cb(err)
            item.LastModified = time
            cb(null, item)
          })
        } else {
          urlCache(item.Key, (err, url) => {
            if (err) return cb(err)
            item.url = url
            cb(null, item)
          })
        }
      }
    }
  }
}

function s3List (client, opts, max) {
  opts = opts || {}
  const stream = through2.obj()

  list(client, opts, stream, max)
  return stream
}

function list (client, opts, stream, max) {
  if (max) opts['max-keys'] = max
  const cpOpts = xtend({}, opts)

  client.list(opts, (err, data) => {
    if (err) return stream.emit('error', err)

    data.Contents = data.Contents || []
    data.CommonPrefixes = data.CommonPrefixes || []

    let lastKey
    data.Contents.forEach(file => {
      lastKey = file.Key
      stream.write(file)
    })
    data.CommonPrefixes.forEach(dir => {
      stream.write(dir)
    })

    if (max || !data.IsTruncated) {
      return stream.end()
    }

    cpOpts.marker = data.NextMarker || lastKey
    list(client, cpOpts, stream)
  })
}

function getFileUrl (client, file, cb) {
  const req = client.request('PUT', encodeURIComponent(file) + '?acl', {
    'x-amz-acl': 'public-read'
  })

  req.on('response', res => {
    if (res.statusCode >= 400) return cb(res.body)
    cb(null, client.http(file))
  })

  req.end()
}

function getDirTime (client, prefix, cb) {
  let done = false
  s3List(client, { prefix }, 1)
    .on('data', file => {
      if (done) return
      done = true
      cb(null, file.LastModified)
    })
    .on('error', cb)
    .on('end', () => {})
}
