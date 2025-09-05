// board
let board;

const rowCount = 21;
const columnCount = 19;
const tileSize = 32;

const boardWidth = columnCount * tileSize;  // 608
const boardHeight = rowCount * tileSize;    // 672

let context;

let blueGhostImage;
let orangeGhostImage;
let pinkGhostImage;
let redGhostImage;
let pacmanUpImage;
let pacmanDownImage;
let pacmanLeftImage;
let pacmanRightImage;
let wallImage;

// ▼ 체리
let cherryImage;
let cherry = null;
let cherryActive = false;
let lastCherryTriggerScore = -1;
const CHERRY_BONUS = 300;

// ▼ 디버그/프리로드 상태
let ASSETS_READY = false;
let LAST_ERROR = null;

// X = wall, O = skip, P = pac man, ' ' = food
// Ghosts: b = blue, o = orange, p = pink, r = red
const tileMap = [
  "XXXXXXXXXXXXXXXXXXX",
  "X        X        X",
  "X XX XXX X XXX XX X",
  "X                 X",
  "X XX X XXXXX X XX X",
  "X    X       X    X",
  "XXXX XXXX XXXX XXXX",
  "OOOX X       X XOOO",
  "XXXX X XXrXX X XXXX",
  "O       bpo       O",
  "XXXX X XXXXX X XXXX",
  "OOOX X       X XOOO",
  "XXXX X XXXXX X XXXX",
  "X        X        X",
  "X XX XXX X XXX XX X",
  "X  X     P     X  X",
  "XX X X XXXXX X X XX",
  "X    X   X   X    X",
  "X XXXXXX X XXXXXX X",
  "X                 X",
  "XXXXXXXXXXXXXXXXXXX"
];

const walls = new Set();
const foods = new Set();
const ghosts = new Set();

let pacman;

const directions = ["U", "D", "L", "R"]; // up down left right

let score = 0;
let lives = 3;
let gameOver = false;

// === 안전한 초기화: DOMContentLoaded ===
document.addEventListener("DOMContentLoaded", () => {
  board = document.getElementById("board");
  board.width  = boardWidth;
  board.height = boardHeight;
  context = board.getContext("2d");

  // 전역 에러 로거(검은 화면 원인 추적)
  window.onerror = (msg, src, line, col, err) => {
    LAST_ERROR = `${msg} @ ${line}:${col}`;
    console.error("ERROR:", msg, src, line, col, err);
  };

  // 이미지 프리로드 후 시작
  preloadImages(() => {
    loadMap();
    for (let ghost of ghosts.values()) {
      const newDirection = directions[Math.floor(Math.random() * 4)];
      ghost.updateDirection(newDirection);
    }
    ASSETS_READY = true;
    update();
  });

  // 입력: 키보드(즉시 반응)
  document.addEventListener("keydown", movePacman, { passive: false });

  // 입력: 터치 버튼 + 스와이프
  setupTouchControls();
});

// === 이미지 프리로드: 모두 로드된 뒤 게임 시작 ===
function preloadImages(done) {
  const entries = [
    ["wallImage",        "./wall.png"],
    ["blueGhostImage",   "./blueGhost.png"],
    ["orangeGhostImage", "./orangeGhost.png"],
    ["pinkGhostImage",   "./pinkGhost.png"],
    ["redGhostImage",    "./redGhost.png"],
    ["pacmanUpImage",    "./pacmanUp.png"],
    ["pacmanDownImage",  "./pacmanDown.png"],
    ["pacmanLeftImage",  "./pacmanLeft.png"],
    ["pacmanRightImage", "./pacmanRight.png"],
    ["cherryImage",      "./cherry.png"]
  ];

  let remain = entries.length;

  const onLoad = () => {
    remain--;
    if (remain === 0) done();
  };

  const onError = (e) => {
    console.error("Image load failed:", e?.target?.src || e);
    // 로드 실패해도 게임은 시작(자리표시로 보이게)
    onLoad();
  };

  for (const [name, src] of entries) {
    const img = new Image();
    img.onload = onLoad;
    img.onerror = onError;
    img.src = src;

    // 전역 변수에 대입
    if (name === "wallImage") wallImage = img;
    else if (name === "blueGhostImage") blueGhostImage = img;
    else if (name === "orangeGhostImage") orangeGhostImage = img;
    else if (name === "pinkGhostImage") pinkGhostImage = img;
    else if (name === "redGhostImage") redGhostImage = img;
    else if (name === "pacmanUpImage") pacmanUpImage = img;
    else if (name === "pacmanDownImage") pacmanDownImage = img;
    else if (name === "pacmanLeftImage") pacmanLeftImage = img;
    else if (name === "pacmanRightImage") pacmanRightImage = img;
    else if (name === "cherryImage") cherryImage = img;
  }
}

