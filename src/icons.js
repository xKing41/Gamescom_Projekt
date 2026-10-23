// Alle Figuren von Hort werden im Code gezeichnet – keine Bilddateien, keine KI-Grafik.
// Jede Form ist in einem Kasten von -50 bis 50 entworfen und wird auf die Kachelgröße skaliert.

const GOLD = ['#fbe08a', '#e6b94f', '#a9781f', '#6e4a12'];
const TAU = Math.PI * 2;

function goldFill(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, GOLD[0]);
  g.addColorStop(0.45, GOLD[1]);
  g.addColorStop(1, GOLD[2]);
  return g;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function gem(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillRect(x - r * 0.35, y - r * 0.45, r * 0.3, r * 0.3);
}

function coin(ctx, x, y) {
  ctx.beginPath();
  ctx.ellipse(x, y + 2.6, 17, 7, 0, 0, TAU);
  ctx.fillStyle = GOLD[3];
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y, 17, 7, 0, 0, TAU);
  ctx.fillStyle = goldFill(ctx, y - 7, y + 7);
  ctx.fill();
  ctx.strokeStyle = GOLD[2];
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 4, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(110,74,18,.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function bar(ctx, x, y, w) {
  const h = 14;
  const top = w * 0.72;
  ctx.beginPath();
  ctx.moveTo(x - w, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + top, y - h / 2);
  ctx.lineTo(x - top, y - h / 2);
  ctx.closePath();
  ctx.fillStyle = goldFill(ctx, y - h / 2, y + h / 2);
  ctx.fill();
  ctx.strokeStyle = GOLD[3];
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - top + 3, y - h / 2 + 2.5);
  ctx.lineTo(x + top - 3, y - h / 2 + 2.5);
  ctx.strokeStyle = 'rgba(255,248,214,.8)';
  ctx.stroke();
}

function chalice(ctx, scale, gems) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = GOLD[3];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, -26);
  ctx.lineTo(22, -26);
  ctx.quadraticCurveTo(22, 2, 0, 4);
  ctx.quadraticCurveTo(-22, 2, -22, -26);
  ctx.closePath();
  ctx.fillStyle = goldFill(ctx, -26, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -26, 22, 5, 0, 0, TAU);
  ctx.fillStyle = '#7a5418';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = goldFill(ctx, 4, 24);
  ctx.fillRect(-4, 3, 8, 18);
  ctx.strokeRect(-4, 3, 8, 18);
  ctx.beginPath();
  ctx.ellipse(0, 12, 7, 3.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 25, 17, 6, 0, 0, TAU);
  ctx.fillStyle = goldFill(ctx, 19, 31);
  ctx.fill();
  ctx.stroke();
  if (gems) for (const [gx, gy] of [[-11, -14], [0, -8], [11, -14]]) gem(ctx, gx, gy, 4.5, '#e2384f');
  ctx.beginPath();
  ctx.moveTo(-14, -20);
  ctx.quadraticCurveTo(-13, -8, -5, -3);
  ctx.strokeStyle = 'rgba(255,248,214,.7)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

const RUBY = ['#ff8a96', '#d61f3c', '#6e0a1c', '#4a0612', 'rgba(255,200,210,.55)'];
const SAPPHIRE = ['#9cc8ff', '#2f6ee0', '#13306e', '#0b1d44', 'rgba(200,225,255,.55)'];

