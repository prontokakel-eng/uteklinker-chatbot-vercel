import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile(new URL('../public/embed.js', import.meta.url), 'utf8');
function page({ readyState = 'complete', chatUrl } = {}) {
 const nodes = [], listeners = {}, created = [];
 const document = {
  readyState, currentScript: { src: 'https://chat.example/embed.js', dataset: chatUrl ? { chatUrl } : {} },
  getElementById: id => nodes.find(node => node.id === id) || null,
  addEventListener(name, fn) { listeners[name] = fn; },
  createElement(tag) {
   const node = { tag, style: {}, attributes: {}, events: {}, setAttribute(k,v) { this.attributes[k] = v; }, addEventListener(name, fn) { this.events[name] = fn; }, remove() { nodes.splice(nodes.indexOf(this), 1); } };
   created.push(node); return node;
  },
  body: { appendChild(node) { nodes.push(node); } },
 };
 const context = { document, URL, location: { href: 'https://shop.example/products' } };
 for (const [target, key] of [[document, 'cookie'], [context, 'localStorage'], [context, 'sessionStorage']]) Object.defineProperty(target, key, { get() { throw Error('Browser storage is blocked'); } });
 context.fetch = () => { throw Error('Launcher must not call an API'); };
 const sandbox = vm.createContext(context);
 return { document, nodes, listeners, created, run: () => vm.runInContext(source, sandbox) };
}
test('embed makes no iframe or API request before explicit opening, even with storage blocked', () => {
 const p = page(); p.run();
 assert.deepEqual(p.created.map(node => node.tag), ['button']);
 const button = p.nodes[0]; assert.equal(button.attributes['aria-expanded'], 'false');
 button.events.click();
 const frame = p.nodes.find(node => node.tag === 'iframe');
 assert.equal(frame.src, 'https://chat.example/');
 assert.equal(frame.referrerPolicy, 'no-referrer');
 assert.equal(button.attributes['aria-expanded'], 'true');
 assert.equal(p.listeners.message, undefined);
 assert.equal(p.listeners.DOMContentLoaded, undefined);
 button.events.click();
 assert.ok(!p.nodes.includes(frame));
 assert.equal(button.attributes['aria-expanded'], 'false');
 button.events.click();
 assert.notEqual(p.nodes.find(node => node.tag === 'iframe'), frame);
});
test('locally served launcher supports an explicit HTTPS chat origin and late mounting', () => {
 const p = page({ readyState: 'loading', chatUrl: 'https://preview.example/' }); p.run();
 assert.equal(p.created.length, 0);
 p.listeners.DOMContentLoaded(); p.run();
 assert.equal(p.nodes.length, 1, 'duplicate script must not add another launcher');
 p.nodes[0].events.click();
 assert.equal(p.nodes[1].src, 'https://preview.example/');
});
test('insecure and executable iframe targets are not mounted', () => {
 for (const chatUrl of ['http://chat.example/', 'javascript:alert(1)']) {
  const p = page({ chatUrl }); p.run(); assert.equal(p.nodes.length, 0);
 }
});