function loadMap() {
  walls.clear();
  foods.clear();
  ghosts.clear();

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < columnCount; c++) {
      const row = tileMap[r];
      const ch = row[c];
      const x = c * tileSize;
      const y = r * tileSize;

      if (ch === "X") { // block wall
        const wall = new Block(wallImage, x, y, tileSize, tileSize);
        walls.add(wall);
      }
      else if (ch === "b") { // blue ghost
        const ghost = new Block(blueGhostImage, x, y, tileSize, tileSize);
        ghosts.add(ghost);
      }
      else if (ch === "o") { // orange ghost
        const ghost = new Block(orangeGhostImage, x, y, tileSize, tileSize);
        ghosts.add(ghost);
      }
      else if (ch === "p") { // pink ghost
        const ghost = new Block(pinkGhostImage, x, y, tileSize, tileSize);
        ghosts.add(ghost);
      }
      else if (ch === "r") { // red ghost
        const ghost = new Block(redGhostImage, x, y, tileSize, tileSize);
        ghosts.add(ghost);
      }
      else if (ch === "P") { // pacman
        pacman = new Block(pacmanRightImage, x, y, tileSize, tileSize);
      }
      else if (ch === " ") { // empty is food
        const food = new Block(null, x + 14, y + 14, 4, 4);
        foods.add(food);
      }
      // 'O'는 skip(아무것도 안 만듦)
    }
  }
}

function update() {
  if (gameOver) return;

  move();
  maybeSpawnCherryOnScoreMilestone();
  checkCherryCollision();
  draw();

  setTimeout(update, 50); // 20 FPS
}

function draw() {
  // 배경(검정)
  context.fillStyle = "#000";
  context.fillRect(0, 0, board.width, board.height);

  // 벽
  for (let wall of walls.values()) {
    if (wall.image && wall.image.complete) {
      context.drawImage(wall.image, wall.x, wall.y, wall.width, wall.height);
    } else {
      // 이미지 미로딩 대비: 회색 박스
      context.fillStyle = "#333";
      context.fillRect(wall.x, wall.y, wall.width, wall.height);
    }
  }

  // 음식 점
  context.fillStyle = "white";
  for (let food of foods.values()) {
    context.fillRect(food.x, food.y, food.width, food.height);
  }

  // 체리
  if (cherryActive && cherry) {
    if (cherry.image && cherry.image.complete) {
      context.drawImage(cherry.image, cherry.x, cherry.y, cherry.width, cherry.height);
    } else {
      // 자리표시(빨간 원)
      context.fillStyle = "#f00";
      context.beginPath();
      context.arc(cherry.x + cherry.width / 2, cherry.y + cherry.height / 2, 10, 0, Math.PI * 2);
      context.fill();
    }
  }

  // 팩맨
  if (pacman) {
    if (pacman.image && pacman.image.complete) {
      context.drawImage(pacman.image, pacman.x, pacman.y, pacman.width, pacman.height);
    } else {
      // 이미지 미로딩 대비: 노란 원
      context.fillStyle = "#ff0";
      context.beginPath();
      context.arc(
        pacman.x + pacman.width / 2,
        pacman.y + pacman.height / 2,
        pacman.width / 2,
        0.25 * Math.PI,
        1.75 * Math.PI
      );
      context.lineTo(pacman.x + pacman.width / 2, pacman.y + pacman.height / 2);
      context.fill();
    }
  }

  // 유령
  for (let ghost of ghosts.values()) {
    if (ghost.image && ghost.image.complete) {
      context.drawImage(ghost.image, ghost.x, ghost.y, ghost.width, ghost.height);
    } else {
      // 보라색 네모 자리표시
      context.fillStyle = "#a0f";
      context.fillRect(ghost.x, ghost.y, ghost.width, ghost.height);
    }
  }

  // UI: score / lives
  context.fillStyle = "white";
  context.font = "14px sans-serif";
  if (gameOver) {
    context.fillText("Game Over: " + String(score), tileSize / 2, tileSize / 2);
  } else {
    context.fillText("x" + String(lives) + " " + String(score), tileSize / 2, tileSize / 2);
  }

  // 디버그 오버레이
  context.font = "12px monospace";
  context.fillStyle = ASSETS_READY ? "#0f0" : "#ff0";
  context.fillText(`ASSETS_READY: ${ASSETS_READY}`, 8, boardHeight - 24);
  if (LAST_ERROR) {
    context.fillStyle = "#f66";
    context.fillText(`ERROR: ${LAST_ERROR}`, 8, boardHeight - 8);
  }
}

