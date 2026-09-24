// Lightweight behavioral proxy. No connectome data or biological neuron identities.
export class Simulation {
  constructor() { this.reset(); this.setWorkload(256); }
  reset() {
    this.time = 0;
    this.fly = { x: -1.9, z: .9, yaw: .3, speed: 0 };
    this.food = { x: 2, z: -1.1 };
    this.obstacle = { x: .35, z: -.2 };
    this.stimulus = 'food';
    this.signals = { smell: 0, vision: 0, avoid: 0 };
    this.seed = 0x81ac;
  }
  setWorkload(count) {
    const n = Number(count);
    if (![256, 2048, 8192, 32768].includes(n)) throw new RangeError('Unsupported workload');
    this.workload = n;
    this.potentials = new Float32Array(n);
  }
  step(dt) {
    dt = Math.min(.05, Math.max(0, dt));
    this.time += dt;
    const f = this.fly;
    const dx = this.food.x - f.x, dz = this.food.z - f.z;
    const foodDistance = Math.hypot(dx, dz);
    const ox = f.x - this.obstacle.x, oz = f.z - this.obstacle.z;
    const obstacleDistance = Math.hypot(ox, oz);
    const targetSmell = this.stimulus === 'food' ? Math.exp(-foodDistance * .35) : 0;
    const targetVision = this.stimulus === 'light' ? .6 + .35 * Math.sin(this.time * 1.6) : .16;
    const targetAvoid = this.stimulus === 'obstacle' ? Math.exp(-obstacleDistance * 1.1) : 0;
    for (const [key, target] of Object.entries({ smell: targetSmell, vision: targetVision, avoid: targetAvoid }))
      this.signals[key] += (target - this.signals[key]) * Math.min(1, dt * 5);
    // Synthetic state updates provide a repeatable CPU workload; values never drive the fly.
    const p = this.potentials;
    const drive = this.signals.smell * .2 + this.signals.vision * .1 - this.signals.avoid * .1;
    for (let i = 0; i < p.length; i++) {
      const next = p[i] * .966 + p[(i + 17) % p.length] * .026 + drive * .008;
      p[i] = next > .95 ? 0 : next;
    }
    let targetYaw = f.yaw + .35 * dt;
    if (this.stimulus === 'food') targetYaw = Math.atan2(dz, dx);
    if (this.stimulus === 'light') targetYaw = Math.atan2(-f.z - 1.6, -f.x - 1.6);
    if (this.stimulus === 'obstacle') targetYaw = Math.atan2(oz, ox);
    const turn = Math.atan2(Math.sin(targetYaw - f.yaw), Math.cos(targetYaw - f.yaw));
    f.yaw += Math.max(-dt * 2.5, Math.min(dt * 2.5, turn));
    f.speed = this.stimulus === 'food' && foodDistance < .28 ? 0 : 1.25;
    f.x += Math.cos(f.yaw) * f.speed * dt;
    f.z += Math.sin(f.yaw) * f.speed * dt;
    if (Math.hypot(f.x, f.z) > 3.35) {
      f.x = Math.max(-3.3, Math.min(3.3, f.x));
      f.z = Math.max(-3.3, Math.min(3.3, f.z));
      f.yaw = Math.atan2(-f.z, -f.x);
    }
  }
}
