let weightsRequest;

function loadWeights() {
  if (!weightsRequest) {
    weightsRequest = fetch('/api/gmail-model', {signal: AbortSignal.timeout(15000)})
      .then(response => {
        if (!response.ok) throw new Error('The browser scanner could not load. Try again.');
        return response.json();
      })
      .catch(error => {
        weightsRequest = undefined;
        throw error;
      });
  }
  return weightsRequest;
}

function wordFeatures(text) {
  const words = text.match(/[\p{L}\p{N}_]{2,}/gu) || [];
  const pairs = words.slice(1).map((word, i) => words[i] + ' ' + word);
  return [...words, ...pairs];
}

function* characterFeatures(text) {
  for (const word of text.split(/[\p{White_Space}\u001c-\u001f]+/u)) {
    if (!word) continue;
    const padded = Array.from(' ' + word + ' ');
    for (let size = 3; size <= 5; size++) {
      const windows = Math.max(1, padded.length - size + 1);
      for (let start = 0; start < windows; start++) {
        yield padded.slice(start, start + size).join('');
      }
      if (windows === 1) break;
    }
  }
}

function contributions(terms, weights) {
  const counts = new Map();
  for (const term of terms) {
    if (Object.hasOwn(weights, term)) counts.set(term, (counts.get(term) || 0) + 1);
  }
  let squaredNorm = 0;
  const values = [];
  for (const [term, count] of counts) {
    const [idf, coefficient] = weights[term];
    const tfidf = (1 + Math.log(count)) * idf;
    squaredNorm += tfidf ** 2;
    values.push([term, tfidf * coefficient]);
  }
  const norm = Math.sqrt(squaredNorm);
  return values.map(([term, weight]) => [term, weight / norm]);
}

export async function predictGmailMessage(message) {
  const model = await loadWeights();
  const text = message.toLowerCase();
  const words = contributions(wordFeatures(text), model.word);
  const characters = contributions(characterFeatures(text), model.char);
  const logit = [...words, ...characters].reduce((sum, [, weight]) => sum + weight, model.intercept);
  const score = 100 / (1 + Math.exp(-logit));
  const signals = words.filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))
    .slice(0, 4).map(([term]) => term);
  return {
    label: score >= 50 ? 'spam' : 'ham',
    spam_score: Math.round(score * 10) / 10,
    signals,
    source: model.source + ' · Scanned in your browser',
  };
}