function move() {
  if (!pacman) return;

  pacman.x += pacman.velocityX;
  pacman.y += pacman.velocityY;

  // check wall collisions
  for (let wall of walls.values()) {
    if (collision(pacman, wall)) {
      pacman.x -= pacman.velocityX;
      pacman.y -= pacman.velocityY;
      break;
    }
  }

  // check ghosts collision
  for (let ghost of ghosts.values()) {
    if (collision(ghost, pacman)) {
      lives -= 1;
      if (lives == 0) {
        gameOver = true;
        return;
      }
      resetPositions();
    }

    if (ghost.y == tileSize * 9 && ghost.direction != "U" && ghost.direction != "D") {
      ghost.updateDirection("U");
    }

    ghost.x += ghost.velocityX;
    ghost.y += ghost.velocityY;

    for (let wall of walls.values()) {
      if (collision(ghost, wall) || ghost.x <= 0 || ghost.x + ghost.width >= boardWidth) {
        ghost.x -= ghost.velocityX;
        ghost.y -= ghost.velocityY;
        const newDirection = directions[Math.floor(Math.random() * 4)];
        ghost.updateDirection(newDirection);
      }
    }
  }

  // check food collision
  let foodEaten = null;
  for (let food of foods.values()) {
    if (collision(pacman, food)) {
      foodEaten = food;
      score += 10;
      break;
    }
  }
  foods.delete(foodEaten);

  // next level
  if (foods.size == 0) {
    loadMap();
    resetPositions();
  }
}

function movePacman(e) {
  // 모바일에서 방향키로 페이지가 스크롤되는 것 방지
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }

  if (gameOver) {
    loadMap();
    resetPositions();
    lives = 3;
    score = 0;
    gameOver = false;
    lastCherryTriggerScore = -1;
    cherryActive = false;
    cherry = null;

    update(); // restart game loop
    return;
  }

  if (e.code == "ArrowUp" || e.code == "KeyW") {
    pacman.updateDirection("U");
  } else if (e.code == "ArrowDown" || e.code == "KeyS") {
    pacman.updateDirection("D");
  } else if (e.code == "ArrowLeft" || e.code == "KeyA") {
    pacman.updateDirection("L");
  } else if (e.code == "ArrowRight" || e.code == "KeyD") {
    pacman.updateDirection("R");
  }

  // update pacman images
  if (pacman.direction == "U") {
    pacman.image = pacmanUpImage;
  } else if (pacman.direction == "D") {
    pacman.image = pacmanDownImage;
  } else if (pacman.direction == "L") {
    pacman.image = pacmanLeftImage;
  } else if (pacman.direction == "R") {
    pacman.image = pacmanRightImage;
  }
}

