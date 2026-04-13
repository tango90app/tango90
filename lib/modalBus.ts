/**
 * Bus de modal singleton.
 * Cada modal se registra al montar y se desregistra al desmontar.
 * Antes de abrirse, un modal llama closeAll() para cerrar cualquier otro.
 */

type Closer = () => void
const registry = new Set<Closer>()

export const modalBus = {
  register(closer: Closer): () => void {
    registry.add(closer)
    return () => registry.delete(closer)
  },
  closeAll() {
    registry.forEach(fn => fn())
  },
}
