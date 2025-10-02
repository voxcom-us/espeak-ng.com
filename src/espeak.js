const RAW_WASM_URL = 'https://raw.githubusercontent.com/voxcom-us/espeak-ng.com/refs/heads/main/public/espeakng.wasm';
let modulePromise;

async function createModule() {
  if (typeof window === 'undefined') {
    throw new Error('ESpeakNG module requires a browser environment.');
  }

  if (typeof window.createESpeakNg !== 'function') {
    throw new Error('Global createESpeakNg factory is not available.');
  }

  const module = await window.createESpeakNg({
    locateFile(path) {
      if (path === 'espeakng.wasm') {
        return RAW_WASM_URL;
      }
      return path;
    },
  });

  module._espeak_Initialize(0, 0, 0, 0);
  return module;
}

export async function getModule() {
  if (!modulePromise) {
    modulePromise = createModule();
  }
  return modulePromise;
}

function withCString(module, text, callback) {
  const byteLength = module.lengthBytesUTF8(text) + 1;
  const ptr = module._malloc(byteLength);
  try {
    module.stringToUTF8(text, ptr, byteLength);
    return callback(ptr);
  } finally {
    module._free(ptr);
  }
}

export async function listVoices() {
  const module = await getModule();
  const voices = [];
  const listPtr = module._espeak_ListVoices();

  let offset = 0;
  while (true) {
    const voicePtr = module.getValue(listPtr + offset, 'i32');
    if (!voicePtr) {
      break;
    }

    const name = module.UTF8ToString(module.getValue(voicePtr, 'i32'));
    const languages = module.UTF8ToString(module.getValue(voicePtr + 4, 'i32'));
    const identifier = module.UTF8ToString(module.getValue(voicePtr + 8, 'i32'));
    const gender = module.getValue(voicePtr + 12, 'i8');
    const age = module.getValue(voicePtr + 13, 'i8');
    const variant = module.getValue(voicePtr + 14, 'i8');

    voices.push({ name, languages, identifier, gender, age, variant });
    offset += 4;
  }

  return voices;
}

export async function setVoice(name) {
  const module = await getModule();
  return withCString(module, name, (ptr) => module._espeak_SetVoiceByName(ptr));
}

export async function phonemizeText(text) {
  const module = await getModule();

  return withCString(module, text, (textPtr) => {
    const textPtrPtr = module._malloc(4);
    module.setValue(textPtrPtr, textPtr, 'i32');

    let result = '';

    try {
      while (true) {
        const resultPtr = module._espeak_TextToPhonemes(textPtrPtr, 0, 3);
        const phonemes = module.UTF8ToString(resultPtr);
        if (!phonemes) {
          break;
        }

        result += phonemes;

        const newPtr = module.getValue(textPtrPtr, 'i32');
        const consumedBytes = newPtr - textPtr;
        const consumedText = consumedBytes > 0 ? text.substring(0, consumedBytes - 1) : text;
        const match = consumedText.match(/([.,?!;:])\s*$/)?.[1];
        if (match) {
          result += match + ' ';
        }
      }
      return result.trim();
    } finally {
      module._free(textPtrPtr);
    }
  });
}
