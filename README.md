# espeak-ng.com

```shell
docker build -t espeakng-builder .
docker run --rm -v "$(pwd)/public":/out espeakng-builder
```
