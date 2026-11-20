import {predictGmailMessage} from './gmail-model.js';

const panel = document.querySelector('.gmail-tools');
const connectPanel = document.querySelector('#gmail-connect-panel');
const connect = document.querySelector('#gmail-connect');
const picker = document.querySelector('#gmail-picker');
const messages = document.querySelector('#gmail-message');
const scan = document.querySelector('#gmail-scan');
const more = document.querySelector('#gmail-more');
const disconnect = document.querySelector('#gmail-disconnect');
const status = document.querySelector('#gmail-status');
const scope = 'https://www.googleapis.com/auth/gmail.readonly';
const api = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
let oauth;
let loadingGoogle = false;
let session;

class GmailError extends Error {
  constructor(code) {
    super(code === 403 ? 'Google did not allow mailbox access. Check the permissions for this account.'
      : 'Gmail could not load your email. Try again.');
    this.code = code;
  }
}

async function gmailRequest(current, id = '', params = {}) {
  const suffix = id ? '/' + encodeURIComponent(id) : '';
  const signal = AbortSignal.any([current.controller.signal, AbortSignal.timeout(15000)]);
  const response = await fetch(api + suffix + '?' + new URLSearchParams(params), {
    headers: {Authorization: 'Bearer ' + current.token},
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new GmailError(response.status);
  return response.json();
}

function header(part, name) {
  return part?.headers?.find(item => item.name.toLowerCase() === name)?.value || '';
}

function updatePicker() {
  connectPanel.hidden = Boolean(session);
  picker.hidden = !session;
  messages.disabled = Boolean(session?.busy);
  scan.disabled = !session || session.busy || !messages.value;
  more.hidden = !session?.hasMore;
  more.disabled = Boolean(session?.busy);
}

function closeSession() {
  session?.controller.abort();
  session = undefined;
  messages.options.length = 1;
  messages.value = '';
  updatePicker();
}

function showFailure(current, error) {
  if (session !== current) return;
  if (error.code === 401) {
    closeSession();
    status.textContent = 'Gmail access expired. Connect again to keep scanning.';
    return;
  }
  status.textContent = error.name === 'TimeoutError' || error instanceof TypeError
    ? 'Could not finish the request. Check your connection and try again.'
    : error.message;
}

async function loadInbox(current) {
  current.busy = true;
  updatePicker();
  status.textContent = 'Loading inbox…';
  try {
    const page = await gmailRequest(current, '', {
      labelIds: 'INBOX',
      maxResults: '10',
      ...(current.pageToken && {pageToken: current.pageToken}),
    });
    const metadataQuery = [
      ['format', 'metadata'],
      ['metadataHeaders', 'Subject'],
      ['metadataHeaders', 'From'],
      ['fields', 'id,payload(headers)'],
    ];
    const summaries = await Promise.all((page.messages || [])
      .map(item => gmailRequest(current, item.id, metadataQuery)));
    if (session !== current) return;
    for (const email of summaries) {
      const subject = header(email.payload, 'subject') || '(No subject)';
      const sender = header(email.payload, 'from') || 'Unknown sender';
      messages.add(new Option(subject.slice(0, 110) + ' · ' + sender.slice(0, 80), email.id));
    }
    current.pageToken = page.nextPageToken;
    current.hasMore = Boolean(page.nextPageToken);
    status.textContent = messages.options.length > 1 ? 'Choose an email, then select Scan email.' : 'Your inbox is empty.';
  } catch (error) {
    showFailure(current, error);
  } finally {
    current.busy = false;
    updatePicker();
  }
}

function authorizationResult(response) {
  connect.disabled = false;
  if (response.error || !response.access_token || !oauth.hasGrantedAllScopes(response, scope)) {
    status.textContent = 'Gmail access was declined or unavailable. You can try connecting again.';
    return;
  }
  session = {token: response.access_token, controller: new AbortController(), hasMore: true, busy: false};
  void loadInbox(session);
}

function loadGoogle() {
  if (!panel.open || oauth || loadingGoogle) return;
  loadingGoogle = true;
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  status.textContent = 'Loading Gmail connection…';
  script.addEventListener('load', () => {
    loadingGoogle = false;
    try {
      oauth = window.google.accounts.oauth2;
      connect.disabled = false;
      status.textContent = '';
    } catch {
      status.textContent = 'Google sign-in is unavailable. Check your browser settings and reload.';
    }
  });
  script.addEventListener('error', () => {
    loadingGoogle = false;
    script.remove();
    status.textContent = 'Google sign-in could not load. Reopen this section to retry.';
  });
  document.head.append(script);
}

panel.addEventListener('toggle', loadGoogle);
loadGoogle();

connect.addEventListener('click', () => {
  connect.disabled = true;
  status.textContent = 'Waiting for Google…';
  try {
    const client = oauth.initTokenClient({
      client_id: panel.dataset.clientId,
      scope,
      include_granted_scopes: false,
      callback: authorizationResult,
      error_callback: () => {
        connect.disabled = false;
        status.textContent = 'The Google window was closed or blocked. Allow pop-ups and try again.';
      },
    });
    client.requestAccessToken({prompt: 'select_account'});
  } catch {
    connect.disabled = false;
    status.textContent = 'Google sign-in could not start. Try again.';
  }
});

disconnect.addEventListener('click', () => {
  const token = session.token;
  closeSession();
  status.textContent = 'Disconnected from Vibecheck.';
  oauth.revoke(token, response => {
    if (!session && response.successful === false) {
      status.textContent = 'Disconnected here. To revoke access, open your Google Account connections from the privacy page.';
    }
  });
  connect.focus();
});

function decodeBody(part) {
  const base64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  const charset = header(part, 'content-type').match(/charset\s*=\s*["']?([^"';\s]+)/i)?.[1];
  let decoder;
  try {
    decoder = new TextDecoder(charset || 'utf-8');
  } catch {
    decoder = new TextDecoder();
  }
  return decoder.decode(bytes);
}

function* textParts(part) {
  if (!part || part.filename || /^attachment\b/i.test(header(part, 'content-disposition'))) return;
  if (part.mimeType.startsWith('multipart/')) {
    for (const child of part.parts || []) yield* textParts(child);
  } else if (part.body?.data && ['text/plain', 'text/html'].includes(part.mimeType)) {
    yield part;
  }
}

function htmlText(html) {
  // Template contents are inert. The email markup is never inserted into the live page.
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script,style,head,template').forEach(node => node.remove());
  template.content.querySelectorAll('br,p,div,tr,td,li,blockquote,h1,h2,h3').forEach(node => node.after(' '));
  return template.content.textContent.replace(/\s+/g, ' ').trim();
}

async function scanEmail(current, id) {
  const email = await gmailRequest(current, id, {format: 'full', fields: 'payload'});
  const parts = [...textParts(email.payload)];
  const plain = parts.filter(part => part.mimeType === 'text/plain').map(decodeBody).join('\n').trim();
  const body = plain || parts.filter(part => part.mimeType === 'text/html')
    .map(part => htmlText(decodeBody(part))).join('\n').trim();
  if (!body) throw new Error('This email has no readable message body. Choose another email.');
  const subject = header(email.payload, 'subject');
  const content = (subject + '\n' + body).trim();
  const characters = Array.from(content);
  const prediction = await predictGmailMessage(characters.slice(0, 5000).join(''));
  current.controller.signal.throwIfAborted();
  status.textContent = characters.length > 5000
    ? 'Checked the first 5,000 characters. See The read for results.'
    : 'Email checked. See The read for results.';
  return prediction;
}

messages.addEventListener('change', updatePicker);
more.addEventListener('click', () => void loadInbox(session));
picker.addEventListener('submit', async event => {
  event.preventDefault();
  const current = session;
  const id = messages.value;
  if (!current || current.busy || !id) return;
  current.busy = true;
  updatePicker();
  status.textContent = 'Checking email in your browser…';
  try {
    await runMessageScan(() => scanEmail(current, id));
  } catch (error) {
    showFailure(current, error);
  } finally {
    current.busy = false;
    updatePicker();
  }
});
