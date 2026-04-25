type VoidHandler = () => void;
type Handler<T> = (payload: T) => void;

interface ServerError {
  status: number;
  message: string;
  retry: () => Promise<Response>;
}

interface Toast {
  id: string;
  message: string;
}

class VoidBus {
  private handlers = new Set<VoidHandler>();
  on(h: VoidHandler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(): void {
    for (const h of this.handlers) h();
  }
}

class Bus<T> {
  private handlers = new Set<Handler<T>>();
  on(h: Handler<T>): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(p: T): void {
    for (const h of this.handlers) h(p);
  }
}

export const on401 = new VoidBus();
export const on403 = new Bus<Toast>();
export const on410 = new VoidBus();
export const on500 = new Bus<ServerError>();
