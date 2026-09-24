import { AssociativeLearner, ELEMENT_COUNTS, EPOCHS, makeDataset, TRAIN_SEED, TEST_SEED, TRAIN_EXAMPLES, TEST_EXAMPLES } from './learning.js';

// A dedicated worker keeps 3D rendering and touch controls responsive during training.
self.onmessage = () => {
  const train = makeDataset(TRAIN_SEED, TRAIN_EXAMPLES);
  const test = makeDataset(TEST_SEED, TEST_EXAMPLES);
  let index = 0, epoch = 0, learner, before, started;
  const rows = [];
  function nextBatch() {
    if (!learner) {
      const elements = ELEMENT_COUNTS[index];
      learner = new AssociativeLearner(elements);
      before = learner.accuracy(test);
      started = performance.now();
    }
    for (let i = 0; i < TRAIN_EXAMPLES; i++) learner.learn(train[i]);
    epoch++;
    postMessage({ type: 'progress', elements: learner.elements, epoch, index });
    if (epoch === EPOCHS) {
      const trainingMs = performance.now() - started;
      const evalStart = performance.now();
      const after = learner.accuracy(test);
      rows.push({ elements: learner.elements, before, after, trainingMs,
        evaluationMs: performance.now() - evalStart });
      index++; epoch = 0; learner = null;
      if (index === ELEMENT_COUNTS.length) {
        postMessage({ type: 'complete', rows }); return;
      }
    }
    setTimeout(nextBatch, 0);
  }
  nextBatch();
};
