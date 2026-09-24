import test from 'node:test';
import assert from 'node:assert/strict';
import { AssociativeLearner, makeDataset, runComparison, TRAIN_SEED, TEST_SEED } from './learning.js';

test('training and unseen evaluation are deterministic, distinct, and improve over guessing', () => {
  const train = makeDataset(TRAIN_SEED, 512), testSet = makeDataset(TEST_SEED, 256);
  assert.deepEqual(makeDataset(TRAIN_SEED, 1)[0], train[0]);
  assert.notDeepEqual(train[0], testSet[0]);
  const learner = new AssociativeLearner(256);
  const before = learner.accuracy(testSet);
  for(let epoch=0;epoch<4;epoch++)for(const sample of train)learner.learn(sample);
  const after = learner.accuracy(testSet);
  assert.ok(after > before + .12, `before ${before}, after ${after}`);
  assert.ok(after > .68, `holdout accuracy ${after}`);
});
test('comparison tests every configured element count on the same unseen set', () => {
  const results = runComparison();
  assert.deepEqual(results.map(x => x.elements), [256,2048,8192,32768]);
  for (const row of results) {
    assert.ok(row.after > row.before, JSON.stringify(row));
    assert.ok(row.trainingMs >= 0 && row.evaluationMs >= 0);
  }
});
