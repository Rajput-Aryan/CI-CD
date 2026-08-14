// ---------- boot sequence ----------
const bootLines = [
  { text: "[BOOT] initializing profile...", cls: "" },
  { text: "[READY] rendering interface_", cls: "warn" }
];

const bootEl = document.getElementById('boot-log');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function typeBoot(){
  if(reduceMotion){
    bootEl.innerHTML = bootLines.map(l => `<span class="${l.cls}">${l.text}</span>`).join('\n');
    startRoleCycle();
    return;
  }
  let li = 0, ci = 0;
  const out = [];
  function step(){
    if(li >= bootLines.length){
      bootEl.innerHTML = out.join('\n');
      startRoleCycle();
      return;
    }
    const line = bootLines[li];
    if(ci === 0) out.push('');
    ci++;
    out[out.length-1] = `<span class="${line.cls}">${line.text.slice(0, ci)}</span>` + (ci < line.text.length ? '<span class="cursor"></span>' : '');
    bootEl.innerHTML = out.join('\n');
    if(ci >= line.text.length){
      li++; ci = 0;
      setTimeout(step, 160);
    } else {
      setTimeout(step, 14);
    }
  }
  step();
}

// ---------- role cycle typing ----------
const roles = [ "FullStack Engineer","AI / GenAI Engineer", "Data Analyst", "Software Developer"];
const roleEl = document.getElementById('role-cycle');

function startRoleCycle(){
  if(reduceMotion){
    roleEl.textContent = roles[0];
    return;
  }
  let ri = 0, ci = 0, deleting = false;
  function tick(){
    const word = roles[ri];
    if(!deleting){
      ci++;
      roleEl.innerHTML = word.slice(0, ci) + '<span class="type-cursor"></span>';
      if(ci >= word.length){ deleting = true; setTimeout(tick, 1400); return; }
    } else {
      ci--;
      roleEl.innerHTML = word.slice(0, ci) + '<span class="type-cursor"></span>';
      if(ci <= 0){ deleting = false; ri = (ri+1) % roles.length; }
    }
    setTimeout(tick, deleting ? 28 : 55);
  }
  tick();
}

typeBoot();

// ---------- particle network ----------
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let W, H;

function resize(){
  W = canvas.width = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resize);

function initParticles(){
  const count = Math.min(60, Math.floor((W*H)/26000));
  particles = Array.from({length: count}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*0.25, vy: (Math.random()-0.5)*0.25
  }));
}

function drawParticles(){
  ctx.clearRect(0,0,W,H);
  for(const p of particles){
    p.x += p.vx; p.y += p.vy;
    if(p.x < 0 || p.x > W) p.vx *= -1;
    if(p.y < 0 || p.y > H) p.vy *= -1;
  }
  for(let i=0;i<particles.length;i++){
    for(let j=i+1;j<particles.length;j++){
      const a = particles[i], b = particles[j];
      const dx = a.x-b.x, dy = a.y-b.y;
      const d = Math.sqrt(dx*dx+dy*dy);
      if(d < 130){
        ctx.strokeStyle = `rgba(0,229,255,${0.14 * (1 - d/130)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      }
    }
  }
  for(const p of particles){
    ctx.fillStyle = 'rgba(0,229,255,0.55)';
    ctx.beginPath(); ctx.arc(p.x,p.y,1.6,0,Math.PI*2); ctx.fill();
  }
}

function loop(){
  drawParticles();
  if(!reduceMotion) requestAnimationFrame(loop);
}

resize();
initParticles();
if(!reduceMotion){
  requestAnimationFrame(loop);
} else {
  drawParticles();
}

// ---------- scroll reveal ----------
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));
