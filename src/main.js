import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';

const $ = id => document.getElementById(id);
const sim = new Simulation();
let renderer;
try { renderer = new Renderer($('scene')); $('glStatus').textContent = 'WEBGL ACTIVE'; }
catch (error) { $('glStatus').textContent = 'WEBGL UNAVAILABLE'; $('error').hidden = false; $('error').textContent = error.message; }

const labels = { food: 'エサを探索中', light: '光に反応中', obstacle: '障害物を回避中' };
for (const stimulus of ['food','light','obstacle']) {
  $(stimulus).addEventListener('click', () => {
    sim.stimulus = stimulus;
    $('stateLabel').textContent = labels[stimulus];
    for (const name of ['food','light','obstacle']) $(name).classList.toggle('active', name === stimulus);
  });
}
$('neurons').addEventListener('change', e => { sim.setWorkload(Number(e.target.value)); samples.length = 0; });
$('resolution').addEventListener('change', e => { if (renderer) renderer.resolution = Number(e.target.value); samples.length = 0; });
let paused = false;
$('pause').addEventListener('click', () => { paused = !paused; $('pause').textContent = paused ? '再開' : '一時停止'; });
$('reset').addEventListener('click', () => { sim.reset(); sim.setWorkload(Number($('neurons').value)); paused = false; $('pause').textContent = '一時停止'; $('stateLabel').textContent = labels.food; for (const name of ['food','light','obstacle']) $(name).classList.toggle('active',name === 'food'); samples.length=0; accumulator=0; });

const samples = [];
let accumulator = 0, last = 0, lastUi = 0;
function updateSignals(){for(const [key,id] of [['smell','smell'],['vision','vision'],['avoid','avoid']]){const percent=Math.round(Math.max(0,Math.min(1,sim.signals[key]))*100);$(id+'Bar').style.width=percent+'%';$(id+'Value').textContent=percent+'%';}}
function updateMetrics(now) {
  while(samples.length && now-samples[0].time>3000)samples.shift();
  if(!samples.length){for(const id of ['fps','frame','compute','steps'])$(id).textContent='—';return;}
  const elapsed=Math.max(.001,(now-samples[0].time)/1000);
  const frames=samples.length,steps=samples.reduce((sum,s)=>sum+s.steps,0);
  $('fps').textContent=(frames/elapsed).toFixed(1);
  $('frame').textContent=(samples.reduce((sum,s)=>sum+s.render,0)/frames).toFixed(2);
  $('compute').textContent=steps?(samples.reduce((sum,s)=>sum+s.compute,0)/steps).toFixed(2):'—';
  $('steps').textContent=(steps/elapsed).toFixed(1);
}
function tick(now){
  if (!last) last=now;
  const delta=Math.min(.1,(now-last)/1000);last=now;
  let steps=0, compute=0;
  if(!paused && !document.hidden){accumulator+=delta;while(accumulator>=1/30 && steps<3){const start=performance.now();sim.step(1/30);compute+=performance.now()-start;accumulator-=1/30;steps++;}if(steps===3)accumulator=0;}
  let render=0;
  if(renderer && !document.hidden){const start=performance.now();try{renderer.render(sim)}catch(error){renderer=null;$('error').hidden=false;$('error').textContent=error.message;}render=performance.now()-start;}
  if(!paused && !document.hidden)samples.push({time:now,steps,compute,render});
  if(now-lastUi>250){updateMetrics(now);updateSignals();lastUi=now;}
  requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;samples.length=0;});
