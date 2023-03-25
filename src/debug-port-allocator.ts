const MAX_PORTS = 65535;

export class DebugPortAllocator {
  ports: Record<number, boolean> = {};
  length = 0;

  nextAvailableStartingAt(starting: number): number {
    while (this.ports[starting] === true) {
      starting++;
    }

    if (starting >= MAX_PORTS) {
      throw new Error(
        'WorkerPool debug port limit reached: ' + starting + '>= ' + MAX_PORTS
      );
    }

    this.ports[starting] = true;
    this.length++;
    return starting;
  }

  releasePort(port: number): void {
    delete this.ports[port];
    this.length--;
  }
}
