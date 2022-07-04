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

## API

 - [`mesmer.json`](#mesmerjson)
 - [`module.default`](#moduledefault)
 - [`module.metadata`](#modulemetadata)
 - [`module.template`](#moduletemplate)
 - [`module.containerSelector`](#modulecontainerselector)
 - [`module.parent`](#moduleparent)

### `mesmer.json`

`mesmer.json` is a configuration file that lets Mesmer know where to look for
your ES modules that will later be rendered into HTML documents. Each ES module
you include in your project's configuration file should contain at least a
`default` export pointing to a React component that shall be used in the
rendering process. All possible module exports that can affect Mesmer's
behavior will be discussed later.

An example `mesmer.json` file can look roughly as following

```json
{
  "metadata": {
    "name": "Mesmer Starter",
    "githubUrl": "https://github.com/hacksparr0w/mesmer"
  },
  "pages": [
    "./src/page/*.jsx",
    "./src/page/post/*.mdx"
  ]
}
```

Right away you can notice that the configuration object contains `metadata`
and `pages` properties. The `metadata` property will be discussed later.
For now, let's focus on the `pages` configuration property. This property is
simply an array of glob patterns that specify paths to your ES modules. Each
ES module matched by the glob patterns gets rendered into a single HTML page.

As already stated, we will discuss the `metadata` property in greater depth
later. For now, all you need to know is that this property is related to
Mesmer's metadata system. This property will be merged with other `metadata`
properties and will be passed to React components during rendering as a
`metadata.project` prop. The contents of the `metadata` object are entirely
defined by the user and this object does not need to be present in the Mesmer
configuration at all.

### `module.default`

When rendering your ES modules into HTML documents, Mesmer expects each module
to have a `default` export of a React component. In practice this can look as
follows

```js
import React from "react";

export default () => (
  <h1>Welcome to Mesmer!</h1>
);
```

This is very natural, as it is what you would probably do anyway when
building with React.

### `module.metadata`

Let's now talk about Mesmer's metadata system. Each ES module passed to Mesmer
can optionally export an object called `metadata`. During the rendering phase,
Mesmer merges all of the exported `metadata` objects from each of your ES
modules, combines them with some other metadata sources and produces a
metadata of your whole application. This combined metadata may look as follows

```json
{
  "build": {
    "clientBundleFilePath": "/mesmer-client.js"
  },
  "project": {
    "name": "Mesmer Starter",
    "githubUrl": "https://github.com/hacksparr0w/mesmer"
  },
  "pages": [
    {
      "title": "Welcome to Mesmer!",
      "moduleFilePath": "./src/page/index.jsx",
      "moduleExportName": "indexd9bd70b55a10a898c8ac536aaf313f9d",
      "documentFilePath": "/index.html"
    },
    {
      "title": "First blog post",
      "publishedOn": "Jul 3, 2022",
      "topic": "blogging",
      "emoji": "waving-hand",
      "moduleFilePath": "./src/page/post/first-post.mdx",
      "moduleExportName": "first_post65408c0e66a0917cc78f35f7a734cccf",
      "documentFilePath": "/post/first-post.html"
    }
  ]
}
```

Some metadata values such as `build.clientBundleFilePath` or
`pages.documentFilePath` are always present in the metadata bundle but other
properties are completely up to the user to be defined.

The combined metadata object is passed to all React components rendered by
Mesmer when generating the resultant HTML documents. In this way, it is
possible for all parts of your application to communicate with one another.

Following is a snippet taken from [Mesmer Starter][1] that utilizes the
metadata system to render a list of all published blog posts on the index page

```js
import React from "react";

import { Page, Navbar, Posts, PostCard } from "./component";

export const metadata = {
  title: "Welcome to Mesmer!"
};

export default ({ metadata: { pages, project: { name } } }) => {
  const posts = pages.filter(
    ({ documentFilePath }) => documentFilePath.includes("post")
  );

  return (
    <Page>
      <header>
        <Navbar projectName={name} />
        <h1>Welcome to Mesmer!</h1>
      </header>
      <main>
        <Posts>
          <h2>Posts</h2>
          {posts.map(post => {
            const { documentFilePath } = post;

            return (
              <PostCard key={documentFilePath} post={post} />
            );
          })}
        </Posts>
      </main>
      <Footer />
    </Page>
  );
};
```

### `module.template`

By default, Mesmer renders the component specified by the `module.default`
export. Most of the times thought, you will want the componenet to be wrapped
by some kind of HTML preamble including common tags like `<head>`, `<body>`
and so on. This can be accomplished by using the `module.template` export.

Following is an example of using such a construct

```js
// Contents of HtmlTemplate.jsx

import React from "react";

export const containerSelector = "#app";

export default ({
  metadata: {
    build: { clientBundleFilePath },
    page: { title }
  },
  children
}) => (
  <html>
    <head>
      <meta charSet="UTF-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <link rel="stylesheet" href={highlightTheme} />
    </head>
    <body>
      <div id={containerSelector.slice(1)}>
        {children}
      </div>
    </body>
    <script src={clientBundleFilePath} />
    <script dangerouslySetInnerHTML={{ __html: `
      window.Prism = window.Prism || {};
      window.Prism.manual = true;
    `}} />
  </html>
);
```

```js
// Contents of index.jsx

import React from "react";

import * as HtmlTemplate from "./HtmlTemplate";

export const metadata = {
  title: "Welcome to Mesmer!"
};

export const template = HtmlTemplate;

export default () => (
  <h1>Welcome to Mesmer!</h1>
);
```

There are some important things worth noticing. Firstly, the module where the
`HtmlTemplate` is to be used has to import it using the star import notation

```jsx
import * as HtmlTemplate from "./HtmlTemplate";
```

This is an important detail, as the `HtmlTemplate` module might itself export
some directives influencing the rendering behavior. Mesmer uses ES modules as
its most elementar API primitive, not React components. This architectural
decision was made so that Mesmer can easily support assets like MDX documents
that compile into a single ES module.

The `HtmlTemplate` itself is actually pretty straightforward. It includes some
headers linking to local stylesheets and declares a document `<title>`,
referencing the metadata declared in its child component. The child component
itself is passed to the template and rendered in the `<body>`. To make your
React application `hydrate` on the client, you need to include your bundled
application code. This is done with the following line of code

```js
<script src={clientBundleFilePath} />
```

The `clientBundleFilePath` is a property found in the `metadata.build` object.

Your bundled application code includes a client-side rendering procedure that
needs to know where exactly in the template it should hydrate your uppermost
React component to. This information is passed by utilizing the
`module.containerSelector` export.

### `module.containerSelector`

As stated above, the `module.containerSelector` is utilized by template
modules to tell the client renderer where in the template should the uppermost
React component be rendered.

### `module.parent`

`module.parent` export is similar to the `module.template` export, but works a
bit different. It is mainly used in MDX files, where you cannot explicitly
affect the generated `module.default` export. When Mesmer encounters module
with `module.parent` export, it will use the React component defined by
`module.default` export of the parent module as the uppermost React component,
passing it the child's `module.default` component as a child element. Both of
the components get passed Mesmer's metadata object.

The `module.parent` export should, once again, point to an ES module, not a
React component. If a parent module has `module.template` export, it will be
used preferentially before its child's `module.template` export.

Here's a simple example taken from [Mesmer Starter][1] where a `module.parent`
export is used to specify a parent React component a post should be rendered
into

```js
// Contents of first-post.mdx

export const parent = Post;

export const metadata = {
  title: "First blog post",
  subtitle: "In this blog post, you'll find out about some cool things you can do with Mesmer.",
  publishedOn: "12. 04. 2022",
  topic: "blogging",
  emoji: "waving-hand"
};

You can find this post in the `src/page/post` folder. Try running the Mesmer
dev server using `npm run dev`, modifying this blog post and see it being
rebuild on the fly!
```

```js
// Contents of Post.jsx

import React from "react";

import {
  Container,
  Navbar,
  Page,
  PostContent,
  PostHeader
} from "./component";

export const template = HtmlTemplate;

export default ({
  metadata: {
    page: { title, publishedOn },
    project: { name, githubUrl }
  },
  children
}) => {
  useEffect(() => {
    Prism.highlightAll();
  }, []);

  return (
    <Page>
      <header>
        <Navbar projectName={name} githubUrl={githubUrl} />
      </header>
      <Main>
        <Container>
          <PostHeader>
            <h1>
              {title}
            </h1>
            <p>Published on {publishedOn}</p>
          </PostHeader>
          <PostContent>
            {children}
          </PostContent>
        </Container>
      </Main>
      <Footer />
    </Page>
  );
};
```

[1]: https://github.com/hacksparr0w/mesmer-starter
