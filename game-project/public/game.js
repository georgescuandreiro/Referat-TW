const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

class Entity {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    checkBounds() {
        if (this.x < 0) this.x = 0;
        if (this.y < 0) this.y = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        if (this.y + this.height > canvas.height) this.y = canvas.height - this.height;
    }

    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
}

class Player extends Entity {
    constructor(x, y, width, height, color) {
        super(x, y, width, height, color);
        this.speed = 5;
        this.dx = 0;
        this.dy = 0;
        this.health = 100;
        this.score = 0;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.checkBounds();
    }

    collect(objects) {
        objects.forEach((object, index) => {
            if (this.collidesWith(object)) {
                objects.splice(index, 1);
                this.score += 10;
                updateHUD();
            }
        });
    }

    collide(enemies) {
        enemies.forEach((enemy, index) => {
            if (this.collidesWith(enemy)) {
                this.health -= 25;
                updateHUD();
                enemies.splice(index, 1);
                if (this.health <= 0) {
                    endGame();
                }
            }
        });
    }

    collideObstacles(obstacles) {
        obstacles.forEach(obstacle => {
            if (this.collidesWith(obstacle)) {
                if (this.dx > 0) this.x = obstacle.x - this.width;
                if (this.dx < 0) this.x = obstacle.x + obstacle.width;
                if (this.dy > 0) this.y = obstacle.y - this.height;
                if (this.dy < 0) this.y = obstacle.y + obstacle.height;
                this.dx = 0;
                this.dy = 0;
            }
        });
    }

    placeObstacle(obstacles) {
        obstacles.push(new Obstacle(this.x - this.width, this.y - this.height, 20, 20, 'gray'));
    }
}

class Enemy extends Entity {
    constructor(x, y, width, height, color, target, speed, lifespan) {
        super(x, y, width, height, color);
        this.target = target;
        this.speed = speed;
        this.lifespan = lifespan;
        this.spawnTime = Date.now();
    }

    update(obstacles) {
        let dx = this.target.x - this.x;
        let dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / distance) * this.speed;
        dy = (dy / distance) * this.speed;

        if (!this.collidesWithObstacle(dx, dy, obstacles)) {
            this.x += dx;
            this.y += dy;
        } else {
            // Try to find an alternative path
            const alternatives = [
                { dx: this.speed, dy: 0 },
                { dx: -this.speed, dy: 0 },
                { dx: 0, dy: this.speed },
                { dx: 0, dy: -this.speed }
            ];
            for (const alternative of alternatives) {
                if (!this.collidesWithObstacle(alternative.dx, alternative.dy, obstacles)) {
                    this.x += alternative.dx;
                    this.y += alternative.dy;
                    break;
                }
            }
        }
    }

    collidesWithObstacle(dx, dy, obstacles) {
        return obstacles.some(obstacle => (
            this.x + dx < obstacle.x + obstacle.width &&
            this.x + dx + this.width > obstacle.x &&
            this.y + dy < obstacle.y + obstacle.height &&
            this.y + dy + this.height > obstacle.y
        ));
    }

    isExpired() {
        return (Date.now() - this.spawnTime) > this.lifespan;
    }
}

class Collectible extends Entity {
    constructor(x, y, width, height, color, splitCount = 0) {
        super(x, y, width, height, color);
        this.angle = Math.random() * 2 * Math.PI;
        this.splitCount = splitCount;
        this.splitTimer = (this.splitCount === 0) ? objectSplitTime * 1000 : objectSplitTime * 1000 * 2; // Initial split time, then double for second split
    }

    update(objects, obstacles, enemies) {
        this.angle += (Math.random() - 0.5) * 0.2; // Randomize direction slightly
        this.x += Math.cos(this.angle) * 2;
        this.y += Math.sin(this.angle) * 2;
        this.checkBounds();
        this.avoidCollisions(objects, obstacles, enemies);

        this.splitTimer -= 1000 / 60; // Assuming 60 FPS
        if (this.splitTimer <= 0 && this.splitCount < objectMaxSplits) {
            this.split(objects);
            this.splitCount++;
            this.splitTimer = (this.splitCount === 1) ? objectSplitTime * 1000 * 2 : 0; // Double the time for second split
        }
    }

    split(objects) {
        const size = this.width / 2;
        objects.push(new Collectible(this.x, this.y, size, size, 'green', this.splitCount + 1));
        objects.push(new Collectible(this.x, this.y, size, size, 'green', this.splitCount + 1));
    }

    avoidCollisions(objects, obstacles, enemies) {
        objects.forEach(object => {
            if (this !== object && this.collidesWith(object)) {
                this.angle += Math.PI;
            }
        });
        obstacles.forEach(obstacle => {
            if (this.collidesWith(obstacle)) {
                this.angle += Math.PI;
            }
        });
        enemies.forEach(enemy => {
            if (this.collidesWith(enemy)) {
                this.angle += Math.PI;
            }
        });
    }
}

class Obstacle extends Entity {
    constructor(x, y, width, height, color) {
        super(x, y, width, height, color);
    }

    destroy(obstacles) {
        obstacles.splice(obstacles.indexOf(this), 1);
    }
}

