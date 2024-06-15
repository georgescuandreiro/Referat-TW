const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
let highScores = [];

app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/highscores', (req, res) => {
    res.json(highScores);
});

app.post('/highscores', (req, res) => {
    const newScore = req.body;
    highScores.push(newScore);
    highScores = highScores.sort((a, b) => b.score - a.score).slice(0, 10);
    fs.writeFileSync('server/highscores.json', JSON.stringify(highScores));
    res.status(201).json(newScore);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    if (fs.existsSync('server/highscores.json')) {
        highScores = JSON.parse(fs.readFileSync('server/highscores.json'));
    }
});

