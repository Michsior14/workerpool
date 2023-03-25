import { Transfer } from './transfer';
import { WorkerOptions, WorkerRequest } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;
type Methods = Record<string, AnyFunction>;

/**
 * worker must be started as a child process or a web worker.
 * It listens for RPC messages from the parent process.
 */

// source of inspiration: https://github.com/sindresorhus/require-fool-webpack
const requireFoolWebpack = eval(
  "typeof require !== 'undefined'" +
    ' ? require' +
    ' : function (module) { throw new Error(\'Module " + module + " not found.\') }'
);

/**
 * Special message sent by parent which causes the worker to terminate itself.
 * Not a "message object"; this string is the entire message.
 */
const TERMINATE_METHOD_ID = '__workerpool-terminate__' as const;

// var nodeOSPlatform = require('./environment').nodeOSPlatform;

// create a worker API for sending and receiving messages which works both on
// node.js and in the browser
const worker = {
  exit: () => void 0,
} as NodeJS.Process;

if (
  typeof self !== 'undefined' &&
  typeof postMessage === 'function' &&
  typeof addEventListener === 'function'
) {
  // worker in the browser
  worker.on = (event, callback) => {
    addEventListener(event as string, (message) => {
      (callback as AnyFunction)((message as Event & { data: unknown }).data);
    });
    return worker;
  };
  worker.send = (message): boolean => {
    postMessage(message);
    return true;
  };
} else if (typeof process !== 'undefined') {
  // node.js

  let WorkerThreads;
  try {
    WorkerThreads = requireFoolWebpack('worker_threads');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      error.code === 'MODULE_NOT_FOUND'
    ) {
      // no worker_threads, fallback to sub-process based workers
    } else {
      throw error;
    }
  }

  if (
    WorkerThreads &&
    /* if there is a parentPort, we are in a WorkerThread */
    WorkerThreads.parentPort !== null
  ) {
    const parentPort = WorkerThreads.parentPort;
    worker.send = parentPort.postMessage.bind(parentPort);
    worker.on = parentPort.on.bind(parentPort);
    worker.exit = process.exit.bind(process);
  } else {
    worker.on = process.on.bind(process);
    // ignore transfer argument since it is not supported by process
    worker.send = (message) => {
      process.send(message);
      return true;
    };
    // register disconnect handler only for subprocess worker to exit when parent is killed unexpectedly
    worker.on('disconnect', () => {
      process.exit(1);
    });
    worker.exit = process.exit.bind(process);
  }
} else {
  throw new Error('Script must be executed as a worker');
}

const convertError = <T>(error: T) => {
  return Object.getOwnPropertyNames(error).reduce((product, name) => {
    return Object.defineProperty(product, name, {
      value: error[name as keyof T],
      enumerable: true,
    });
  }, {});
};

/**
 * Test whether a value is a Promise via duck typing.
 * @returns Returns true when given value is an object
 *                    having functions `then` and `catch`.
 */
const isPromise = (value: unknown): value is Promise<unknown> => {
  return (
    value &&
    typeof (value as Promise<unknown>).then === 'function' &&
    typeof (value as Promise<unknown>).catch === 'function'
  );
};

// functions available externally
const workerMethods = {
  /**
   * Execute a function with provided arguments
   * @param  fn     Stringified function
   * @param args  Function arguments
   */
  run: (fn: string, args?: unknown[]) => {
    const f = new Function('return (' + fn + ').apply(null, arguments);');
    return f.apply(f, args);
  },

  /**
   * Get a list with methods available on this worker
   * @return methods
   */
  methods: () => {
    return Object.keys(workerMethods);
  },
};

/**
 * Custom handler for when the worker is terminated.
 */
let terminationHandler: WorkerOptions['onTerminate'];

/**
 * Cleanup and exit the worker.
 * @param {Number} code
 * @returns
 */
const cleanupAndExit = (code: number) => {
  const _exit = function () {
    worker.exit(code);
  };

  if (!terminationHandler) {
    return _exit();
  }

  const result = terminationHandler(code);
  if (isPromise(result)) {
    result.then(_exit, _exit);
  } else {
    _exit();
  }
};

let currentRequestId: number | undefined;

worker.on('message', (request: typeof TERMINATE_METHOD_ID | WorkerRequest) => {
  if (request === TERMINATE_METHOD_ID) {
    return cleanupAndExit(0);
  }
  try {
    const method = (workerMethods as Methods)[request.method];

    if (method) {
      currentRequestId = request.id;

      // execute the function
      const result = method.apply(method, request.params);

      if (isPromise(result)) {
        // promise returned, resolve this and then return
        result
          .then(function (result) {
            if (result instanceof Transfer) {
              worker.send(
                {
                  id: request.id,
                  result: result.message,
                  error: null,
                },
                result.transfer
              );
            } else {
              worker.send({
                id: request.id,
                result,
                error: null,
              });
            }
            currentRequestId = null;
          })
          .catch(function (err) {
            worker.send({
              id: request.id,
              result: null,
              error: convertError(err),
            });
            currentRequestId = null;
          });
      } else {
        // immediate result
        if (result instanceof Transfer) {
          worker.send(
            {
              id: request.id,
              result: result.message,
              error: null,
            },
            result.transfer
          );
        } else {
          worker.send({
            id: request.id,
            result,
            error: null,
          });
        }

        currentRequestId = null;
      }
    } else {
      throw new Error('Unknown method "' + request.method + '"');
    }
  } catch (err) {
    worker.send({
      id: request.id,
      result: null,
      error: convertError(err),
    });
  }
});

/**
 * Register methods to the worker
 */
export const register = (methods?: Methods, options?: WorkerOptions) => {
  if (methods) {
    for (const name in methods) {
      if (methods.hasOwnProperty(name)) {
        (workerMethods as Methods)[name] = methods[name];
      }
    }
  }

  if (options) {
    terminationHandler = options.onTerminate;
  }

  worker.send('ready');
};

export const emit = <T extends Transfer<unknown> | unknown>(payload: T) => {
  if (currentRequestId) {
    if (payload instanceof Transfer) {
      worker.send(
        {
          id: currentRequestId,
          isEvent: true,
          payload: payload.message,
        },
        payload.transfer
      );
      return;
    }

    worker.send({
      id: currentRequestId,
      isEvent: true,
      payload,
    });
  }
};
