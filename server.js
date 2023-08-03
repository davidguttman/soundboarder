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

app.get('/', (req, res) => {
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

    const view = req.query.send ? 'send.html.ejs' : 'index.html.ejs'
    res.render(view, { sounds, columns, rows })
  })
})

app.post('/play', (req, res) => {
  const sound = req.body.sound
  console.log('play', sound)
  if (!sound) return res.status(400).send('Missing sound query parameter')

  emitter.emit('play', sound)
})

app.get('/listen', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive'
  })

  const onPlay = sound => res.write(`data: ${JSON.stringify(sound)}\n\n`)
  emitter.on('play', onPlay)

  res.on('close', function () {
    emitter.off('play', onPlay)
  })
})

app.listen(PORT, () => {
  console.log('App is listening on port ' + PORT)
})
