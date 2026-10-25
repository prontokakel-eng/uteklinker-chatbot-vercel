// Brand presentation only. Answers, evidence and contact availability come from
// the existing pipeline. No demo replies, storage, uploads or tracking.
(() => {
  const copy = {
    SE: {ai:'AI-assistent',skip:'Hoppa till inmatning',conversation:'Konversation',loading:'Svar hämtas',title:'Klinkerdäck rådgivare',subtitle:'AI-assistent · hjälp för din uteplats',language:'Språk',welcome:'Vi hjälper dig\nmed din uteplats.',intro:'Fråga om uteklinker, montering eller ditt projekt. Du kan också få kontakt med oss personligen.',tiles:'Hitta rätt uteklinker',installation:'Hur fungerar monteringen?',project:'Jag planerar en uteplats',help:'Nära till personlig hjälp',contact:'Kontakta oss personligen',contactTitle:'Personlig kontakt',message:'Skriv din fråga här',send:'Skicka meddelande',newChat:'Ny konversation',close:'Stäng chatten och rensa samtalet',expand:'Ändra chattens storlek',closeContact:'Stäng kontaktalternativ',prompts:{tiles:'Vad bör jag tänka på när jag väljer uteklinker?',installation:'Hur fungerar montering av klinkerdäck?',project:'Jag planerar en uteplats. Vad behöver jag tänka på?'}},
    DA: {ai:'AI-assistent',skip:'Gå til beskedfeltet',conversation:'Samtale',loading:'Henter svar',title:'Klinkerdäck rådgiver',subtitle:'AI-assistent · hjælp til din terrasse',language:'Sprog',welcome:'Vi hjælper dig\nmed din terrasse.',intro:'Spørg om udendørsfliser, montering eller dit projekt. Du kan også kontakte os personligt.',tiles:'Find de rette udendørsfliser',installation:'Hvordan fungerer monteringen?',project:'Jeg planlægger en terrasse',help:'Personlig hjælp er tæt på',contact:'Kontakt os personligt',contactTitle:'Personlig kontakt',message:'Skriv dit spørgsmål her',send:'Send besked',newChat:'Ny samtale',close:'Luk chatten og ryd samtalen',expand:'Skift chattens størrelse',closeContact:'Luk kontaktmuligheder',prompts:{tiles:'Hvad skal jeg tænke på, når jeg vælger udendørsfliser?',installation:'Hvordan fungerer montering af udendørsfliser på fødder?',project:'Jeg planlægger en terrasse. Hvad skal jeg tænke på?'}},
    DE: {ai:'KI-Assistent',skip:'Zum Nachrichtenfeld springen',conversation:'Gespräch',loading:'Antwort wird geladen',title:'Klinkerdäck Beratung',subtitle:'KI-Assistent · Hilfe für Ihre Terrasse',language:'Sprache',welcome:'Wir helfen Ihnen\nbei Ihrer Terrasse.',intro:'Fragen Sie nach Außenfliesen, Verlegung oder Ihrem Projekt. Sie können uns auch persönlich kontaktieren.',tiles:'Passende Außenfliesen finden',installation:'Wie funktioniert die Verlegung?',project:'Ich plane eine Terrasse',help:'Persönlich Kontakt aufnehmen',contact:'Persönlich Kontakt aufnehmen',contactTitle:'Persönlicher Kontakt',message:'Schreiben Sie hier Ihre Frage',send:'Nachricht senden',newChat:'Neues Gespräch',close:'Chat schließen und Gespräch löschen',expand:'Chatgröße ändern',closeContact:'Kontaktmöglichkeiten schließen',prompts:{tiles:'Worauf sollte ich bei der Auswahl von Außenfliesen achten?',installation:'Wie funktioniert die Verlegung von Außenfliesen auf Stelzlagern?',project:'Ich plane eine Terrasse. Was sollte ich beachten?'}},
    EN: {ai:'AI assistant',skip:'Skip to message input',conversation:'Conversation',loading:'Loading answer',title:'Klinkerdäck advice',subtitle:'AI assistant · help for your outdoor space',language:'Language',welcome:'Let us help with\nyour outdoor space.',intro:'Ask about outdoor tiles, installation or your project. You can also contact us personally.',tiles:'Find the right outdoor tiles',installation:'How does installation work?',project:'I am planning a patio',help:'Personal help is close at hand',contact:'Contact us personally',contactTitle:'Personal contact',message:'Type your question here',send:'Send message',newChat:'New conversation',close:'Close chat and clear conversation',expand:'Change chat size',closeContact:'Close contact options',prompts:{tiles:'What should I consider when choosing outdoor tiles?',installation:'How does installation of outdoor tiles on pedestals work?',project:'I am planning a patio. What should I consider?'}},
  };
  const select = document.getElementById('langSelect');
  const dialog = document.getElementById('contact-dialog');
  const messages = document.getElementById('messages');
  const welcome = document.getElementById('welcome');
  function render() {
    const language = select.value;
    const text = copy[language] || copy.SE;
    document.documentElement.lang = {SE:'sv',DA:'da',DE:'de',EN:'en'}[language] || 'sv';
    for (const [id,key] of Object.entries({'brand-title':'title','brand-subtitle':'subtitle','language-label':'language','welcome-title':'welcome','welcome-description':'intro','personal-help':'help','contact-title':'contactTitle','message-label':'message','ai-label':'ai','skip-input':'skip'})) document.getElementById(id).textContent = text[key];
    document.getElementById('chat-region').setAttribute('aria-label',text.conversation);
    document.getElementById('loader').setAttribute('aria-label',text.loading);
    document.getElementById('welcome-title').style.whiteSpace = 'pre-line';
    for (const [id,key] of Object.entries({'send-btn':'send','new-chat-btn':'newChat','close-chat-btn':'close','expand-chat-btn':'expand','close-contact':'closeContact'})) { const button = document.getElementById(id); button.setAttribute('aria-label',text[key]); button.title = text[key]; }
    document.querySelectorAll('[data-quick]').forEach(button => { button.querySelector('span').textContent = text[button.dataset.quick]; });
    document.querySelectorAll('[data-open-contact]').forEach(button => { button.textContent = text.contact; });
    // Only an allowlisted language code leaves the frame; never conversation data.
    if (window.parent !== window) window.parent.postMessage({type:'pronto-chat:language',language:copy[language] ? language : 'SE'},'*');
  }
  document.querySelectorAll('[data-quick]').forEach(button => button.addEventListener('click', () => {
    if (document.getElementById('send-btn').disabled) return;
    const text = copy[select.value] || copy.SE;
    const input = document.getElementById('user-input');
    input.value = text.prompts[button.dataset.quick];
    document.getElementById('send-btn').click();
  }));
  let opener;
  document.querySelectorAll('[data-open-contact]').forEach(button => button.addEventListener('click', () => { opener = button; dialog.showModal(); document.getElementById('close-contact').focus(); }));
  document.getElementById('close-contact').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener?.focus());
  const updateWelcome = () => { welcome.hidden = messages.children.length > 0; };
  new MutationObserver(updateWelcome).observe(messages,{childList:true});
  window.addEventListener('pronto-language-change',render);
  if (window.parent !== window) {
    document.getElementById('close-chat-btn').hidden = false;
    document.getElementById('expand-chat-btn').hidden = false;
    // Commands contain no conversation data. The host verifies origin and frame.
    document.getElementById('close-chat-btn').addEventListener('click', () => window.parent.postMessage({type:'pronto-chat:close'},'*'));
    document.getElementById('expand-chat-btn').addEventListener('click', () => window.parent.postMessage({type:'pronto-chat:toggle-size'},'*'));
  }
  render(); updateWelcome();
})();