const player = new Player(canvas.width / 2, canvas.height / 2, 20, 20, 'blue');
let enemies = [];
let objects = [];
let obstacles = [];
let enemySpeed = 2;
let objectSpawnInterval = 1;
let objectSplitTime = 15;
let enemyLifespan = 15;
let objectMaxSplits = 2;
let gameInterval;
let timerInterval;

function spawnEnemy() {
    const corners = [
        { x: 0, y: 0 },
        { x: canvas.width - 20, y: 0 },
        { x: 0, y: canvas.height - 20 },
        { x: canvas.width - 20, y: canvas.height - 20 }
    ];
    const corner = corners[Math.floor(Math.random() * corners.length)];
    enemies.push(new Enemy(corner.x, corner.y, 20, 20, 'red', player, enemySpeed, enemyLifespan * 1000));
}

function spawnObject() {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    objects.push(new Collectible(x, y, 20, 20, 'green'));
}

function update() {
    player.update();
    player.collect(objects);
    player.collide(enemies);
    player.collideObstacles(obstacles);

    enemies = enemies.filter(enemy => !enemy.isExpired());
    enemies.forEach(enemy => enemy.update(obstacles));
    objects.forEach(object => object.update(objects, obstacles, enemies));

    clear();
    player.draw();
    enemies.forEach(enemy => enemy.draw());
    objects.forEach(object => object.draw());
    obstacles.forEach(obstacle => obstacle.draw());

    if (!isGameOver) {
        requestAnimationFrame(update);
    }
}

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function keyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'd') player.dx = player.speed;
    if (e.key === 'ArrowLeft' || e.key === 'a') player.dx = -player.speed;
    if (e.key === 'ArrowUp' || e.key === 'w') player.dy = -player.speed;
    if (e.key === 'ArrowDown' || e.key === 's') player.dy = player.speed;
    if (e.key === ' ') player.placeObstacle(obstacles);
    if (e.key === 'e') destroyObstacle();
}

function keyUp(e) {
    if (e.key === 'ArrowRight' || e.key === 'd') player.dx = 0;
    if (e.key === 'ArrowLeft' || e.key === 'a') player.dx = 0;
    if (e.key === 'ArrowUp' || e.key === 'w') player.dy = 0;
    if (e.key === 'ArrowDown' || e.key === 's') player.dy = 0;
}

function destroyObstacle() {
    if (obstacles.length > 0) {
        obstacles[obstacles.length - 1].destroy(obstacles);
    }
}

function startGame() {
    player.score = 0;
    player.health = 100;
    enemies = [];
    objects = [];
    obstacles = [];
    isGameOver = false;

    document.getElementById('menu').style.display = 'none';
    document.getElementById('config').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    canvas.style.display = 'block';
    document.getElementById('gameOverButton').style.display = 'none';

    startTime = Date.now();
    gameInterval = setInterval(spawnEnemy, 2000);
    setInterval(spawnObject, objectSpawnInterval * 1000);
    timerInterval = setInterval(updateHUD, 1000);
    update();
}

function showMenu() {
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    document.getElementById('menu').style.display = 'block';
    document.getElementById('config').style.display = 'none';
    document.getElementById('highscores').style.display = 'none';
    canvas.style.display = 'none';
    document.getElementById('gameOverButton').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
}

function showConfig() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('config').style.display = 'block';
    document.getElementById('highscores').style.display = 'none';
    canvas.style.display = 'none';
    document.getElementById('hud').style.display = 'none';
}

function showHighscores() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('config').style.display = 'none';
    document.getElementById('highscores').style.display = 'block';
    canvas.style.display = 'none';
    document.getElementById('hud').style.display = 'none';

    fetch('/highscores')
        .then(response => response.json())
        .then(data => {
            const highscoreList = document.getElementById('highscoreList');
            highscoreList.innerHTML = '';
            data.forEach(score => {
                const li = document.createElement('li');
                li.textContent = `Scor: ${score.score} - Timp: ${score.time.toFixed(2)}s`;
                highscoreList.appendChild(li);
            });
        });
}

function saveConfig() {
    enemySpeed = parseInt(document.getElementById('enemySpeed').value);
    objectSpawnInterval = parseInt(document.getElementById('objectSpawnInterval').value);
    objectSplitTime = parseInt(document.getElementById('objectSplitTime').value);
    enemyLifespan = parseInt(document.getElementById('enemyLifespan').value);
    objectMaxSplits = parseInt(document.getElementById('objectMaxSplits').value);
    showMenu();
}

function saveScore() {
    const score = {
        score: player.score,
        time: (Date.now() - startTime) / 1000
    };

    fetch('/highscores', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(score)
    });
}

function updateHUD() {
    document.getElementById('score').innerText = `Scor: ${player.score}`;
    document.getElementById('timer').innerText = `Timp: ${Math.floor((Date.now() - startTime) / 1000)}`;
    document.getElementById('health').innerText = `Viață: ${player.health}`;
}

function endGame() {
    isGameOver = true;
    saveScore();
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    document.getElementById('gameOverButton').style.display = 'block';
}

let startTime;
let isGameOver = false;

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

