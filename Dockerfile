# syntax=docker/dockerfile:1

FROM debian:12.12 AS builder

WORKDIR /wasm

RUN apt-get update \
 && apt-get install --yes --no-install-recommends \
    build-essential \
    cmake \
    ca-certificates \
    curl \
    pkg-config \
    git \
    python3 \
    autogen \
    automake \
    autoconf \
    libtool \
 && rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-lc"]

# Emscripten SDK
RUN git clone --depth 1 https://github.com/emscripten-core/emsdk.git modules/emsdk
RUN cd modules/emsdk \
 && ./emsdk install 4.0.14 \
 && ./emsdk activate 4.0.14

RUN source /wasm/modules/emsdk/emsdk_env.sh \
 && sed -i -E 's/int\s+(iswalnum|iswalpha|iswblank|iswcntrl|iswgraph|iswlower|iswprint|iswpunct|iswspace|iswupper|iswxdigit)\(wint_t\)/\/\/\0/g' \
    "$EMSDK/upstream/emscripten/cache/sysroot/include/wchar.h"

# espeak-ng
RUN git clone --depth 1 https://github.com/espeak-ng/espeak-ng.git modules/espeak-ng

RUN cd modules/espeak-ng \
 && ./autogen.sh \
 && ./configure --without-async --without-mbrola --without-sonic --without-pcaudiolib --without-klatt --without-speechplayer --with-extdict-cmn \
 && make \
 && make install

RUN cd modules/espeak-ng/src/ucd-tools \
 && if [ -f CHANGELOG.md ]; then mv CHANGELOG.md CHANGELOG.tmp && mv CHANGELOG.tmp ChangeLog.md; fi \
 && ./autogen.sh \
 && ./configure \
 && make clean \
 && source /wasm/modules/emsdk/emsdk_env.sh \
 && emconfigure ./configure \
 && emmake make clean \
 && emmake make

RUN mkdir -p /wasm/dist

RUN source /wasm/modules/emsdk/emsdk_env.sh \
 && cd modules/espeak-ng \
 && emconfigure ./configure --without-async --without-mbrola --without-sonic --without-pcaudiolib --without-klatt --without-speechplayer --with-extdict-cmn \
 && emmake make clean \
 && emmake make src/espeak-ng \
 && emcc -O3 \
    -s INVOKE_RUN=0 \
    -s EXIT_RUNTIME=0 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createESpeakNg' \
    -s EXPORTED_FUNCTIONS='[_free,_malloc,_espeak_Initialize,_espeak_TextToPhonemes,_espeak_SetVoiceByName,_espeak_ListVoices]' \
    -s EXPORTED_RUNTIME_METHODS='[lengthBytesUTF8,stringToUTF8,UTF8ToString,setValue,getValue,FS]' \
    -s INITIAL_MEMORY=64MB \
    -s STACK_SIZE=5MB \
    -s DEFAULT_PTHREAD_STACK_SIZE=2MB \
    src/.libs/libespeak-ng.so src/espeak-ng.o \
    -o /wasm/dist/espeakng.js \
    --embed-file espeak-ng-data@/usr/local/share/espeak-ng-data/

FROM debian:12.12 AS export

WORKDIR /artifacts

COPY --from=builder /wasm/dist/espeakng.js ./espeakng.js
COPY --from=builder /wasm/dist/espeakng.wasm ./espeakng.wasm

ENTRYPOINT ["/bin/bash", "-lc"]
CMD ["cp /artifacts/* ${OUTPUT_DIR:-/out}"]
