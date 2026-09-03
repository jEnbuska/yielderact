import { Search } from "./types";

export function parseSearch(href: string): Search {
  const url = new URL(href, location.origin);
  return Object.fromEntries(new URLSearchParams(url.search).entries());
}
