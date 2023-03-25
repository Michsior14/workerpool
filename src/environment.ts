import { requireFoolWebpack } from './requireFoolWebpack';

const tryRequireFoolWebpack = (module: string) => {
  try {
    return requireFoolWebpack(module);
  } catch (err) {
    return null;
  }
};

// source: https://github.com/flexdinesh/browser-or-node
export const isNode = (nodeProcess: NodeJS.Process): boolean => {
  return (
    typeof nodeProcess !== 'undefined' &&
    nodeProcess.versions != null &&
    nodeProcess.versions.node != null
  );
};

// determines the JavaScript platform: browser or node
export const platform =
  typeof process !== 'undefined' && isNode(process) ? 'node' : 'browser';

// determines whether the code is running in main thread or not
// note that in node.js we have to check both worker_thread and child_process
const workerThreads = tryRequireFoolWebpack('worker_threads');
export const isMainThread =
  platform === 'node'
    ? (!workerThreads || workerThreads.isMainThread) && !process.connected
    : typeof Window !== 'undefined';

// determines the number of cpus available
export const cpus =
  platform === 'browser'
    ? self.navigator.hardwareConcurrency
    : requireFoolWebpack('os').cpus().length;