function faceted(ctx, colors = RUBY) {
  const g = ctx.createLinearGradient(-20, -20, 20, 24);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.5, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.beginPath();
  ctx.moveTo(-24, -6);
  ctx.lineTo(-12, -20);
  ctx.lineTo(12, -20);
  ctx.lineTo(24, -6);
  ctx.lineTo(0, 26);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = colors[3];
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-24, -6);
  ctx.lineTo(24, -6);
  ctx.moveTo(-12, -20);
  ctx.lineTo(-6, -6);
  ctx.lineTo(0, 26);
  ctx.moveTo(12, -20);
  ctx.lineTo(6, -6);
  ctx.lineTo(0, 26);
  ctx.strokeStyle = colors[4];
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-14, -14);
  ctx.lineTo(-8, -14);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function cube(ctx, x, y, s, light) {
  const faces = [
    [[x, y - s], [x + s, y - s / 2], [x, y], [x - s, y - s / 2], light ? '#f4e6a2' : '#d9c77e'],
    [[x - s, y - s / 2], [x, y], [x, y + s], [x - s, y + s / 2], '#b59f52'],
    [[x + s, y - s / 2], [x, y], [x, y + s], [x + s, y + s / 2], '#8a7637'],
  ];
  for (const [a, b, c, d, color] of faces) {
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.lineTo(...c);
    ctx.lineTo(...d);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#5e5022';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

function crown(ctx, scale, imperial) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = GOLD[3];
  ctx.lineWidth = 2;
  if (imperial) {
    ctx.beginPath();
    ctx.moveTo(-18, -2);
    ctx.quadraticCurveTo(0, -42, 18, -2);
    ctx.strokeStyle = GOLD[2];
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -34, 6, 0, TAU);
    ctx.fillStyle = goldFill(ctx, -40, -28);
    ctx.fill();
    ctx.strokeStyle = GOLD[3];
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = goldFill(ctx, -24, 20);
  ctx.beginPath();
  ctx.moveTo(-26, 16);
  ctx.lineTo(-27, -12);
  ctx.lineTo(-13, 2);
  ctx.lineTo(0, -20);
  ctx.lineTo(13, 2);
  ctx.lineTo(27, -12);
  ctx.lineTo(26, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, -28, 8, 56, 12, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = GOLD[0];
  for (const [x, y] of [[-27, -13], [0, -21], [27, -13]]) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  gem(ctx, -15, 14, 4, '#2f7de1');
  gem(ctx, 0, 14, 4.6, '#e2384f');
  gem(ctx, 15, 14, 4, '#2fbf71');
  ctx.restore();
}

const TREASURE_PAINTERS = {
  muenzen(ctx) {
    for (let i = 0; i < 5; i++) coin(ctx, 0, 2 - i * 5.5);
    for (let i = 0; i < 4; i++) coin(ctx, -17, 18 - i * 5.5);
    for (let i = 0; i < 3; i++) coin(ctx, 17, 20 - i * 5.5);
  },
  barren(ctx) {
    bar(ctx, 0, 16, 30);
    bar(ctx, -2, 1, 26);
    bar(ctx, 1, -14, 22);
  },
  statue(ctx) {
    ctx.fillStyle = '#5b4a3c';
    roundRect(ctx, -26, 24, 52, 14, 3);
    ctx.fill();
    ctx.fillStyle = goldFill(ctx, -40, 26);
    ctx.strokeStyle = GOLD[3];
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 8, -6);
      ctx.lineTo(side * 34, -30);
      ctx.lineTo(side * 26, 0);
      ctx.lineTo(side * 14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 6, 15, 19, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -19, 10, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6e1a10';
    ctx.beginPath();
    ctx.arc(-3.5, -20, 1.8, 0, TAU);
    ctx.arc(3.5, -20, 1.8, 0, TAU);
    ctx.fill();
  },
  kelch(ctx) {
    chalice(ctx, 1, false);
  },
  prunkkelch(ctx) {
    chalice(ctx, 1.12, true);
  },
  thron(ctx) {
    ctx.strokeStyle = GOLD[3];
    ctx.lineWidth = 2.2;
    ctx.fillStyle = goldFill(ctx, -44, 0);
    ctx.beginPath();
    ctx.moveTo(-20, 4);
    ctx.lineTo(-20, -24);
    ctx.quadraticCurveTo(0, -46, 20, -24);
    ctx.lineTo(20, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#9e2236';
    ctx.beginPath();
    ctx.moveTo(-13, 2);
    ctx.lineTo(-13, -21);
    ctx.quadraticCurveTo(0, -36, 13, -21);
    ctx.lineTo(13, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = goldFill(ctx, 2, 32);
    roundRect(ctx, -26, 2, 52, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-24, 14, 7, 18);
    ctx.strokeRect(-24, 14, 7, 18);
    ctx.fillRect(17, 14, 7, 18);
    ctx.strokeRect(17, 14, 7, 18);
    gem(ctx, 0, -33, 5, '#e2384f');
  },
  rubin(ctx) {
    faceted(ctx);
  },
  rubinherz(ctx) {
    const g = ctx.createLinearGradient(-24, -24, 24, 28);
    g.addColorStop(0, '#ff8a96');
    g.addColorStop(0.5, '#d61f3c');
    g.addColorStop(1, '#6e0a1c');
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.bezierCurveTo(-34, 4, -30, -26, -12, -26);
    ctx.bezierCurveTo(-4, -26, 0, -18, 0, -14);
    ctx.bezierCurveTo(0, -18, 4, -26, 12, -26);
    ctx.bezierCurveTo(30, -26, 34, 4, 0, 28);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#4a0612';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 28);
    ctx.moveTo(-22, -8);
    ctx.lineTo(0, 6);
    ctx.lineTo(22, -8);
    ctx.strokeStyle = 'rgba(255,200,210,.5)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, -16);
    ctx.lineTo(-11, -19);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  },
  katzengold(ctx) {
    cube(ctx, -10, 8, 14);
    cube(ctx, 13, 12, 11);
    cube(ctx, 2, -6, 12, true);
  },
  narrengold(ctx) {
    cube(ctx, -17, 10, 13);
    cube(ctx, 16, 12, 13);
    cube(ctx, 0, 16, 12);
    cube(ctx, -7, -6, 12, true);
    cube(ctx, 10, -10, 11, true);
  },
  mimik(ctx, time) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3a200e';
    ctx.fillStyle = '#7b4a28';
    roundRect(ctx, -28, -2, 56, 26, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8a5531';
    ctx.beginPath();
    ctx.moveTo(-28, -4);
    ctx.lineTo(-28, -12);
    ctx.quadraticCurveTo(0, -32, 28, -12);
    ctx.lineTo(28, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f3ead8';
    for (let x = -24; x < 24; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, -4);
      ctx.lineTo(x + 4, 4);
      ctx.lineTo(x + 8, -4);
      ctx.fill();
    }
    ctx.strokeStyle = '#3a3a46';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-16, -21);
    ctx.lineTo(-16, 24);
    ctx.moveTo(16, -21);
    ctx.lineTo(16, 24);
    ctx.stroke();
    const open = Math.sin(time * 0.9) > 0.96 ? 0.15 : 1;
    for (const ex of [-8, 8]) {
      ctx.beginPath();
      ctx.ellipse(ex, -14, 4.5, 3.4 * open, 0, 0, TAU);
      ctx.fillStyle = '#ffd34d';
      ctx.fill();
      ctx.fillStyle = '#1b0e05';
      ctx.fillRect(ex - 0.9, -14 - 3 * open, 1.8, 6 * open);
    }
  },
  reliquie(ctx) {
    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
    aura.addColorStop(0, 'rgba(255,233,168,.35)');
    aura.addColorStop(1, 'rgba(255,233,168,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = GOLD[3];
    ctx.lineWidth = 2;
    ctx.fillStyle = goldFill(ctx, -30, 26);
    ctx.beginPath();
    ctx.moveTo(-25, -8);
    ctx.lineTo(0, -30);
    ctx.lineTo(25, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-20, -8, 40, 28);
    ctx.strokeRect(-20, -8, 40, 28);
    ctx.fillRect(-24, 20, 48, 6);
    ctx.strokeRect(-24, 20, 48, 6);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(-7, 16);
    ctx.lineTo(-7, 2);
    ctx.arc(0, 2, 7, Math.PI, 0);
    ctx.lineTo(7, 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -31, 3, 0, TAU);
    ctx.fillStyle = GOLD[0];
    ctx.fill();
  },
  schild(ctx) {
    const g = ctx.createLinearGradient(-24, -30, 24, 32);
    g.addColorStop(0, '#eef1f6');
    g.addColorStop(0.55, '#9aa3b5');
    g.addColorStop(1, '#5f677a');
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(22, -30, 26, -22);
    ctx.lineTo(24, 0);
    ctx.quadraticCurveTo(18, 22, 0, 32);
    ctx.quadraticCurveTo(-18, 22, -24, 0);
    ctx.lineTo(-26, -22);
    ctx.quadraticCurveTo(-22, -30, 0, -30);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#3d4352';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -2, 7, 0, TAU);
    ctx.fillStyle = GOLD[1];
    ctx.fill();
    ctx.strokeStyle = GOLD[1];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.moveTo(Math.cos(a) * 10, -2 + Math.sin(a) * 10);
      ctx.lineTo(Math.cos(a) * 15, -2 + Math.sin(a) * 15);
    }
    ctx.stroke();
  },
  dolch(ctx) {
    ctx.rotate(-Math.PI / 4);
    const g = ctx.createLinearGradient(-6, 0, 6, 0);
    g.addColorStop(0, '#e8ecf2');
    g.addColorStop(1, '#8d95a6');
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(6, -6);
    ctx.lineTo(6, 4);
    ctx.lineTo(-6, 4);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#3d4352';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = GOLD[1];
    ctx.fillRect(-14, 4, 28, 5);
    ctx.fillStyle = '#3b2a20';
    ctx.fillRect(-3.5, 9, 7, 18);
    ctx.beginPath();
    ctx.arc(0, 30, 5, 0, TAU);
    ctx.fillStyle = GOLD[1];
    ctx.fill();
  },
  hacke(ctx) {
    ctx.rotate(-0.5);
    ctx.fillStyle = '#8a5a33';
    ctx.strokeStyle = '#3e2410';
    ctx.lineWidth = 2;
    ctx.fillRect(-3, -18, 6, 52);
    ctx.strokeRect(-3, -18, 6, 52);
    ctx.beginPath();
    ctx.moveTo(-32, -12);
    ctx.quadraticCurveTo(0, -36, 32, -12);
    ctx.lineTo(27, -8);
    ctx.quadraticCurveTo(0, -26, -27, -8);
    ctx.closePath();
    ctx.fillStyle = '#9aa0ad';
    ctx.fill();
    ctx.strokeStyle = '#3a3f4a';
    ctx.stroke();
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(-6, -24, 12, 10);
  },
  mistgabel(ctx) {
    ctx.rotate(0.35);
    ctx.fillStyle = '#8a5a33';
    ctx.fillRect(-2.5, -6, 5, 46);
    ctx.strokeStyle = '#8f96a3';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.quadraticCurveTo(0, 2, 13, -4);
    for (const x of [-12, 0, 12]) {
      ctx.moveTo(x, x ? -5 : -2);
      ctx.lineTo(x, -38);
    }
    ctx.stroke();
  },
  krone(ctx) {
    crown(ctx, 1, false);
  },
  kaiserkrone(ctx) {
    crown(ctx, 1.1, true);
  },
  saphir(ctx) {
    faceted(ctx, SAPPHIRE);
  },
  saphirauge(ctx) {
    const g = ctx.createRadialGradient(-8, -10, 3, 0, 0, 30);
    g.addColorStop(0, '#cfe4ff');
    g.addColorStop(0.45, '#2f6ee0');
    g.addColorStop(1, '#0b1d44');
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 22, 0, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = GOLD[2];
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 15, 0, 0, TAU);
    ctx.fillStyle = '#071027';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-11, -9, 5, 3, -0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fill();
  },
  narrenkrone(ctx) {
    const colors = ['#8e3fd0', '#2fae6a', '#d0453f'];
    for (let i = 0; i < 3; i++) {
      const x = -20 + i * 20;
      ctx.beginPath();
      ctx.moveTo(x - 9, 8);
      ctx.quadraticCurveTo(x - 16 + i * 8, -26, x + (i - 1) * 14, -30 + Math.abs(i - 1) * 6);
      ctx.quadraticCurveTo(x + 2, -10, x + 9, 8);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.strokeStyle = '#2a1430';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + (i - 1) * 14, -30 + Math.abs(i - 1) * 6, 5, 0, TAU);
      ctx.fillStyle = goldFill(ctx, -36, -20);
      ctx.fill();
      ctx.strokeStyle = GOLD[3];
      ctx.stroke();
    }
    ctx.fillStyle = goldFill(ctx, 6, 22);
    roundRect(ctx, -30, 6, 60, 14, 4);
    ctx.fill();
    ctx.strokeStyle = GOLD[3];
    ctx.stroke();
    gem(ctx, -16, 13, 4, '#ffd34d');
    gem(ctx, 0, 13, 4, '#ff6ad5');
    gem(ctx, 16, 13, 4, '#6ad5ff');
  },
  baerenfalle(ctx) {
    // Offene Falle von vorn: zwei Bügel mit Zähnen, Federn an den Enden, Kette zum Pflock
    ctx.strokeStyle = '#6b7080';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(34, 18);
    ctx.quadraticCurveTo(40, 26, 32, 32);
    ctx.stroke();
    ctx.fillStyle = '#4a4f5a';
    ctx.fillRect(27, 30, 9, 4);
    ctx.fillStyle = '#2b2e36';
    roundRect(ctx, -36, 14, 72, 7, 3);
    ctx.fill();
    for (const side of [-1, 1]) {
      const cx = side * 16;
      ctx.beginPath();
      ctx.arc(cx, 17, 15, Math.PI, 0);
      ctx.strokeStyle = '#b4bac6';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.fillStyle = '#eef0f4';
      for (let k = 1; k < 6; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        const x = cx + Math.cos(a) * 15;
        const y = 17 + Math.sin(a) * 15;
        const ix = cx + Math.cos(a) * 8;
        const iy = 17 + Math.sin(a) * 8;
        ctx.beginPath();
        ctx.moveTo(x + Math.sin(a) * 2.6, y - Math.cos(a) * 2.6);
        ctx.lineTo(ix, iy);
        ctx.lineTo(x - Math.sin(a) * 2.6, y + Math.cos(a) * 2.6);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(side * 37, 17, 4, 7, 0, 0, TAU);
      ctx.strokeStyle = '#8f96a3';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = '#7a808c';
    roundRect(ctx, -7, 10, 14, 5, 2);
    ctx.fill();
  },
  glocke(ctx) {
    const g = ctx.createLinearGradient(-22, 0, 22, 0);
    g.addColorStop(0, '#8b93a4');
    g.addColorStop(0.4, '#f2f4f8');
    g.addColorStop(1, '#7a8294');
    ctx.beginPath();
    ctx.moveTo(-6, -28);
    ctx.quadraticCurveTo(-20, -24, -20, -2);
    ctx.quadraticCurveTo(-22, 14, -30, 20);
    ctx.lineTo(30, 20);
    ctx.quadraticCurveTo(22, 14, 20, -2);
    ctx.quadraticCurveTo(20, -24, 6, -28);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#3d4352';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -31, 5, 0, TAU);
    ctx.strokeStyle = '#8b93a4';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 25, 6, 0, TAU);
    ctx.fillStyle = '#5f677a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,185,79,.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.lineTo(16, 8);
    ctx.stroke();
  },
  bannstein(ctx, time) {
    ctx.beginPath();
    ctx.moveTo(-18, 28);
    ctx.lineTo(-22, -16);
    ctx.quadraticCurveTo(-18, -32, 0, -33);
    ctx.quadraticCurveTo(18, -32, 22, -16);
    ctx.lineTo(18, 28);
    ctx.closePath();
    const g = ctx.createLinearGradient(-20, -30, 20, 28);
    g.addColorStop(0, '#9a96a2');
    g.addColorStop(1, '#4c4855');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#2b2830';
    ctx.lineWidth = 2;
    ctx.stroke();
    const glow = 0.6 + 0.4 * Math.sin(time * 2);
    ctx.strokeStyle = `rgba(120,200,255,${glow})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, 16);
    ctx.moveTo(-9, -12);
    ctx.lineTo(9, 0);
    ctx.moveTo(9, -12);
    ctx.lineTo(-9, 0);
    ctx.moveTo(-8, 16);
    ctx.lineTo(8, 16);
    ctx.stroke();
  },
  steinwaechter(ctx) {
    ctx.fillStyle = '#4a4650';
    roundRect(ctx, -26, 22, 52, 14, 3);
    ctx.fill();
    const g = ctx.createLinearGradient(-20, -40, 20, 24);
    g.addColorStop(0, '#a8a4ae');
    g.addColorStop(1, '#5a5662');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#2b2830';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 22);
    ctx.lineTo(-18, -6);
    ctx.lineTo(-10, -14);
    ctx.lineTo(10, -14);
    ctx.lineTo(18, -6);
    ctx.lineTo(16, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -24, 11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(-6, -26, 4, 3);
    ctx.fillRect(2, -26, 4, 3);
    ctx.strokeStyle = '#d5d8de';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 18);
    ctx.lineTo(28, -32);
    ctx.stroke();
    ctx.fillStyle = 'rgba(110,150,90,.6)';
    ctx.beginPath();
    ctx.arc(-12, 18, 5, 0, TAU);
    ctx.arc(10, -10, 4, 0, TAU);
    ctx.fill();
  },
  stab(ctx, time) {
    ctx.rotate(0.5);
    ctx.fillStyle = '#6b4424';
    ctx.strokeStyle = '#2e1a0c';
    ctx.lineWidth = 2;
    ctx.fillRect(-3, -22, 6, 56);
    ctx.strokeRect(-3, -22, 6, 56);
    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(-14, -30, -8, -40);
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(14, -30, 8, -40);
    ctx.stroke();
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    const g = ctx.createRadialGradient(0, -34, 1, 0, -34, 16);
    g.addColorStop(0, `rgba(240,200,255,${pulse})`);
    g.addColorStop(0.5, 'rgba(160,90,255,.7)');
    g.addColorStop(1, 'rgba(160,90,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -34, 16, 0, TAU);
    ctx.fill();
  },
  ei(ctx, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
    const glow = ctx.createRadialGradient(0, 2, 6, 0, 2, 44);
    glow.addColorStop(0, `rgba(110,230,205,${0.28 + 0.14 * pulse})`);
    glow.addColorStop(1, 'rgba(110,230,205,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 2, 44, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(-8, -12, 3, 0, 4, 34);
    g.addColorStop(0, '#a9f3e0');
    g.addColorStop(0.5, '#2f9c8a');
    g.addColorStop(1, '#145a52');
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.bezierCurveTo(18, -30, 24, -2, 22, 10);
    ctx.bezierCurveTo(20, 26, 10, 32, 0, 32);
    ctx.bezierCurveTo(-10, 32, -20, 26, -22, 10);
    ctx.bezierCurveTo(-24, -2, -18, -30, 0, -30);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#0d3b36';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = GOLD[1];
    for (const [x, y, r] of [[-8, -6, 3], [9, 2, 2.6], [-3, 15, 2.2], [10, -14, 2], [-13, 10, 1.8], [5, 22, 1.6]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(-9, -15, 3.5, 7, 0.35, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fill();
  },
};

export function drawTreasure(ctx, id, x, y, size, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  (TREASURE_PAINTERS[id] ?? TREASURE_PAINTERS.muenzen)(ctx, time);
  ctx.restore();
}

// Kleiner vierzackiger Funkelstern für den Glanz
export function drawSparkle(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

// ── Helden ──────────────────────────────────────────────────────

function head(ctx, skin = '#d9a57e') {
  ctx.beginPath();
  ctx.arc(0, -16, 11, 0, TAU);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.strokeStyle = '#3a2416';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function body(ctx, color, wide = 16) {
  ctx.beginPath();
  ctx.moveTo(-wide, 28);
  ctx.lineTo(wide, 28);
  ctx.lineTo(wide * 0.66, -6);
  ctx.lineTo(-wide * 0.66, -6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#1d1512';
  ctx.lineWidth = 2;
  ctx.stroke();
}

const HERO_PAINTERS = {
  dieb(ctx) {
    body(ctx, '#2f4a40');
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-11, 8, 22, 4);
    head(ctx);
    ctx.fillStyle = '#22362f';
    ctx.beginPath();
    ctx.moveTo(-15, -8);
    ctx.quadraticCurveTo(-16, -36, 0, -35);
    ctx.quadraticCurveTo(16, -36, 15, -8);
    ctx.lineTo(10, -8);
    ctx.quadraticCurveTo(0, -30, -10, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#14201c';
    ctx.fillRect(-11, -20, 22, 6);
    ctx.fillStyle = '#e8f0e8';
    ctx.fillRect(-6, -18.5, 3, 2.5);
    ctx.fillRect(3, -18.5, 3, 2.5);
  },
  bauer(ctx) {
    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 30);
    ctx.lineTo(24, -30);
    ctx.stroke();
    ctx.strokeStyle = '#9aa0ad';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (const dx of [-4, 0, 4]) {
      ctx.moveTo(24 + dx, -28);
      ctx.lineTo(24 + dx, -40);
    }
    ctx.stroke();
    body(ctx, '#8a6a3c');
    head(ctx, '#e0b08a');
    ctx.fillStyle = '#d6b25e';
    ctx.beginPath();
    ctx.ellipse(0, -24, 20, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-9, -34, 18, 10);
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-9, -34, 18, 10);
  },
  paladin(ctx) {
    body(ctx, '#c9ced9', 18);
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(-7, -4, 14, 30);
    ctx.fillStyle = '#e6b94f';
    ctx.beginPath();
    ctx.arc(0, 8, 4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -16, 12, 0, TAU);
    ctx.fillStyle = '#d5dae3';
    ctx.fill();
    ctx.strokeStyle = '#4a5060';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#2a2f3a';
    ctx.fillRect(-8, -18, 16, 3);
    ctx.strokeStyle = '#b3263a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -26, 8, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.save();
    ctx.translate(-18, 10);
    ctx.scale(0.42, 0.42);
    TREASURE_PAINTERS.schild(ctx);
    ctx.restore();
  },
  zwerg(ctx) {
    ctx.save();
    ctx.translate(0, 4);
    ctx.scale(0.95, 0.88);
    body(ctx, '#7a5232', 19);
    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 18);
    ctx.lineTo(-26, -14);
    ctx.stroke();
    ctx.fillStyle = '#9aa0ad';
    ctx.beginPath();
    ctx.moveTo(-36, -10);
    ctx.quadraticCurveTo(-26, -22, -16, -18);
    ctx.lineTo(-18, -14);
    ctx.quadraticCurveTo(-26, -16, -34, -6);
    ctx.closePath();
    ctx.fill();
    head(ctx, '#e3b48c');
    ctx.fillStyle = '#c4602b';
    ctx.beginPath();
    ctx.moveTo(-11, -14);
    ctx.quadraticCurveTo(-12, 6, 0, 12);
    ctx.quadraticCurveTo(12, 6, 11, -14);
    ctx.quadraticCurveTo(0, -8, -11, -14);
    ctx.fill();
    ctx.fillStyle = '#8e939e';
    ctx.beginPath();
    ctx.arc(0, -19, 12, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-14, -21, 28, 4);
    ctx.restore();
  },
};

HERO_PAINTERS.soeldner = (ctx) => {
  ctx.strokeStyle = '#c9ced9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, 24);
  ctx.lineTo(24, -10);
  ctx.stroke();
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(16, 10, 10, 3);
  body(ctx, '#6e4a38', 18);
  ctx.fillStyle = '#3a2a20';
  ctx.fillRect(-12, 6, 24, 5);
  ctx.fillStyle = '#e6b94f';
  ctx.fillRect(-3, 6, 6, 5);
  head(ctx, '#d4a07a');
  ctx.fillStyle = '#8e939e';
  ctx.beginPath();
  ctx.ellipse(0, -24, 19, 5, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -24, 11, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#4a5060';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = '#7a2a20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.lineTo(-2, -8);
  ctx.stroke();
};

HERO_PAINTERS.magier = (ctx) => {
  ctx.strokeStyle = '#6b4424';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, 30);
  ctx.lineTo(-24, -24);
  ctx.stroke();
  ctx.fillStyle = '#c8a0ff';
  ctx.beginPath();
  ctx.arc(-24, -27, 5, 0, TAU);
  ctx.fill();
  body(ctx, '#3a2f6e', 18);
  ctx.fillStyle = '#ffe9a8';
  for (const [x, y] of [[-6, 4], [7, 12], [-2, 20], [9, -1]]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, TAU);
    ctx.fill();
  }
  head(ctx, '#e0b896');
  ctx.fillStyle = '#d8d0c4';
  ctx.beginPath();
  ctx.moveTo(-8, -12);
  ctx.quadraticCurveTo(0, 6, 8, -12);
  ctx.fill();
  ctx.fillStyle = '#3a2f6e';
  ctx.beginPath();
  ctx.moveTo(-16, -22);
  ctx.lineTo(16, -22);
  ctx.lineTo(4, -48);
  ctx.quadraticCurveTo(0, -42, -2, -40);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1c1638';
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

// Knochenwächter des Knochendrachen
export function drawGuardian(ctx, x, y, size, time, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.globalAlpha = alpha;
  const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
  aura.addColorStop(0, `rgba(160,255,120,${0.18 + 0.08 * Math.sin(time * 3)})`);
  aura.addColorStop(1, 'rgba(160,255,120,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#ece6d6';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 16);
  ctx.moveTo(0, 16);
  ctx.lineTo(-8, 30);
  ctx.moveTo(0, 16);
  ctx.lineTo(8, 30);
  ctx.moveTo(0, -2);
  ctx.lineTo(-14, 10);
  ctx.moveTo(0, -2);
  ctx.lineTo(16, -14);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 1 + i * 5, 9 - i, 2.5, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.strokeStyle = '#b9bec8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(16, -14);
  ctx.lineTo(26, -36);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -16, 11, 0, TAU);
  ctx.fillStyle = '#ece6d6';
  ctx.fill();
  ctx.fillStyle = '#1a1714';
  ctx.beginPath();
  ctx.arc(-4, -17, 3, 0, TAU);
  ctx.arc(4, -17, 3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b6ff8a';
  ctx.beginPath();
  ctx.arc(-4, -17, 1.3, 0, TAU);
  ctx.arc(4, -17, 1.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawHero(ctx, type, x, y, size, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(0, 30, 20, 7, 0, 0, TAU);
  ctx.fill();
  (HERO_PAINTERS[type] ?? HERO_PAINTERS.dieb)(ctx);
  if (opts.hit > 0) {
    ctx.globalAlpha = Math.min(0.75, opts.hit * 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 34, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ── Drache ──────────────────────────────────────────────────────

// Bronze-Drache, falls keine Farben übergeben werden
const DEFAULT_PALETTE = {
  body: ['#c08a4a', '#7b4a24', '#3e2413'],
  wing: ['#6a3326', '#2d1512', '#80452c', '#9a5a36'],
  head: ['#a87040', '#5d361b'],
  horn: '#e8dcc0',
  eye: '#ffb347',
};

function wing(ctx, side, spread, flap, pal) {
  ctx.save();
  ctx.scale(side, 1);
  ctx.translate(58, -38);
  ctx.rotate(-flap);
  const span = 150 + spread * 130;
  const lift = 18 + spread * 40;
  const tip = { x: span, y: -lift };
  const edge = [
    { x: span * 0.86, y: 28 },
    { x: span * 0.62, y: 14 },
    { x: span * 0.4, y: 40 },
    { x: span * 0.16, y: 28 },
  ];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(span * 0.5, -lift * 1.4, tip.x, tip.y);
  let prev = tip;
  for (const p of edge) {
    ctx.quadraticCurveTo((prev.x + p.x) / 2, (prev.y + p.y) / 2 - 18, p.x, p.y);
    prev = p;
  }
  ctx.quadraticCurveTo(6, 22, 0, 12);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -lift, 0, 40);
  g.addColorStop(0, pal.wing[0]);
  g.addColorStop(1, pal.wing[1]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = pal.wing[2];
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = pal.wing[3];
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(tip.x, tip.y);
  const knuckle = { x: span * 0.36, y: -lift * 0.6 };
  for (const p of edge) {
    ctx.moveTo(knuckle.x, knuckle.y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

// Feste Stellen für die Narben der Legende, damit sie nicht springen
const SCARS = [[-60, -40, 0.6], [40, -50, -0.5], [-20, -10, 0.9], [70, -12, 0.3], [-85, -15, -0.7], [10, -58, 0.2], [-40, 8, -0.4], [55, 10, 0.8], [-70, -55, 0.1], [85, -40, -0.9]];

// o.awake: Augen offen · o.spread: Flügel 0–1 · o.mouth: Glut im Maul 0–1 · o.shake: Kopfschütteln 0–1
// o.palette: Farben der Drachenart · o.scars: Narben der Legende (0–10)
export function drawDragon(ctx, x, y, tile, time, o = {}) {
  const pal = o.palette ?? DEFAULT_PALETTE;
  const breathe = 1 + Math.sin(time * 1.4) * 0.015;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(tile / 100, tile / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Schwanz
  ctx.strokeStyle = pal.body[2];
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(70, -20);
  ctx.bezierCurveTo(170, -30, 220, -70, 290, -48);
  ctx.stroke();
  ctx.strokeStyle = pal.body[1];
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = pal.body[2];
  ctx.beginPath();
  ctx.moveTo(280, -62);
  ctx.lineTo(322, -44);
  ctx.lineTo(282, -30);
  ctx.closePath();
  ctx.fill();

  const flap = Math.sin(time * 1.1) * 0.03;
  const spread = o.spread ?? 0.3;
  wing(ctx, -1, spread, flap, pal);
  wing(ctx, 1, spread, flap, pal);

  // Körper
  ctx.save();
  ctx.scale(breathe, breathe);
  const g = ctx.createRadialGradient(-30, -50, 10, 0, -20, 130);
  g.addColorStop(0, pal.body[0]);
  g.addColorStop(0.55, pal.body[1]);
  g.addColorStop(1, pal.body[2]);
  ctx.beginPath();
  ctx.ellipse(0, -22, 115, 64, 0, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,5,.75)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,235,200,.14)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const yy = -64 + row * 18;
    for (let xx = -96 + (row % 2) * 11; xx <= 96; xx += 22) {
      if ((xx / 115) ** 2 + ((yy + 22) / 64) ** 2 > 0.8) continue;
      ctx.beginPath();
      ctx.arc(xx, yy, 9, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  const scars = Math.min(o.scars ?? 0, SCARS.length);
  ctx.strokeStyle = 'rgba(255,235,220,.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < scars; i++) {
    const [sx, sy, a] = SCARS[i];
    ctx.beginPath();
    ctx.moveTo(sx - Math.cos(a) * 12, sy - Math.sin(a) * 12);
    ctx.lineTo(sx + Math.cos(a) * 12, sy + Math.sin(a) * 12);
    ctx.moveTo(sx - 3, sy - 5);
    ctx.lineTo(sx + 1, sy + 1);
    ctx.stroke();
  }
  ctx.restore();

  // Vorderbeine mit Krallen
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 98, 26, 26, 18, side * 0.3, 0, TAU);
    ctx.fillStyle = pal.body[1];
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,5,.75)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#efe6d2';
    for (const dx of [-13, 0, 13]) {
      ctx.beginPath();
      ctx.moveTo(side * 98 + dx - 4, 38);
      ctx.lineTo(side * 98 + dx, 52);
      ctx.lineTo(side * 98 + dx + 4, 38);
      ctx.fill();
    }
  }

  // Kopf, zum Hort hin
  ctx.save();
  if (o.shake) ctx.rotate(Math.sin(time * 40) * 0.05 * o.shake);
  // Ab Legende 5 wachsen die Hörner
  const hornLen = scars >= 5 ? 1.3 : 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 26, 22);
    ctx.quadraticCurveTo(side * 54 * hornLen, 8 - (hornLen - 1) * 30, side * 66 * hornLen, -30 * hornLen);
    ctx.quadraticCurveTo(side * 48, 0, side * 36, 30);
    ctx.closePath();
    ctx.fillStyle = pal.horn;
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,45,25,.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const hg = ctx.createLinearGradient(0, 10, 0, 100);
  hg.addColorStop(0, pal.head[0]);
  hg.addColorStop(1, pal.head[1]);
  ctx.beginPath();
  ctx.moveTo(-40, 10);
  ctx.bezierCurveTo(-50, 50, -36, 86, -16, 96);
  ctx.quadraticCurveTo(0, 102, 16, 96);
  ctx.bezierCurveTo(36, 86, 50, 50, 40, 10);
  ctx.closePath();
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,5,.8)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,235,200,.18)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.lineTo(0, 82);
  ctx.stroke();
  ctx.fillStyle = 'rgba(15,8,4,.9)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 9, 88, 4, 2.5, 0, 0, TAU);
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    if (o.awake) {
      ctx.save();
      ctx.shadowColor = pal.eye;
      ctx.shadowBlur = tile * 0.25;
      ctx.beginPath();
      ctx.ellipse(side * 21, 50, 10, 6, side * 0.25, 0, TAU);
      ctx.fillStyle = pal.eye;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#1a0800';
      ctx.beginPath();
      ctx.ellipse(side * 21, 50, 2, 5.5, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(20,10,5,.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(side * 21, 46, 9, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30,15,6,.8)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(side * 10, 38);
    ctx.lineTo(side * 32, 40);
    ctx.stroke();
  }
  if (o.mouth > 0) {
    const mg = ctx.createRadialGradient(0, 98, 2, 0, 98, 46 * o.mouth);
    mg.addColorStop(0, 'rgba(255,236,150,.95)');
    mg.addColorStop(0.5, 'rgba(255,138,61,.6)');
    mg.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(0, 98, 46 * o.mouth, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

// Kleine Bilder für die Tafel, einmal gezeichnet und zwischengespeichert.
// kind: 't' Schatz · 'hero' Held · 'guardian' Knochenwächter · 'dragon' Drache (id = Farbpalette)
const iconCache = new Map();

export function iconURL(kind, id, px = 96, { silhouette = false, palette = null, scars = 0 } = {}) {
  const key = `${kind}:${id}:${px}:${silhouette}:${scars}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const canvas = document.createElement('canvas');
  const wide = kind === 'dragon';
  canvas.width = wide ? px * 2 : px;
  canvas.height = wide ? Math.round(px * 0.8) : px;
  const ctx = canvas.getContext('2d');
  if (kind === 'hero') drawHero(ctx, id, px / 2, px / 2 - px * 0.02, px * 1.2);
  else if (kind === 'guardian') drawGuardian(ctx, px / 2, px / 2, px * 1.1, 0);
  else if (wide) drawDragon(ctx, px, px * 0.36, px / 3.2, 0, { awake: true, spread: 0.35, palette, scars });
  else drawTreasure(ctx, id, px / 2, px / 2, px * 1.05, 0);
  if (silhouette) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#4a3f52';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const url = canvas.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}
