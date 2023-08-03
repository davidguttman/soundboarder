const express = require('express');
const app = express();
const path = require('path');

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {

  const soundsUrls = [
    'https://dmg-share.s3.wasabisys.com/misc/soundboard/harsh.mp3'
  ]

  const sounds = soundsUrls.map((url) => {
    return {
      url,
      name: url.split('/').pop().split('.')[0]
    }
  });

  res.render('index.html.ejs', { sounds });
});

app.listen(3000, () => {
  console.log('App is listening on port 3000');
});



