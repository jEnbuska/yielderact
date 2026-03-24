export class InvalidChildError extends Error {
  constructor(child: unknown) {
    super(`Invalid Child type error: ${typeof child}`);
  }
}
