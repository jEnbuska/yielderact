import { createElement, Fragment, VNode } from '../jsx';

describe('createElement', () => {
  it('creates a VNode with the given type and props', () => {
    const vnode = createElement('div', { className: 'container' });
    expect(vnode.type).toBe('div');
    expect(vnode.props).toEqual({ className: 'container' });
    expect(vnode.children).toEqual([]);
  });

  it('uses an empty object when props are null', () => {
    const vnode = createElement('br', null);
    expect(vnode.props).toEqual({});
  });

  it('collects children into the children array', () => {
    const child = createElement('span', null, 'hello');
    const vnode = createElement('div', null, child);
    expect(vnode.children).toHaveLength(1);
    expect(vnode.children[0]).toBe(child);
  });

  it('flattens multiple children', () => {
    const vnode = createElement('ul', null, 'a', 'b', 'c');
    expect(vnode.children).toEqual(['a', 'b', 'c']);
  });

  it('stores a Fragment as the type', () => {
    const vnode = createElement(Fragment, null, 'a', 'b');
    expect(vnode.type).toBe(Fragment);
    expect(vnode.children).toEqual(['a', 'b']);
  });

  it('stores a function component as the type', () => {
    function* MyComponent() { yield createElement('div', null); }
    const vnode: VNode = createElement(MyComponent as unknown as VNode['type'], { id: '1' });
    expect(vnode.type).toBe(MyComponent);
    expect(vnode.props).toEqual({ id: '1' });
  });
});
