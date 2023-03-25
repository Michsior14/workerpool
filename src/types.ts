import type * as cp from 'child_process';
import type * as wt from 'worker_threads';

export interface WorkerCreationOptions {
  /** For process worker type. An array passed as args to child_process.fork */
  forkArgs?: string[] | undefined;

  /**
   * For process worker type. An object passed as options to child_process.fork.
   */
  forkOpts?: cp.ForkOptions | undefined;

  /**
   * For worker worker type. An object passed to worker_threads.options.
   */
  workerThreadOpts?: wt.WorkerOptions | undefined;
}

export interface WorkerHandlerOptions extends WorkerCreationOptions {
  script?: string | undefined;
}

export interface WorkerPoolOptions extends WorkerCreationOptions {
  /**
   * The minimum number of workers that must be initialized and kept available.
   * Setting this to 'max' will create maxWorkers default workers.
   */
  minWorkers?: number | 'max' | undefined;
  /**
   * The default number of maxWorkers is the number of CPU's minus one.
   * When the number of CPU's could not be determined (for example in older browsers), maxWorkers is set to 3.
   */
  maxWorkers?: number | undefined;

  /**
   * - In case of `'auto'` (default), workerpool will automatically pick a suitable type of worker:
   *   when in a browser environment, `'web'` will be used. When in a node.js environment, `worker_threads` will be used
   *   if available (Node.js >= 11.7.0), else `child_process` will be used.
   * - In case of `'web'`, a Web Worker will be used. Only available in a browser environment.
   * - In case of `'process'`, `child_process` will be used. Only available in a node.js environment.
   * - In case of `'thread'`, `worker_threads` will be used. If `worker_threads` are not available, an error is thrown.
   *   Only available in a node.js environment.
   */
  workerType?: 'auto' | 'web' | 'process' | 'thread' | undefined;

  /**
   * The timeout in milliseconds to wait for a worker to cleanup it's resources on termination before stopping it forcefully.
   *
   * @default 1000.
   */
  workerTerminateTimeout?: number | undefined;

  /**
   * A callback that is called whenever a worker is being created.
   * It can be used to allocate resources for each worker for example.
   * Optionally, this callback can return an object containing one or more of the above properties.
   * The provided properties will be used to override the Pool properties for the worker being created.
   */
  onCreateWorker?:
    | ((options: WorkerHandlerOptions) => WorkerHandlerOptions)
    | undefined;

  /**
   * A callback that is called whenever a worker is being terminated.
   * It can be used to release resources that might have been allocated for this specific worker.
   * The callback is passed as argument an object as described for onCreateWorker, with each property sets with the value for the worker being terminated.
   */
  onTerminateWorker?:
    | ((options: WorkerHandlerOptions) => WorkerHandlerOptions)
    | undefined;
}

export interface ExecOptions {
  on?: <T>(payload: T) => unknown;
  transfer?: Transferable[];
}

export interface WorkerOptions {
  onTerminate?: <T>(code?: number) => Promise<T> | void;
}

export interface WorkerRequest {
  id: number;
  method: string;
  params: unknown[];
}
