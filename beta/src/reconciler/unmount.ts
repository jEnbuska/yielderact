export function removeRange(first: Node, last: Node) {
  const parentNode = first.parentNode!;
  let cur: Node | null = first;
  while (cur) {
    const next: Node | null = cur === last ? null : cur.nextSibling;
    parentNode.removeChild(cur);
    cur = next;
  }
}