$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;$('glStatus').textContent='WEBGL CONTEXT LOST';$('error').hidden=false;$('error').textContent='描画が中断されました。ページを再読み込みしてください。';});
let pointer=null;
$('scene').addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);});
$('scene').addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId||!renderer)return;renderer.angle+=(e.clientX-pointer.x)*.008;renderer.elevation=Math.max(.08,Math.min(1.15,renderer.elevation+(e.clientY-pointer.y)*.005));pointer.x=e.clientX;pointer.y=e.clientY;});
$('scene').addEventListener('pointerup',()=>{pointer=null;});
$('scene').addEventListener('pointercancel',()=>{pointer=null;});
$('export').addEventListener('click',()=>{
  updateMetrics(performance.now());
  const values=[new Date().toISOString(),navigator.userAgent,sim.workload,$('resolution').value,$('fps').textContent,$('frame').textContent,$('compute').textContent,$('steps').textContent];
  const csv='timestamp,user_agent,workload_elements,resolution_scale,fps,render_cpu_ms,brain_cpu_ms_per_step,steps_per_second\n'+values.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')+'\n';
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fly-brain-benchmark.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
if(renderer) requestAnimationFrame(tick);

let learningWorker = null;
let learningRows = null;
function endTraining() {
  if (learningWorker) learningWorker.terminate();
  learningWorker = null;
  $('train').disabled = false;
  $('cancelTrain').disabled = true;
}
$('train').addEventListener('click', () => {
  if (learningWorker) return;
  learningRows = null;
  $('exportLearning').disabled = true;
  $('train').disabled = true;
  $('cancelTrain').disabled = false;
  $('learningResults').innerHTML = '<tr><td colspan="5">訓練中…</td></tr>';
  $('learningStatus').textContent = '256要素の訓練を開始しています。';
  try {
    const worker = new Worker(new URL('./learning-worker.js', import.meta.url), { type: 'module' });
    learningWorker = worker;
    worker.onmessage = event => {
      if (worker !== learningWorker) return;
      const message = event.data;
      if (message.type === 'progress') {
        $('learningStatus').textContent = `${message.elements.toLocaleString()}要素 · 訓練 ${message.epoch}/4 回目（${message.index + 1}/4 種類）`;
      } else if (message.type === 'complete') {
        learningRows = message.rows;
        $('learningResults').replaceChildren();
        for (const row of learningRows) {
          const cells = [row.elements.toLocaleString(), (row.before * 100).toFixed(1) + '%',
            (row.after * 100).toFixed(1) + '%', ((row.after - row.before) * 100).toFixed(1) + 'pt',
            (row.trainingMs / 1000).toFixed(2) + '秒'];
          const tr = document.createElement('tr');
          cells.forEach((value, index) => { const td = document.createElement('td'); td.textContent = value;
            if (index === 3 && row.after > row.before) td.className = 'positive'; tr.append(td); });
          $('learningResults').append(tr);
        }
        $('learningStatus').textContent = '完了 · 訓練未使用の256問で比較しました。';
        $('exportLearning').disabled = false;
        endTraining();
      }
    };
    worker.onerror = () => {
      $('learningStatus').textContent = '訓練に失敗しました。ページを再読み込みして再試行してください。';
      endTraining();
    };
    worker.postMessage({ type: 'start' });
  } catch (error) {
    $('learningStatus').textContent = `訓練を開始できません: ${error.message}`;
    endTraining();
  }
});
$('cancelTrain').addEventListener('click', () => {
  endTraining();
  $('learningStatus').textContent = '訓練を中止しました。';
  $('learningResults').innerHTML = '<tr><td colspan="5">測定待ち</td></tr>';
});
$('exportLearning').addEventListener('click', () => {
  if (!learningRows) return;
  const header = 'timestamp,user_agent,task,train_seed,test_seed,train_examples,test_examples,epochs,elements,accuracy_before,accuracy_after,training_ms,evaluation_ms';
  const lines = learningRows.map(row => [new Date().toISOString(),navigator.userAgent,'synthetic_odor_food_left_right',
    0x1ab2026,0x6f43af1,512,256,4,row.elements,row.before,row.after,row.trainingMs,row.evaluationMs]
    .map(value => '"' + String(value).replaceAll('"','""') + '"').join(','));
  const url = URL.createObjectURL(new Blob([header+'\n'+lines.join('\n')+'\n'], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');anchor.href = url;anchor.download = 'fly-learning-comparison.csv';anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
