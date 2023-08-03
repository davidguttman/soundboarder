var knox = require('knox')
var xtend = require('xtend')
var through2 = require('through2')
var AsyncCache = require('async-cache')

const config = require('./config')

module.exports = createClient(config.s3)

function createClient (config) {
  var client = knox.createClient(config)

  var dirCache = new AsyncCache({
    load: function (dir, cb) {
      getDirTime(client, dir, cb)
    }
  })

  var urlCache = new AsyncCache({
    load: function (file, cb) {
      getFileUrl(client, file, cb)
    }
  })

  return {
    list: function (dir, cb) {
      if (dir[dir.length - 1] !== '/') dir += '/'
      dir = dir.replace(/^\//, '')
      var opts = { prefix: dir, delimiter: '/' }

      var tr = through2.obj(function (item, enc, cb) {
        if (item.Prefix) {
          dirCache.get(item.Prefix, function (err, time) {
            item.LastModified = time
            return cb(null, item)
          })
        } else {
          urlCache.get(item.Key, function (err, url) {
            if (err) return cb(err)
            item.url = url
            cb(null, item)
          })
        }
      })

      var buf = []
      return s3List(client, opts)
        .pipe(tr)
        .on('data', function (item) {
          if (cb) buf.push(item)
        })
        .on('end', function () {
          if (cb) cb(null, buf)
        })
        .on('error', cb || function () {})
    }
  }
}

function s3List (client, opts, max) {
  opts = opts || {}
  var stream = through2.obj()

  list(client, opts, stream, max)
  return stream
}

function list (client, opts, stream, max) {
  if (max) opts['max-keys'] = max
  var cpOpts = xtend({}, opts)

  client.list(opts, function (err, data) {
    if (err) return stream.emit('error', err)

    data.Contents = data.Contents || []
    data.CommonPrefixes = data.CommonPrefixes || []

    var lastKey
    data.Contents.forEach(function (file) {
      lastKey = file.Key
      stream.write(file)
    })
    data.CommonPrefixes.forEach(function (dir) {
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
  var req = client.request('PUT', encodeURIComponent(file) + '?acl', {
    'x-amz-acl': 'public-read'
  })

  req.on('response', function (res) {
    if (res.statusCode >= 400) return cb(res.body)
    cb(null, client.http(file))
  })

  req.end()
}

function getDirTime (client, prefix, cb) {
  var done = false
  s3List(client, { prefix: prefix }, 1)
    .on('data', function (file) {
      if (done) return
      done = true
      cb(null, file.LastModified)
    })
    .on('error', cb)
    .on('end', function () {})
}
