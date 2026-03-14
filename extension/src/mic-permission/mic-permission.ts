const app = document.getElementById('app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1020;color:#e5e7eb;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;box-sizing:border-box;">
    <div style="width:100%;max-width:460px;background:#111827;border:1px solid rgba(148,163,184,0.2);border-radius:16px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.35);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:32px;height:32px;border-radius:10px;background:#6366f1;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">U:</div>
        <div>
          <div style="font-size:16px;font-weight:700;line-height:1.2;">Enable Microphone</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Required once for U:Echo voice input</div>
        </div>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#cbd5e1;margin:0 0 16px;">
        Chrome dismissed microphone access from the side panel. Use this normal extension page to grant access, then return to U:Echo and tap the mic again.
      </p>
      <div id="status" style="font-size:13px;line-height:1.5;border-radius:12px;padding:12px 14px;background:rgba(99,102,241,0.12);color:#c7d2fe;margin-bottom:16px;">
        Ready to request microphone permission.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button id="request" style="border:0;border-radius:10px;padding:10px 14px;background:#6366f1;color:white;font-weight:600;cursor:pointer;">Allow Microphone</button>
        <button id="close" style="border:1px solid rgba(148,163,184,0.25);border-radius:10px;padding:10px 14px;background:transparent;color:#e5e7eb;font-weight:600;cursor:pointer;">Close</button>
      </div>
      <ol style="margin:18px 0 0;padding-left:18px;font-size:12px;line-height:1.7;color:#94a3b8;">
        <li>Click <strong>Allow Microphone</strong>.</li>
        <li>Accept Chrome's microphone prompt.</li>
        <li>Return to the U:Echo side panel.</li>
        <li>Tap the mic button again.</li>
      </ol>
    </div>
  </div>
`;

const statusEl = document.getElementById('status');
const requestBtn = document.getElementById('request') as HTMLButtonElement | null;
const closeBtn = document.getElementById('close') as HTMLButtonElement | null;

function setStatus(text: string, tone: 'info' | 'success' | 'error' = 'info'): void {
  if (!statusEl) return;
  if (tone === 'success') {
    statusEl.style.background = 'rgba(34,197,94,0.12)';
    statusEl.style.color = '#bbf7d0';
  } else if (tone === 'error') {
    statusEl.style.background = 'rgba(239,68,68,0.12)';
    statusEl.style.color = '#fecaca';
  } else {
    statusEl.style.background = 'rgba(99,102,241,0.12)';
    statusEl.style.color = '#c7d2fe';
  }
  statusEl.textContent = text;
}

async function requestMicrophone(): Promise<void> {
  if (!requestBtn) return;
  requestBtn.disabled = true;
  requestBtn.textContent = 'Requesting...';
  setStatus('Waiting for Chrome microphone permission…', 'info');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    setStatus('Microphone access granted. Return to the U:Echo side panel and tap the mic again.', 'success');
    requestBtn.textContent = 'Granted';
    requestBtn.disabled = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Microphone request failed: ${message}`, 'error');
    requestBtn.disabled = false;
    requestBtn.textContent = 'Try Again';
  }
}

requestBtn?.addEventListener('click', () => {
  void requestMicrophone();
});

closeBtn?.addEventListener('click', () => {
  window.close();
});
