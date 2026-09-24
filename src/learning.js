// Synthetic two-choice food association. This is a learnable game task, not fly connectome data.
export const ELEMENT_COUNTS = [256, 2048, 8192, 32768];
export const TRAIN_SEED = 0x1ab2026;
export const TEST_SEED = 0x6f43af1;
export const TRAIN_EXAMPLES = 512;
export const TEST_EXAMPLES = 256;
export const EPOCHS = 4;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeDataset(seed, size) {
  const random = rng(seed), samples = [];
  for (let n = 0; n < size; n++) {
    const input = new Float32Array(8);
    for (let i = 0; i < input.length; i++) input[i] = random() * 2 - 1;
    // A fixed, non-linear odor-to-food rule. Balanced sampling prevents one-sided guessing.
    const rule = input[0] * input[1] + .85 * input[2] * input[3]
      - .7 * input[4] * input[5] + .35 * input[6];
    samples.push({ input, side: rule >= 0 ? 1 : -1 });
  }
  return samples;
}

export class AssociativeLearner {
  constructor(elements, seed = 0xbee5) {
    if (!ELEMENT_COUNTS.includes(elements)) throw new RangeError('Unsupported element count');
    this.elements = elements;
    this.scale = 1 / Math.sqrt(elements);
    const random = rng(seed);
    this.inputA = new Uint8Array(elements);
    this.inputB = new Uint8Array(elements);
    this.gainA = new Float32Array(elements);
    this.gainB = new Float32Array(elements);
    this.bias = new Float32Array(elements);
    this.weights = new Float32Array(elements);
    this.activations = new Float32Array(elements);
    for (let i = 0; i < elements; i++) {
      this.inputA[i] = Math.floor(random() * 8);
      this.inputB[i] = Math.floor(random() * 8);
      this.gainA[i] = (random() * 2 - 1) * 2.5;
      this.gainB[i] = (random() * 2 - 1) * 2.5;
      this.bias[i] = (random() * 2 - 1) * 1.5;
    }
  }
  predict(input) {
    let score = 0;
    for (let i = 0; i < this.elements; i++) {
      const z = this.gainA[i] * input[this.inputA[i]]
        + this.gainB[i] * input[this.inputB[i]] + this.bias[i];
      const activation = Math.tanh(z);
      this.activations[i] = activation;
      score += this.weights[i] * activation;
    }
    return score * this.scale;
  }
  learn(sample) {
    const score = this.predict(sample.input);
    const probability = 1 / (1 + Math.exp(-sample.side * score));
    const gradient = .6 * sample.side * (1 - probability) * this.scale;
    for (let i = 0; i < this.elements; i++) this.weights[i] += gradient * this.activations[i];
    return (score >= 0 ? 1 : -1) === sample.side;
  }
  accuracy(dataset) {
    let correct = 0;
    for (const sample of dataset) correct += ((this.predict(sample.input) >= 0 ? 1 : -1) === sample.side);
    return correct / dataset.length;
  }
}

// Same examples and presentation order for each size; evaluation data is never trained on.
export function runComparison(onProgress = () => {}) {
  const train = makeDataset(TRAIN_SEED, TRAIN_EXAMPLES);
  const test = makeDataset(TEST_SEED, TEST_EXAMPLES);
  return ELEMENT_COUNTS.map((elements, index) => {
    const learner = new AssociativeLearner(elements);
    const before = learner.accuracy(test);
    const start = performance.now();
    for (let epoch = 0; epoch < EPOCHS; epoch++) {
      for (const sample of train) learner.learn(sample);
      onProgress({ elements, index, epoch: epoch + 1, total: ELEMENT_COUNTS.length });
    }
    const trainingMs = performance.now() - start;
    const evalStart = performance.now();
    const after = learner.accuracy(test);
    const evaluationMs = performance.now() - evalStart;
    return { elements, before, after, trainingMs, evaluationMs };
  });
}
