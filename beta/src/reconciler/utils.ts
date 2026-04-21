import type { UpdateResult } from "./types";

export function updateResult(result: Exclude<UpdateResult, void>): UpdateResult {
  return result;
}
