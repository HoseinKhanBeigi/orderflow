import WebSocket from 'ws';

export interface JsonSocketOptions {
  url: string;
  label: string;
  pingMs?: number;
  ping?: (ws: WebSocket) => void;
  onOpen?: (ws: WebSocket) => void;
  onMessage: (msg: unknown, raw: string) => void;
  onConnection?: (connected: boolean, label: string) => void;
  isStopped: () => boolean;
}

export function openReconnectingJsonSocket(opts: JsonSocketOptions): () => void {
  let socket: WebSocket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const connect = (): void => {
    if (stopped || opts.isStopped()) return;
    const ws = new WebSocket(opts.url);
    socket = ws;

    ws.on('open', () => {
      if (stopped || opts.isStopped()) {
        safeCloseWebSocket(ws);
        return;
      }
      opts.onConnection?.(true, opts.label);
      opts.onOpen?.(ws);
      if (opts.ping && opts.pingMs) {
        clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) opts.ping?.(ws);
        }, opts.pingMs);
      }
    });

    ws.on('message', (raw) => {
      const text = String(raw);
      if (text === 'pong') return;
      if (text === 'ping') {
        ws.send('pong');
        return;
      }
      let msg: unknown;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      opts.onMessage(msg, text);
    });

    const retry = (): void => {
      clearInterval(pingTimer);
      pingTimer = undefined;
      if (socket === ws) socket = null;
      if (stopped || opts.isStopped()) return;
      opts.onConnection?.(false, opts.label);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2_000);
    };

    ws.on('close', retry);
    // Swallow close-while-connecting so feed restarts don't crash the process.
    ws.on('error', () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  };

  connect();

  return () => {
    stopped = true;
    clearInterval(pingTimer);
    clearTimeout(reconnectTimer);
    const ws = socket;
    socket = null;
    safeCloseWebSocket(ws);
  };
}

/** Close without crashing when the socket never finished opening. */
export function safeCloseWebSocket(ws: WebSocket | null | undefined): void {
  if (!ws) return;
  try {
    ws.removeAllListeners('message');
    ws.removeAllListeners('open');
    ws.removeAllListeners('close');
    ws.removeAllListeners('ping');
    ws.removeAllListeners('pong');
    // Keep a no-op error listener — closing a CONNECTING socket emits an error.
    ws.removeAllListeners('error');
    ws.on('error', () => {});
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.terminate();
    } else if (ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
  } catch {
    /* ignore */
  }
}
