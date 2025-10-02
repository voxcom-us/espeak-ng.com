import { listVoices, phonemizeText, setVoice } from './espeak.js';
import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app-shell">
    <div class="app-shell__backdrop" aria-hidden="true">
      <span class="glow glow--one"></span>
      <span class="glow glow--two"></span>
      <span class="glow glow--three"></span>
    </div>
    <header class="page-header">
      <div class="page-header__brand">
        <span class="logo">eSpeak<span>NG</span></span>
        <p class="tagline">WebAssembly phonemizer studio</p>
      </div>
      <a class="source-link" href="https://github.com/voxcom-us/espeak-ng.com" target="_blank" rel="noopener noreferrer">
        Source on GitHub
      </a>
    </header>
    <main class="workspace">
      <section class="hero">
        <p class="hero__eyebrow">Realtime phoneme playground</p>
        <h1>Transform text into precise phonemes instantly.</h1>
        <p class="hero__lead">Experiment with the official eSpeak NG engine compiled to WebAssembly. Try different voices, preview phonemes, and integrate them into your projects.</p>
        <div class="hero__meta">
          <span class="chip">⚡ Zero install</span>
          <span class="chip">🎯 Voice-aware results</span>
          <span class="chip">🧊 Powered by WebAssembly</span>
        </div>
      </section>
      <section class="panel">
        <header class="panel__header">
          <p class="panel__eyebrow">Interactive demo</p>
          <h2 class="panel__title">Phonemizer console</h2>
          <p class="panel__subtitle">Select a voice, enter text, and capture phoneme output ready for your pipeline.</p>
        </header>
        <form class="panel__form" id="phonemize-form">
          <label class="form-field">
            <span>Voice</span>
            <select id="voice-select" required disabled>
              <option value="" disabled selected>Loading voices…</option>
            </select>
          </label>
          <label class="form-field form-field--textarea">
            <span>Text to phonemize</span>
            <textarea id="text-input" rows="4" placeholder="Type something to phonemize" required disabled></textarea>
          </label>
          <div class="form-actions">
            <button type="submit" id="submit-button" disabled>Phonemize</button>
            <button type="button" id="reset-button" disabled>Reset</button>
          </div>
        </form>
        <section class="status" id="status">Loading module…</section>
        <section class="result" id="result" hidden>
          <h3>Phonemes</h3>
          <pre id="phoneme-output"></pre>
        </section>
      </section>
    </main>
    <footer class="page-footer">
      <p>Built with eSpeak NG · WebAssembly · Vite</p>
    </footer>
  </div>
`;

const voiceSelect = app.querySelector('#voice-select');
const textInput = app.querySelector('#text-input');
const submitButton = app.querySelector('#submit-button');
const resetButton = app.querySelector('#reset-button');
const status = app.querySelector('#status');
const resultSection = app.querySelector('#result');
const output = app.querySelector('#phoneme-output');
const form = app.querySelector('#phonemize-form');

function updateStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
}

function setFormEnabled(enabled) {
  voiceSelect.disabled = !enabled;
  textInput.disabled = !enabled;
  submitButton.disabled = !enabled;
  resetButton.disabled = !enabled;
}

function populateVoiceOptions(voices) {
  voiceSelect.innerHTML = '';

  const enrichedVoices = voices
    .map((voice) => ({ ...voice, id: voice.identifier || voice.name }))
    .filter((voice) => voice.id);

  enrichedVoices.sort((a, b) => a.id.localeCompare(b.id));

  for (const voice of enrichedVoices) {
    const option = document.createElement('option');
    option.value = voice.id;
    const languages = voice.languages ? ` · ${voice.languages}` : '';
    option.textContent = `${voice.id}${languages}`;
    voiceSelect.appendChild(option);
  }

  const defaultVoice = enrichedVoices.find((voice) => voice.id === 'gmw/en-US')
    || enrichedVoices.find((voice) => voice.id === 'en-gb')
    || enrichedVoices.find((voice) => voice.id.startsWith('en'))
    || enrichedVoices[0];

  if (defaultVoice) {
    voiceSelect.value = defaultVoice.id;
  }

  textInput.value = textInput.value || 'Hello world';
  return defaultVoice?.id ?? '';
}

async function init() {
  try {
    updateStatus('Loading eSpeak NG voices…');
    const voices = await listVoices();

    if (voices.length === 0) {
      updateStatus('No voices were found in the module.', true);
      return;
    }

    const defaultVoiceId = populateVoiceOptions(voices);

    if (defaultVoiceId) {
      updateStatus(`Setting default voice “${defaultVoiceId}”…`);
      const setVoiceResult = await setVoice(defaultVoiceId);
      if (setVoiceResult !== 0) {
        throw new Error(`Failed to set default voice (code ${setVoiceResult}).`);
      }
    }

    setFormEnabled(true);
    textInput.focus();
    updateStatus('Ready.');
  } catch (error) {
    console.error(error);
    setFormEnabled(false);
    updateStatus(error.message || 'Failed to initialize the eSpeak NG module.', true);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const text = textInput.value.trim();
  const voice = voiceSelect.value;

  if (!text) {
    updateStatus('Please enter text to phonemize.', true);
    textInput.focus();
    return;
  }

  setFormEnabled(false);
  updateStatus(`Phonemizing with voice “${voice}”…`);

  try {
    const setVoiceResult = await setVoice(voice);
    if (setVoiceResult !== 0) {
      throw new Error(`Failed to set voice (code ${setVoiceResult}).`);
    }

    const phonemes = await phonemizeText(text);
    output.textContent = phonemes || '[empty result]';
    resultSection.hidden = false;
    updateStatus('Done.');
  } catch (error) {
    console.error(error);
    updateStatus(error.message || 'Failed to phonemize text.', true);
  } finally {
    setFormEnabled(true);
  }
}

function handleReset() {
  textInput.value = '';
  output.textContent = '';
  resultSection.hidden = true;
  updateStatus('Ready.');
  textInput.focus();
}

form.addEventListener('submit', handleSubmit);
resetButton.addEventListener('click', handleReset);

init();
