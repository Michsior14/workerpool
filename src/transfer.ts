/**
 * The helper class for transferring data from the worker to the main thread.
 */
export class Transfer<T> {
  message: T;
  transfer: Transferable[];

  /**
   * @param message The object to deliver to the main thread.
   * @param transfer An array of transferable Objects to transfer ownership of.
   */
  constructor(message: T, transfer: Transferable[]) {
    this.message = message;
    this.transfer = transfer;
  }
}
