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

function faceted(ctx) {
  const g = ctx.createLinearGradient(-20, -20, 20, 24);
  g.addColorStop(0, '#ff8a96');
  g.addColorStop(0.5, '#d61f3c');
  g.addColorStop(1, '#6e0a1c');
  ctx.beginPath();
  ctx.moveTo(-24, -6);
  ctx.lineTo(-12, -20);
  ctx.lineTo(12, -20);
  ctx.lineTo(24, -6);
  ctx.lineTo(0, 26);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#4a0612';
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
  ctx.strokeStyle = 'rgba(255,200,210,.55)';
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

function wing(ctx, side, spread, flap) {
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
  g.addColorStop(0, '#6a3326');
  g.addColorStop(1, '#2d1512');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#80452c';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#9a5a36';
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

// o.awake: Augen offen · o.spread: Flügel 0–1 · o.mouth: Glut im Maul 0–1 · o.shake: Kopfschütteln 0–1
export function drawDragon(ctx, x, y, tile, time, o = {}) {
  const breathe = 1 + Math.sin(time * 1.4) * 0.015;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(tile / 100, tile / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Schwanz
  ctx.strokeStyle = '#3b2213';
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(70, -20);
  ctx.bezierCurveTo(170, -30, 220, -70, 290, -48);
  ctx.stroke();
  ctx.strokeStyle = '#6b4020';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = '#3b2213';
  ctx.beginPath();
  ctx.moveTo(280, -62);
  ctx.lineTo(322, -44);
  ctx.lineTo(282, -30);
  ctx.closePath();
  ctx.fill();

  const flap = Math.sin(time * 1.1) * 0.03;
  const spread = o.spread ?? 0.3;
  wing(ctx, -1, spread, flap);
  wing(ctx, 1, spread, flap);

  // Körper
  ctx.save();
  ctx.scale(breathe, breathe);
  const g = ctx.createRadialGradient(-30, -50, 10, 0, -20, 130);
  g.addColorStop(0, '#c08a4a');
  g.addColorStop(0.55, '#7b4a24');
  g.addColorStop(1, '#3e2413');
  ctx.beginPath();
  ctx.ellipse(0, -22, 115, 64, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#2a170b';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,160,.13)';
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
  ctx.restore();

  // Vorderbeine mit Krallen
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 98, 26, 26, 18, side * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#6b4020';
    ctx.fill();
    ctx.strokeStyle = '#2a170b';
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
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 26, 22);
    ctx.quadraticCurveTo(side * 54, 8, side * 66, -30);
    ctx.quadraticCurveTo(side * 48, 0, side * 36, 30);
    ctx.closePath();
    ctx.fillStyle = '#e8dcc0';
    ctx.fill();
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const hg = ctx.createLinearGradient(0, 10, 0, 100);
  hg.addColorStop(0, '#a87040');
  hg.addColorStop(1, '#5d361b');
  ctx.beginPath();
  ctx.moveTo(-40, 10);
  ctx.bezierCurveTo(-50, 50, -36, 86, -16, 96);
  ctx.quadraticCurveTo(0, 102, 16, 96);
  ctx.bezierCurveTo(36, 86, 50, 50, 40, 10);
  ctx.closePath();
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = '#2e190c';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,170,.18)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.lineTo(0, 82);
  ctx.stroke();
  ctx.fillStyle = '#1b0e07';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 9, 88, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    if (o.awake) {
      ctx.save();
      ctx.shadowColor = '#ff8a3d';
      ctx.shadowBlur = tile * 0.25;
      ctx.beginPath();
      ctx.ellipse(side * 21, 50, 10, 6, side * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb347';
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2a0d00';
      ctx.beginPath();
      ctx.ellipse(side * 21, 50, 2, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#2e190c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(side * 21, 46, 9, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
    ctx.strokeStyle = '#3a200e';
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
    ctx.arc(0, 98, 46 * o.mouth, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

// Kleine Bilder für die Bedienleiste, einmal gezeichnet und zwischengespeichert
const iconCache = new Map();

export function iconURL(kind, id, px = 96) {
  const key = `${kind}:${id}:${px}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (kind === 'hero') drawHero(ctx, id, px / 2, px / 2 - px * 0.02, px * 1.2);
  else drawTreasure(ctx, id, px / 2, px / 2, px * 1.05, 0);
  const url = canvas.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}
