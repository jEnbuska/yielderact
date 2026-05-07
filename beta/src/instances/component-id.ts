import { Component, Context, VNode } from "yract-beta";

let current = 0;

function getNextId() {
  return `<Instance>${current++}</Instance>`;
}

const wMap = new WeakMap<any, string>();
export function createComponentId(vnode: VNode<Component | Context>) {
  return wMap.getOrInsertComputed(vnode.type, getNextId);
}
