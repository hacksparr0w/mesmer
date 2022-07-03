<p align="center">
  <img width="180" src="https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f98b.svg" />
</p>

<h1 align="center">Mesmer</h1>

> **Warning**
> This project is currently in a very early stage of development
> and, as such, may change drastically at any given time.

Mesmer is a delightful static site generator based on React. It aims to be as
simple as possible, letting you focus on your React components and written
content, while taking care of all the hassles of JavaScript bundling and React
server-side rendering.

## Features
 - [x] :wrench: No complicated configuration is required,
 - [x] :atom_symbol: The API is designed with React and modern ES features in
   mind,
 - [x] :link: Simple metadata system lets you share information across pages,
 - [x] :memo: Out-of-the-box support for MDX documents,
 - [ ] :recycle: A programmatic interface for dynamic page generation,
 - [ ] :electric_plug: A plugin system letting you hook into the build process
   and add features like page previews or search index generation.

## Getting Started

### System Requirements

You should be running at least Node 16 on your system for everything to run
properly.

### Starting with Mesmer Starter

[Mesmer Starter][1] is a very simple example project that gets you running
developmen server with a basic setup in a matter of minutes. If you just want
to start hacking, clone the Mesmer Starter repository by running

```
git clone https://github.com/hacksparr0w/mesmer-starter.git
```

You can then use `npm run dev` or `npm run build` to start a development server
or build the whole thing.

### Starting from Scratch

If you prefer to start with minimal setup, you can easily do so by running

```sh
npm i mesmer react react-dom
```

See the documentation section below to find out how to point Mesmer to your
ES modules for static site generation.

[1]: https://github.com/hacksparr0w/mesmer-starter
