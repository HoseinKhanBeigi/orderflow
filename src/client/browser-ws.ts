/**
 * Minimal `ws`-compatible wrapper around the browser WebSocket API so the
 * existing Node live-feed / json-socket code can run in a browser bundle.
 */
type Handler = (...args: unknown[]) => void;

export default class WebSocketBrowser {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  private readonly ws: WebSocket;
  private readonly handlers = new Map<string, Set<Handler>>();

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener('open', () => this.emit('open'));
    this.ws.addEventListener('message', (ev) => this.emit('message', ev.data));
    this.ws.addEventListener('close', () => this.emit('close'));
    this.ws.addEventListener('error', () => this.emit('error'));
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  get bufferedAmount(): number {
    return this.ws.bufferedAmount;
  }

  on(event: string, handler: Handler): this {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return this;
  }

  once(event: string, handler: Handler): this {
    const wrap: Handler = (...args) => {
      this.off(event, wrap);
      handler(...args);
    };
    return this.on(event, wrap);
  }

  off(event: string, handler: Handler): this {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  removeListener(event: string, handler: Handler): this {
    return this.off(event, handler);
  }

  removeAllListeners(event?: string): this {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
    return this;
  }

  send(data: string): void {
    this.ws.send(data);
  }

  close(code?: number, reason?: string): void {
    try {
      this.ws.close(code, reason);
    } catch {
      /* ignore */
    }
  }

  /** Node `ws` API — browser close is enough. */
  terminate(): void {
    this.close();
  }

  ping(): void {
    /* browser WebSocket has no app-level ping */
  }

  private emit(event: string, ...args: unknown[]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(...args);
      } catch (err) {
        console.error('[browser-ws] handler error', err);
      }
    }
  }
}
