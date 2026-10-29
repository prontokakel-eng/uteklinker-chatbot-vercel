import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/chat-ui.js', import.meta.url), 'utf8');
const tables = source.slice(source.indexOf('const uiCopy ='), source.indexOf('function showBanner('));
const language = source.slice(source.indexOf('let lang ='), source.indexOf('flagButtons.forEach(btn => btn.addEventListener'));
const automatic = source.slice(source.indexOf('function maybeAnnounceAutoLanguageSwitch('), source.indexOf('async function sendCore('));

test('manual and detected language switches localize notices and privacy without rewriting answers', () => {
  const expected = {SE:['svenska','Integritet'],DA:['dansk','Privatliv'],DE:['Deutsch','Datenschutz'],EN:['English','Privacy']};
  for (const [code,[name,privacy]] of Object.entries(expected)) {
    const nodes = new Map(['chat-privacy-notice','chat-privacy-link'].map(id => [id,{textContent:''}]));
    const retry = {dataset:{action:'retry'}}, copy = {dataset:{ui:'copy'}}, badge = {dataset:{source:'CONTACT'}};
    const messages = ['Synthetic existing answer'];
    const banners = [], events = []; let contactRefreshes = 0;
    const context = vm.createContext({langSelect:{value:'SE'},input:{},enterHelp:null,flagButtons:[],langBanner:{},
      document:{getElementById:id=>nodes.get(id),querySelectorAll:q=>q==='[data-action]'?[retry]:q==='[data-ui]'?[copy]:[badge]},
      window:{dispatchEvent:e=>events.push(e.type)},CustomEvent:class{constructor(type){this.type=type;}},
      updateEnterHelp(){},updateSoundUI(){},updateContacts(){contactRefreshes++;},
      showBanner(element,text){banners.push(text);},messages});
    vm.runInContext(tables + language + automatic + `setLanguage('${code}'); maybeAnnounceAutoLanguageSwitch('${code}');`, context);
    assert.match(banners[0],new RegExp(name));assert.match(banners[1],new RegExp(name));
    if(code!=='SE') assert.doesNotMatch(banners.join(' '),/Språk ändrat|Din fråga/);
    assert.match(nodes.get('chat-privacy-link').textContent,new RegExp(privacy));
    assert.ok(nodes.get('chat-privacy-notice').textContent.includes('OpenAI'));
    assert.equal(contactRefreshes,1,'contact labels must be reloaded for the new language');
    assert.deepEqual(events,['pronto-language-change']);
    assert.deepEqual(messages,['Synthetic existing answer']);
    assert.equal(retry.textContent,vm.runInContext(`uiCopy['${code}'].retry`,context));
    assert.equal(copy.textContent,vm.runInContext(`statusCopy['${code}'].copy`,context));
    assert.equal(badge.textContent,vm.runInContext(`statusCopy['${code}'].source + 'CONTACT'`,context));
  }
});
