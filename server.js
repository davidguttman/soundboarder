const path = require('path')
const express = require('express')

const s3 = require('./s3')

const app = express()

app.set('view engine', 'ejs')

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

    res.render('index.html.ejs', { sounds, columns, rows })
  })
})

app.listen(3000, () => {
  console.log('App is listening on port 3000')
})
