let sessionId = null;
let currentFilename = '';

document.addEventListener('DOMContentLoaded', () => {
  initDropZone();

  const textarea = document.getElementById('chat-input');
  textarea.addEventListener('input', autoGrowTextarea);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});

function initDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    handleFile(fileInput.files[0]);
  });
}

function handleFile(file) {
  if (!file || file.type !== 'application/pdf') {
    alert('Please upload a PDF file');
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    alert('File too large (max 20MB)');
    return;
  }

  currentFilename = file.name;
  uploadPDF(file);
}

async function uploadPDF(file) {
  const dropZone = document.getElementById('drop-zone');
  const progressWrap = document.getElementById('progress-wrap');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');

  progressWrap.style.display = 'block';
  dropZone.style.display = 'none';
  progressFill.style.width = '30%';
  progressLabel.textContent = 'Uploading PDF… (1/3)';

  try {
    await delay(600);
    progressFill.style.width = '65%';
    progressLabel.textContent = 'Chunking document… (2/3)';

    const formData = new FormData();
    formData.append('file', file);

    const uploadRequest = fetch('/upload', {
      method: 'POST',
      body: formData,
    });
    const [response] = await Promise.all([uploadRequest, delay(600)]);
    const data = await parseJSONResponse(response);

    progressFill.style.width = '90%';
    progressLabel.textContent = 'Building vector index… (3/3)';

    await delay(400);
    progressFill.style.width = '100%';

    await delay(300);
    sessionId = data.session_id;
    progressWrap.style.display = 'none';
    showDocBadge(currentFilename, data.chunk_count);
    document.getElementById('chat-section').style.display = 'block';
    document.getElementById('chat-input').focus();
  } catch (error) {
    alert(error.message);
    resetUploadUI();
  }
}

function showDocBadge(filename, chunkCount) {
  const badge = document.getElementById('doc-badge');
  const name = badge.querySelector('.name');
  const chunks = badge.querySelector('.chunks');
  const displayName = filename.length > 40 ? `${filename.slice(0, 37)}...` : filename;

  name.textContent = displayName;
  chunks.textContent = `${chunkCount} chunks indexed`;
  badge.style.display = 'flex';
}

async function resetSession() {
  if (sessionId) {
    await fetch('/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  }

  sessionId = null;
  currentFilename = '';
  document.getElementById('chat-window').innerHTML = '';
  document.getElementById('chat-section').style.display = 'none';
  document.getElementById('doc-badge').style.display = 'none';
  resetUploadUI();
}

async function sendMessage() {
  const textarea = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const question = textarea.value.trim();

  if (!sessionId || !question) {
    return;
  }

  textarea.value = '';
  textarea.style.height = '42px';
  sendBtn.disabled = true;
  appendUserMessage(question);
  showSpinner();
  scrollToBottom();

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        question,
      }),
    });
    const data = await parseJSONResponse(response);

    removeSpinner();
    appendAssistantMessage(data.answer);
  } catch (error) {
    removeSpinner();
    appendAssistantError(error.message);
  } finally {
    sendBtn.disabled = false;
    textarea.focus();
  }
}

function appendAssistantMessage(fullAnswer) {
  const parts = fullAnswer.split('\nSource:');
  const mainAnswer = parts[0].trim();
  const citation = parts.length > 1 ? parts.slice(1).join('\nSource:').trim() : '';
  const message = document.createElement('div');
  const bubble = document.createElement('div');
  const actions = document.createElement('div');
  const copyButton = document.createElement('button');
  const goodButton = document.createElement('button');

  message.className = 'msg assistant';
  bubble.className = 'bubble';
  bubble.textContent = mainAnswer;
  message.appendChild(bubble);

  if (citation) {
    const source = document.createElement('div');
    source.className = 'source-cite';
    source.textContent = `Source: ${citation}`;
    message.appendChild(source);
  }

  actions.className = 'msg-actions';
  copyButton.type = 'button';
  copyButton.textContent = 'Copy';
  copyButton.onclick = () => navigator.clipboard.writeText(mainAnswer);
  goodButton.type = 'button';
  goodButton.textContent = 'Good';

  actions.appendChild(copyButton);
  actions.appendChild(goodButton);
  message.appendChild(actions);

  document.getElementById('chat-window').appendChild(message);
  scrollToBottom();
}

function autoGrowTextarea() {
  const textarea = document.getElementById('chat-input');
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

function scrollToBottom() {
  const cw = document.getElementById('chat-window');
  cw.scrollTop = cw.scrollHeight;
}

function appendUserMessage(text) {
  const message = document.createElement('div');
  const bubble = document.createElement('div');

  message.className = 'msg user';
  bubble.className = 'bubble';
  bubble.textContent = text;
  message.appendChild(bubble);

  document.getElementById('chat-window').appendChild(message);
  scrollToBottom();
}

function appendAssistantError(text) {
  const message = document.createElement('div');
  const bubble = document.createElement('div');

  message.className = 'msg assistant';
  bubble.className = 'bubble';
  bubble.style.color = '#ff6b6b';
  bubble.textContent = text;
  message.appendChild(bubble);

  document.getElementById('chat-window').appendChild(message);
  scrollToBottom();
}

function showSpinner() {
  removeSpinner();

  const spinner = document.createElement('div');
  spinner.id = 'spinner';
  spinner.textContent = 'Thinking…';
  spinner.style.display = 'block';
  document.getElementById('chat-window').appendChild(spinner);
}

function removeSpinner() {
  const spinner = document.getElementById('spinner');
  if (spinner) {
    spinner.remove();
  }
}

function resetUploadUI() {
  document.getElementById('drop-zone').style.display = 'block';
  document.getElementById('progress-wrap').style.display = 'none';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-label').textContent = '';
  document.getElementById('file-input').value = '';
}

async function parseJSONResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
