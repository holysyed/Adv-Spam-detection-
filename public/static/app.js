const message=document.querySelector('#message'), count=document.querySelector('#count'), button=document.querySelector('#analyze'), example=document.querySelector('#example');
const samples=['URGENT! You won a free gift. Click this link now to claim your prize!','Hey, are we still meeting for lunch after class tomorrow?','Your account is locked. Verify your password immediately to avoid suspension.'];
let sample=0; function nextExample(){message.value=samples[sample++ % samples.length];updateCount();message.focus()};function updateCount(){count.textContent=`${message.value.length} / 5000`};message.addEventListener('input',updateCount);example.addEventListener('click',nextExample);
let scanInProgress = false;

function renderPrediction(data) {
  document.querySelector('#empty').hidden = true;
  document.querySelector('#result').hidden = false;
  const spam = data.label === 'spam';
  document.querySelector('#verdict').textContent = spam ? 'Looking suspicious.' : 'Looking more chill.';
  document.querySelector('#icon').textContent = spam ? '⚑' : '✦';
  document.querySelector('#explanation').textContent = spam
    ? 'The model spotted patterns associated with spam. Pause before clicking links or sharing details.'
    : 'The model found fewer patterns associated with spam. Stay mindful of unexpected links and requests.';
  document.querySelector('#score').textContent = `${data.spam_score}%`;
  document.querySelector('#bar-fill').style.width = `${data.spam_score}%`;
  const signals = document.querySelector('#signals');
  signals.replaceChildren();
  for (const term of data.signals.length ? data.signals : ['No known spam signals']) {
    const tag = document.createElement('span');
    tag.textContent = term;
    signals.append(tag);
  }
  document.querySelector('#source').textContent =
    `Model: ${data.source}. Scores are estimates, not guarantees.`;
}

async function runMessageScan(predict) {
  if (scanInProgress) throw new Error('A message check is already running. Try again in a moment.');
  scanInProgress = true;
  button.disabled = true;
  document.querySelector('#error').textContent = '';
  try {
    renderPrediction(await predict());
  } finally {
    button.disabled = false;
    scanInProgress = false;
  }
}

async function analyze() {
  if (scanInProgress) return;
  const error = document.querySelector('#error');
  if (!message.value.trim()) {
    error.textContent = 'Add a message first.';
    message.focus();
    return;
  }
  button.firstElementChild.textContent = 'Checking…';
  try {
    await runMessageScan(async () => {
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message: message.value}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong.');
      return data;
    });
  } catch (failure) {
    error.textContent = failure.message;
  } finally {
    button.firstElementChild.textContent = 'Check the vibe';
  }
}

button.addEventListener('click',analyze);message.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')analyze()});let touchX=0;example.addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX},{passive:true});example.addEventListener('touchend',e=>{if(Math.abs(e.changedTouches[0].clientX-touchX)>40){nextExample();e.preventDefault()}},{passive:false});
