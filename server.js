const path = require('path')
const express = require('express')
const { EventEmitter } = require('events')

const s3 = require('./s3')

const PORT = process.env.PORT || 3000

const emitter = new EventEmitter()
const app = express()

app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/send', handleSend)
app.get('/receive', handleReceive)
app.post('/play', handlePlay)
app.get('/listen', handleListen)

function handlePlay (req, res) {
  const sound = req.body.sound
  console.log('play', sound)
  if (!sound) return res.status(400).send('Missing sound query parameter')

  emitter.emit('play', sound)
}

function handleListen (req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive'
  })

  const onPlay = sound => res.write(`data: ${JSON.stringify(sound)}\n\n`)
  emitter.on('play', onPlay)

  res.on('close', function () {
    emitter.off('play', onPlay)
  })
}

function handleSend (req, res) {
  handleRequest('send.html.ejs', req, res)
}

function handleReceive (req, res) {
  handleRequest('receive.html.ejs', req, res)
}

function handleRequest (viewName, req, res) {
  s3.list('misc/soundboard', (err, files) => {
    if (err) return res.status(500).send(err)

    const sounds = files
      .filter(file => file.Key.endsWith('.mp3'))
      .map(file => {
        return {
          name: file.Key.replace('misc/soundboard/', '').replace('.mp3', ''),
          url: file.url
        }
      })

    const nSounds = sounds.length
    const columns = 4
    const rows = Math.ceil(nSounds / columns)

    res.render(viewName, { sounds, columns, rows })
  })
}

app.listen(PORT, () => {
  console.log('App is listening on port ' + PORT)
})
