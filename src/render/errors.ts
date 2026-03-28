export class InvalidChildError extends Error {
  constructor(child: unknown) {
    super(`Invalid Child type error: ${typeof child}`);
  }
}

export class SetStateDuringRenderError extends Error {
  constructor(source = "Anonymous", target = "Anonymous") {
    super(`setState cannot be called during render. "${source}" called setState on "${target}".`);
  }
}
