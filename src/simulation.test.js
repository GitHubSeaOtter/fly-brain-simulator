import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from './simulation.js';

test('food stimulus moves toward the food and produces bounded signals', () => {
  const sim = new Simulation();
  const before = Math.hypot(sim.food.x-sim.fly.x, sim.food.z-sim.fly.z);
  for(let i=0;i<90;i++)sim.step(1/30);
  assert.ok(Math.hypot(sim.food.x-sim.fly.x,sim.food.z-sim.fly.z)<before);
  for(const signal of Object.values(sim.signals))assert.ok(signal>=0 && signal<=1);
});
test('changing synthetic workload does not alter behavioral trajectory', () => {
  const a=new Simulation(),b=new Simulation();b.setWorkload(32768);
  for(let i=0;i<90;i++){a.step(1/30);b.step(1/30);}
  assert.deepEqual(a.fly,b.fly);
  assert.throws(()=>a.setWorkload(100),RangeError);
});
