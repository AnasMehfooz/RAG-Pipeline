// WebSocket client with auto-reconnect (exponential backoff).
export function connect({ url, onState, onStatus }) {
  let ws, attempt = 0, timer, closed = false;
  function open() {
    onStatus('connecting', attempt);
    try { ws = new WebSocket(url); } catch { return retry(); }
    ws.onopen = () => { attempt = 0; onStatus('connected'); };
    ws.onmessage = (e) => {
      try { const m = JSON.parse(e.data); if (m && m.type === 'state') onState(m); } catch {}
    };
    ws.onclose = () => { if (!closed) retry(); };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  function retry() {
    const delay = Math.min(5000, 500 * 2 ** attempt++);
    onStatus('disconnected', attempt, delay);
    clearTimeout(timer);
    timer = setTimeout(open, delay);
  }
  open();
  return {
    send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); },
    close() { closed = true; clearTimeout(timer); ws && ws.close(); },
  };
}
