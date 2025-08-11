
function initTrafficAnimation(type, simData) {
  const canvas = document.getElementById('trafficAnimation');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const verdeDur = (simData?.verde ?? 30) * 1000;
  const amarilloDur = (simData?.amarillo ?? 5) * 1000;
  const rojoDur = (simData?.rojo ?? 60) * 1000;

  const cicloDur = verdeDur + amarilloDur + rojoDur;

  ctx.clearRect(0, 0, W, H);

  const carWidth = 30;
  const carHeight = 15;
  const speedBase = 1.5;
  const colors = ['#4f46e5', '#0b80ee', '#e59e0b', '#10b981'];

  let cars = [];
  let startTime = null;

  const stopZones = {
    right: W / 2 - 80,
    left: W / 2 + 50,
    up: H / 2 + 50,
    down: H / 2 - 80,
    'up-left': { x: W / 2 + 50, y: H / 2 + 50 }
  };

  // Inicializa coches según tipo con posiciones, dirección, velocidad, y estado
  function setupCars() {
    cars = [];
    if (type === 't') {
      cars.push({ x: -carWidth, y: H / 2 - 20, dir: 'right', speed: speedBase, stopped: false });
      cars.push({ x: W / 2 - 10, y: H + carHeight, dir: 'up', speed: speedBase * 1.2, stopped: false });
      cars.push({ x: W + carWidth, y: H / 2 + 20, dir: 'left', speed: speedBase * 0.9, stopped: false });
    } else if (type === 'cruce') {
      cars.push({ x: -carWidth, y: H / 2 - 20, dir: 'right', speed: speedBase, stopped: false });
      cars.push({ x: W + carWidth, y: H / 2 + 20, dir: 'left', speed: speedBase * 0.8, stopped: false });
      cars.push({ x: W / 2 - 10, y: -carHeight, dir: 'down', speed: speedBase * 1.1, stopped: false });
      cars.push({ x: W / 2 + 10, y: H + carHeight, dir: 'up', speed: speedBase, stopped: false });
    } else if (type === 'y') {
      cars.push({ x: -carWidth, y: H / 2 - 10, dir: 'right', speed: speedBase, stopped: false });
      cars.push({ x: W + carWidth, y: H / 2 + 15, dir: 'left', speed: speedBase * 0.9, stopped: false });
      cars.push({ x: W / 2, y: H + carHeight, dir: 'up-left', speed: speedBase * 1.2, stopped: false });
    } else if (type === 'rotonda') {
      for (let i = 0; i < 6; i++) {
        cars.push({ angle: (i * 60) * Math.PI / 180, speed: 0.02 + i * 0.001 });
      }
    }
  }

  // Función para dibujar coche con ruedas
  function drawCar(x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, carWidth, carHeight, 4);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x + 5, y + carHeight, 4, 0, 2 * Math.PI);
    ctx.arc(x + carWidth - 5, y + carHeight, 4, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Polyfill para roundRect si no está
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    }
  }

  // Dibuja intersección (igual que antes)
  function drawIntersection() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#dbe1e6';
    ctx.fillRect(W / 2 - 100, H / 2 - 60, 200, 120);

    ctx.strokeStyle = '#7e858c';
    ctx.lineWidth = 14;

    if (type === 't') {
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
    } else if (type === 'cruce') {
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
    } else if (type === 'y') {
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(W, 0);
      ctx.stroke();
    } else if (type === 'rotonda') {
      ctx.beginPath();
      ctx.fillStyle = '#7e858c';
      ctx.arc(W / 2, H / 2, 50, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#dbe1e6';
      ctx.lineWidth = 12;
      for (let i = 0; i < 4; i++) {
        const angle = i * (Math.PI / 2);
        const x1 = W / 2 + Math.cos(angle) * 80;
        const y1 = H / 2 + Math.sin(angle) * 80;
        const x2 = W / 2 + Math.cos(angle) * 120;
        const y2 = H / 2 + Math.sin(angle) * 120;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }

  // Determina si el auto debe detenerse según posición y semáforo actual
  function shouldStop(car, currentPhase) {
    // Rojo = detenerse antes de la intersección
    if (type === 'rotonda') {
      // En rotonda no hay semáforo, siempre en movimiento
      return false;
    }

    // Para los demás, si semáforo rojo o amarillo => parar
    if (currentPhase === 'rojo') return true;
    if (currentPhase === 'amarillo') {
      // Opcional: si está cerca del stop, empieza a detenerse (puedes refinar)
      return true;
    }
    // Verde = avanzar
    return false;
  }

  // Mueve coches si no están detenidos, con control de stopZone para no pasarse del semáforo rojo
  function updateCars(currentPhase) {
    cars.forEach(car => {
      if (type === 'rotonda') {
        car.angle += car.speed;
        if (car.angle > 2 * Math.PI) car.angle -= 2 * Math.PI;
        return;
      }

      // Determinar si debe detenerse
      car.stopped = shouldStop(car, currentPhase);

      // Lógica de movimiento según dirección y parada
      switch (car.dir) {
        case 'right':
          if (!car.stopped || car.x > stopZones.right) {
            car.x += car.speed;
            if (car.x > W + carWidth) car.x = -carWidth;
          }
          break;
        case 'left':
          if (!car.stopped || car.x < stopZones.left) {
            car.x -= car.speed;
            if (car.x < -carWidth) car.x = W + carWidth;
          }
          break;
        case 'up':
          if (!car.stopped || car.y < stopZones.up) {
            car.y -= car.speed;
            if (car.y < -carHeight) car.y = H + carHeight;
          }
          break;
        case 'down':
          if (!car.stopped || car.y > stopZones.down) {
            car.y += car.speed;
            if (car.y > H + carHeight) car.y = -carHeight;
          }
          break;
        case 'up-left':
          if (!car.stopped || (car.x < stopZones['up-left'].x && car.y < stopZones['up-left'].y)) {
            car.x -= car.speed;
            car.y -= car.speed;
            if (car.x < -carWidth || car.y < -carHeight) {
              car.x = W + carWidth;
              car.y = H + carHeight;
            }
          }
          break;
      }
    });
  }

  function drawCars() {
    cars.forEach((car, i) => {
      ctx.fillStyle = colors[i % colors.length];
      if (type === 'rotonda') {
        const r = 50;
        const cx = W / 2 + Math.cos(car.angle) * r - carWidth / 2;
        const cy = H / 2 + Math.sin(car.angle) * r - carHeight / 2;
        drawCar(cx, cy, ctx.fillStyle);
      } else {
        drawCar(car.x, car.y, ctx.fillStyle);
      }
    });
  }

  // Dibuja semáforo (solo colores) arriba a la derecha, cambia según fase actual
  function drawTrafficLight(phase) {
    const x = W - 80;
    const y = 20;
    const radius = 12;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#333';

    // Caja del semáforo
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 10, y - 10, 50, 130);
    ctx.strokeRect(x - 10, y - 10, 50, 130);

    // Rojito
    ctx.beginPath();
    ctx.fillStyle = phase === 'rojo' ? '#ff4c4c' : '#611515';
    ctx.arc(x + 15, y + 20, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Amarillo
    ctx.beginPath();
    ctx.fillStyle = phase === 'amarillo' ? '#ffea00' : '#666600';
    ctx.arc(x + 15, y + 70, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Verde
    ctx.beginPath();
    ctx.fillStyle = phase === 'verde' ? '#16c60c' : '#144b0f';
    ctx.arc(x + 15, y + 120, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  // Función principal de animación con ciclo de semáforo
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime) % cicloDur;

    // Definir fase actual según elapsed
    let currentPhase;
    if (elapsed < verdeDur) {
      currentPhase = 'verde';
    } else if (elapsed < verdeDur + amarilloDur) {
      currentPhase = 'amarillo';
    } else {
      currentPhase = 'rojo';
    }

    drawIntersection();
    drawTrafficLight(currentPhase);
    updateCars(currentPhase);
    drawCars();

    requestAnimationFrame(animate);
  }

  setupCars();
  requestAnimationFrame(animate);
}
