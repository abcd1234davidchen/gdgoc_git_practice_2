const stage = document.querySelector("#photo-stage");
const wall = document.querySelector("#photo-wall");
const emptyMessage = document.querySelector("#empty-message");
const balls = [];

const MAX_BALL_SIZE = 160;
const MAX_AREA_FILL = 0.6;
const ENTRY_GRAVITY = 1250;
const SETTLED_GRAVITY = 1900;
const BOUNCE = 0.62;
const MAX_THROW_SPEED = 1800;
const MAX_ANGULAR_SPEED = 120;
const ROTATIONAL_FRICTION = 1.6;

function addDragControls(ball) {
  const moveBall = (event) => {
    if (!ball.dragging) return;

    const rect = stage.getBoundingClientRect();
    const now = performance.now();
    const elapsed = Math.max((now - ball.lastTime) / 1000, 0.008);
    const nextX = Math.max(ball.radius, Math.min(rect.width - ball.radius, event.clientX - rect.left));
    const nextY = Math.max(ball.radius, Math.min(rect.height - ball.radius, event.clientY - rect.top));

    const instantVx = (nextX - ball.x) / elapsed;
    const instantVy = (nextY - ball.y) / elapsed;
    ball.vx = Math.max(-MAX_THROW_SPEED, Math.min(MAX_THROW_SPEED, ball.vx * 0.35 + instantVx * 0.65));
    ball.vy = Math.max(-MAX_THROW_SPEED, Math.min(MAX_THROW_SPEED, ball.vy * 0.35 + instantVy * 0.65));
    ball.x = nextX;
    ball.y = nextY;
    ball.lastTime = now;
  };

  ball.element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    ball.dragging = true;
    ball.lastTime = performance.now();
    ball.vx = 0;
    ball.vy = 0;
    ball.element.classList.add("dragging");
    ball.element.setPointerCapture(event.pointerId);
  });

  ball.element.addEventListener("pointermove", moveBall);
  ball.element.addEventListener("pointerup", () => {
    const releaseDelay = performance.now() - ball.lastTime;
    const momentumRetention = Math.max(0, 1 - releaseDelay / 180);
    ball.vx *= momentumRetention;
    ball.vy *= momentumRetention;
    ball.dragging = false;
    ball.angularVelocity = Math.max(-MAX_ANGULAR_SPEED, Math.min(MAX_ANGULAR_SPEED, ball.vx * 0.08));
    ball.element.classList.remove("dragging");
  });
  ball.element.addEventListener("pointercancel", () => {
    ball.dragging = false;
    ball.element.classList.remove("dragging");
  });
}

function calculateBallSize(count) {
  if (!count) return MAX_BALL_SIZE;

  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const areaLimitedSize = Math.sqrt((MAX_AREA_FILL * width * height * 4) / (Math.PI * count));
  const boundaryLimitedSize = Math.min(width, height) * 0.9;

  return Math.min(MAX_BALL_SIZE, areaLimitedSize, boundaryLimitedSize);
}

function resizeBalls() {
  if (!balls.length) return;

  const size = calculateBallSize(balls.length);
  const radius = size / 2;
  const width = stage.clientWidth;
  const height = stage.clientHeight;

  balls.forEach((ball) => {
    ball.radius = radius;
    ball.element.style.width = `${size}px`;
    ball.element.style.height = `${size}px`;
    ball.x = Math.max(radius, Math.min(width - radius, ball.x));
    if (ball.y > radius) ball.y = Math.min(height - radius, ball.y);
  });
}

function showPhotos(sources) {
  wall.replaceChildren();
  balls.length = 0;
  emptyMessage.hidden = sources.length > 0;

  const stageWidth = stage.clientWidth;
  const ballSize = calculateBallSize(sources.length);

  sources.forEach((source, index) => {
    const item = document.createElement("figure");
    const image = new Image();
    const label = document.createElement("figcaption");
    const displayName = source.name.split("/").pop().replace(/\.[^.]+$/, "");
    const radius = ballSize / 2;
    const availableWidth = Math.max(stageWidth - ballSize, 1);
    const ball = {
      element: item,
      radius,
      x: radius + ((index * 137 + 41) % availableWidth),
      y: -radius - index * (ballSize * 0.72),
      vx: ((index % 3) - 1) * 35,
      vy: 0,
      angle: 0,
      angularVelocity: (index % 2 ? 1 : -1) * (35 + (index * 11) % 55),
      dragging: false,
      hasEntered: false,
      lastTime: 0,
    };

    item.className = "photo-item";
    item.tabIndex = 0;
    item.style.width = `${ballSize}px`;
    item.style.height = `${ballSize}px`;
    image.className = "photo";
    image.src = source.url;
    image.alt = displayName;
    image.draggable = false;
    label.className = "photo-name";
    label.textContent = displayName;
    item.append(image, label);
    wall.append(item);
    balls.push(ball);
    addDragControls(ball);
  });
}

