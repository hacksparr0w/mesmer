import React from "react";

export default ({ metadata: { page: { title } }, children }) => (
  <html>
    <head>
      <title>{title}</title>
    </head>
    <body>
      <div id="app">
        {children}
      </div>
      <script src="./mesmer-client.js" />
    </body>
  </html>
);