function collision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function resetPositions() {
  pacman.reset();
  pacman.velocityX = 0;
  pacman.velocityY = 0;

  for (let ghost of ghosts.values()) {
    ghost.reset();
    const newDirection = directions[Math.floor(Math.random() * 4)];
    ghost.updateDirection(newDirection);
  }

  cherryActive = false;
  cherry = null;
}

// === 체리 ===
function maybeSpawnCherryOnScoreMilestone() {
  if (score > 0 && score % 300 === 0 && lastCherryTriggerScore !== score) {
    spawnCherryAtRandomFloor();
    lastCherryTriggerScore = score;
  }
}

function spawnCherryAtRandomFloor() {
  const candidates = [];
  for (let r = 0; r < rowCount; r++) {
    const row = tileMap[r];
    for (let c = 0; c < columnCount; c++) {
      const ch = row[c];
      if (ch !== "X") { // 벽 제외
        const x = c * tileSize;
        const y = r * tileSize;
        const temp = { x, y, width: tileSize, height: tileSize };
        let overlap = pacman ? collision(temp, pacman) : false;
        if (!overlap) {
          for (const g of ghosts.values()) {
            if (collision(temp, g)) { overlap = true; break; }
          }
        }
        if (!overlap) candidates.push({ c, r });
      }
    }
  }

  if (candidates.length === 0) {
    cherryActive = false;
    cherry = null;
    return;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const cx = pick.c * tileSize;
  const cy = pick.r * tileSize;

  cherry = new Block(cherryImage, cx, cy, tileSize, tileSize);
  cherryActive = true;
}

function checkCherryCollision() {
  if (!cherryActive || !cherry || !pacman) return;
  if (collision(pacman, cherry)) {
    score += CHERRY_BONUS;
    cherryActive = false;
    cherry = null;
  }
}

// === 터치 컨트롤 & 스와이프 ===
function setupTouchControls() {
  // 버튼 터치/클릭
  const controls = document.getElementById("controls");
  if (controls) {
    controls.querySelectorAll(".btn").forEach(btn => {
      const dir = btn.getAttribute("data-dir");
      const handler = (ev) => {
        ev.preventDefault();
        if (pacman) pacman.updateDirection(dir);
      };
      btn.addEventListener("touchstart", handler, { passive: false });
      btn.addEventListener("click", handler);
    });
  }

  // 캔버스 스와이프(손가락으로 쓸어 방향 전환)
  const canvas = document.getElementById("board");
  if (!canvas) return;

  let touchStartX = 0, touchStartY = 0;
  let swiping = false;

  canvas.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length === 0) return;
    swiping = true;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  canvas.addEventListener("touchmove", (e) => {
    // 스크롤 방지
    if (swiping) e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    if (!swiping) return;
    swiping = false;

    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    // 스와이프 최소 거리
    const TH = 24; // px
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;

    let dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? "R" : "L";
    } else {
      dir = dy > 0 ? "D" : "U";
    }
    if (pacman) pacman.updateDirection(dir);
  }, { passive: false });
}

class Block {
  constructor(image, x, y, width, height) {
    this.image = image;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.startX = x;
    this.startY = y;
    this.direction = "R";
    this.velocityX = 0;
    this.velocityY = 0;
  }

  updateDirection(direction) {
    const prevDirection = this.direction;
    this.direction = direction;
    this.updateVelocity();
    this.x += this.velocityX;
    this.y += this.velocityY;

    for (let wall of walls.values()) {
      if (collision(this, wall)) {
        this.x -= this.velocityX;
        this.y -= this.velocityY;
        this.direction = prevDirection;
        this.updateVelocity();
        return;
      }
    }
  }

  updateVelocity() {
    if (this.direction == "U") {
      this.velocityX = 0;
      this.velocityY = -tileSize / 4;
    } else if (this.direction == "D") {
      this.velocityX = 0;
      this.velocityY = tileSize / 4;
    } else if (this.direction == "L") {
      this.velocityX = -tileSize / 4;
      this.velocityY = 0;
    } else if (this.direction == "R") {
      this.velocityX = tileSize / 4;
      this.velocityY = 0;
    }
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
  }
        }
