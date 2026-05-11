set shell := ["zsh", "-cu"]

default: check

install:
    npm install

dev:
    npm run dev

build:
    npm run build

check:
    npm run build

release:
    npm run build
    ls -lh main.js manifest.json styles.css