function resolveBallCollision(first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const minimumDistance = first.radius + second.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= minimumDistance * minimumDistance) return;

  const distance = Math.sqrt(distanceSquared) || 0.01;
  const nx = dx / distance;
  const ny = dy / distance;
  const firstWeight = first.dragging ? 0 : 1;
  const secondWeight = second.dragging ? 0 : 1;
  const totalWeight = firstWeight + secondWeight;
  if (!totalWeight) return;

  const overlap = minimumDistance - distance;
  first.x -= nx * overlap * (firstWeight / totalWeight);
  first.y -= ny * overlap * (firstWeight / totalWeight);
  second.x += nx * overlap * (secondWeight / totalWeight);
  second.y += ny * overlap * (secondWeight / totalWeight);

  const relativeSpeed = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
  if (relativeSpeed >= 0) return;

  const impulse = -(1 + BOUNCE) * relativeSpeed / totalWeight;
  if (!first.dragging) {
    first.vx -= impulse * nx;
    first.vy -= impulse * ny;
  }
  if (!second.dragging) {
    second.vx += impulse * nx;
    second.vy += impulse * ny;
  }
}

function containBall(ball, width, height) {
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    if (ball.vx < 0) ball.vx = Math.abs(ball.vx) * BOUNCE;
  } else if (ball.x + ball.radius > width) {
    ball.x = width - ball.radius;
    if (ball.vx > 0) ball.vx = -Math.abs(ball.vx) * BOUNCE;
  }

  if (ball.y + ball.radius > height) {
    ball.y = height - ball.radius;
    if (ball.vy > 0) ball.vy = -Math.abs(ball.vy) * BOUNCE;
    ball.vx *= 0.94;
    ball.angularVelocity *= 0.78;
    if (Math.abs(ball.vy) < 24) ball.vy = 0;
  }
}

let previousTime = performance.now();
function animate(currentTime) {
  const elapsed = Math.min((currentTime - previousTime) / 1000, 0.025);
  previousTime = currentTime;
  const width = stage.clientWidth;
  const height = stage.clientHeight;

  balls.forEach((ball) => {
    if (!ball.dragging) {
      if (!ball.hasEntered && ball.y - ball.radius >= 0) ball.hasEntered = true;
      ball.vy += (ball.hasEntered ? SETTLED_GRAVITY : ENTRY_GRAVITY) * elapsed;
      ball.x += ball.vx * elapsed;
      ball.y += ball.vy * elapsed;
      ball.angularVelocity *= Math.exp(-ROTATIONAL_FRICTION * elapsed);
      ball.angularVelocity = Math.max(-MAX_ANGULAR_SPEED, Math.min(MAX_ANGULAR_SPEED, ball.angularVelocity));
      ball.angle += ball.angularVelocity * elapsed;

      containBall(ball, width, height);
    }
  });

  for (let first = 0; first < balls.length; first += 1) {
    for (let second = first + 1; second < balls.length; second += 1) {
      resolveBallCollision(balls[first], balls[second]);
    }
  }

  balls.forEach((ball) => {
    containBall(ball, width, height);
    ball.element.style.transform = `translate3d(${ball.x - ball.radius}px, ${ball.y - ball.radius}px, 0)`;
    ball.element.style.setProperty("--angle", `${ball.angle}deg`);
  });

  requestAnimationFrame(animate);
}

const bundledPhotos = (window.PHOTOS || []).map((name) => ({
  url: `members/${name.split("/").map(encodeURIComponent).join("/")}`,
  name,
}));

if (bundledPhotos.length) showPhotos(bundledPhotos);
new ResizeObserver(resizeBalls).observe(stage);
requestAnimationFrame(animate);
