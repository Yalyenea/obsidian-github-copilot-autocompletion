set shell := ["zsh", "-cu"]

default: check

install:
    npm install

dev:
    npm run dev

build:
    npm run build

test:
    node esbuild.tests.mjs
    node .tmp/tests.js

check: build test

release: check
    ls -lh main.js manifest.json styles.css
