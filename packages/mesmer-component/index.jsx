import React from "react";

const DefaultHead = () => (
  <head>
    <meta charSet="UTF-8" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Default Title</title>
  </head>
);

const HtmlDocument = (Head = DefaultHead) => Component => {
  const Wrapper = ({ metadata }) => (
    <html>
      <Head metadata={metadata} />
      <body>
        <div id="app">
          <Component metadata={metadata} />
        </div>
        <script type="module" dangerouslySetInnerHTML={{ __html: `
          import * as App from "./app.mjs";
          import React from "./react.mjs";
          import ReactDom from "./react-dom-client.mjs";

          (async () => {
            let { pathname } = location;

            if (pathname.endsWith("/")) {
              pathname += "index.html";
            }

            const response = await fetch("./metadata.json");
            const appMetadata = await response.json();
            const pageMetadata = appMetadata.pages[pathname];
            const metadata = { ...appMetadata, page: pageMetadata };
            const { wrapped: component } = App[pageMetadata.exportName];
            const element = React.createElement(component, { metadata });

            ReactDom.hydrateRoot(document.querySelector("#app"), element);
          })();
        `}} />
      </body>
    </html>
  );

  Wrapper.wrapped = Component;
  Wrapper.metadata = Component.metadata;

  return Wrapper;
};

export {
  DefaultHead,
  HtmlDocument
};
