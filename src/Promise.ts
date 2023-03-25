/**
 * Create a cancellation error
 */
class CancellationError extends Error {
  name = 'CancellationError';

  constructor(public message = 'promise cancelled') {
    super(message);
  }
}

/**
 * Create a timeout error
 */
class TimeoutError extends Error {
  constructor(public message = 'timeout exceeded') {
    super(message);
  }
}

interface Resolver<TResult> {
  resolve: (value: TResult) => void;
  reject: (reason?: unknown) => void;
  // eslint-disable-next-line no-use-before-define
  promise: Promise<TResult>;
}

/**
 * Promise
 *
 * Inspired by https://gist.github.com/RubaXa/8501359 from RubaXa <trash@rubaxa.org>
 */
export class Promise<T> implements PromiseLike<T> {
  private _onSuccess: ((value: unknown) => void)[] = [];
  private _onFail: ((reason: unknown) => void)[] = [];

  // status
  resolved = false;
  rejected = false;
  pending = true;

  /**
   * Create a promise which resolves when all provided promises are resolved,
   * and fails when any of the promises resolves.
   */
  static all<
    T extends readonly unknown[] | [],
    TResult = { -readonly [P in keyof T]: Awaited<T[P]> }
  >(promises: T): Promise<TResult> {
    type TItem = TResult[keyof TResult];
    return new Promise((resolve, reject) => {
      let remaining = promises.length;
      const results: TItem[] = [];

      if (remaining) {
        promises.forEach((p: Promise<TItem>, i) => {
          p.then(
            (result) => {
              results[i] = result;
              remaining--;
              if (remaining === 0) {
                resolve(results as TResult);
              }
            },
            (error) => {
              remaining = 0;
              reject(error);
            }
          );
        });
      } else {
        resolve(results as TResult);
      }
    });
  }

  /**
   * Create a promise resolver
   */
  static defer<TResult>(): Resolver<TResult> {
    const resolver = {} as Resolver<TResult>;

    resolver.promise = new Promise((resolve, reject) => {
      resolver.resolve = resolve;
      resolver.reject = reject;
    });

    return resolver;
  }

  static CancellationError = CancellationError;
  static TimeoutError = TimeoutError;

  /**
   * @param handler Called as handler
   * @param parent Parent promise for propagation of cancel and timeout
   */
  constructor(
    handler: (
      resolve: (value: T) => void,
      reject: (reason?: unknown) => void
    ) => void,
    private readonly parent?: Promise<unknown>
  ) {
    if (!(this instanceof Promise)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    if (typeof handler !== 'function') {
      throw new SyntaxError(
        'Function parameter handler(resolve, reject) missing'
      );
    }

    // attach handler passing the resolve and reject functions
    handler(
      (result) => this._resolve(result),
      (error) => this._reject(error)
    );
  }

  /**
   * Add an onSuccess callback and optionally an onFail callback to the Promise
   */
  public then<TResult1 = T, TResult2 = never>(
    onSuccess?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null,
    onFail?:
      | ((reason: unknown) => TResult2 | Promise<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return new Promise<TResult1 | TResult2>((resolve, reject) => {
      const s = onSuccess ? this._then(onSuccess, resolve, reject) : resolve;
      const f = onFail ? this._then(onFail, resolve, reject) : reject;
      this._process(s, f);
    }, this);
  }

  /**
   * Cancel te promise. This will reject the promise with a CancellationError
   */
  public cancel(): this {
    if (this.parent) {
      this.parent.cancel();
    } else {
      this._reject(new CancellationError());
    }
    return this;
  }

  /**
   * Set a timeout for the promise. If the promise is not resolved within
   * the time, the promise will be cancelled and a TimeoutError is thrown.
   * If the promise is resolved in time, the timeout is removed.
   *
   * @param delay Delay in milliseconds
   */
  public timeout(delay?: number): this {
    if (this.parent) {
      this.parent.timeout(delay);
    } else {
      const timer = setTimeout(function () {
        this._reject(
          new TimeoutError('Promise timed out after ' + delay + ' ms')
        );
      }, delay);

      this.always(() => clearTimeout(timer));
    }

    return this;
  }

  /**
   * Execute given callback when the promise either resolves or rejects.
   * @param fn
   */
  public always<TResult = T>(
    fn?: ((value: T) => TResult | Promise<TResult>) | undefined | null
  ): Promise<T | TResult> {
    return this.then(fn, fn);
  }

  /**
   * Add an onFail callback to the Promise
   */
  public catch<TResult = never>(
    onFail?:
      | ((reason: unknown) => TResult | Promise<TResult>)
      | undefined
      | null
  ): Promise<T | TResult> {
    return this.then(null, onFail);
  }

  /**
   * Process onSuccess and onFail callbacks: add them to the queue.
   * Once the promise is resolve, the function _promise is replace.
   */
  private _process(
    onSuccess: (value: unknown) => void,
    onFail: (reason: unknown) => void
  ): void {
    this._onSuccess.push(onSuccess);
    this._onFail.push(onFail);
  }

  /**
   * Execute given callback, then call resolve/reject based on the returned result
   */
  private _then<TResult>(
    callback: (value: T) => TResult | Promise<TResult>,
    resolve: (value: TResult) => void,
    reject: (reason: unknown) => void
  ) {
    const isPromise = (value: unknown): value is Promise<TResult> =>
      value &&
      typeof (value as Promise<TResult>).then === 'function' &&
      typeof (value as Promise<TResult>).catch === 'function';

    return (result: T) => {
      try {
        const res = callback(result);
        if (isPromise(res)) {
          // method returned a promise
          res.then(resolve, reject);
        } else {
          resolve(res);
        }
      } catch (error) {
        reject(error);
      }
    };
  }

  /**
   * Resolve the promise
   */
  private _resolve(result: T): this | void {
    // update status
    this.resolved = true;
    this.rejected = false;
    this.pending = false;

    this._onSuccess.forEach((fn) => fn(result));
    this._process = (onSuccess) => onSuccess(result);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this._resolve = this._reject = () => {};

    return this;
  }

  /**
   * Reject the promise
   */
  private _reject(error: unknown): this | void {
    // update status
    this.resolved = false;
    this.rejected = true;
    this.pending = false;

    this._onFail.forEach((fn) => fn(error));
    this._process = (_onSuccess, onFail) => onFail(error);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this._resolve = this._reject = () => {};

    return this;
  }

  // TODO: add support for Promise.catch(Error, callback)
  // TODO: add support for Promise.catch(Error, Error, callback)
}
