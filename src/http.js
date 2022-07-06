import * as Fs from "node:fs";
import * as Http from "node:http";
import * as Path from "node:path";

import MimeType from "./mime-type.js";

const DEFAULT_TEXT_ENCODING = "utf-8";
const DEFAULT_MIME_TYPE = "application/octet-stream";
const EVENT_SOURCE_PATH = "/_/event-source";

const generateClientReloadCode = () => (`
  <script>
    const source = new EventSource("${EVENT_SOURCE_PATH}");
    source.onmessage = () => location.reload();
  </script>
`);

const getFilePath = (rootDirectoryPath, url) => {
  let path = Path.normalize(url);

  if (path.endsWith("/")) {
    path += "index.html";
  }

  return Path.join(rootDirectoryPath, path);
};

const getMimeType = (extension, defaultValue = DEFAULT_MIME_TYPE) => {
  const result = Object.keys(MimeType)
    .find(key => MimeType[key].includes(extension));

  return result ?? defaultValue;
};

const injectHtmlBody = (html, content) => {
	const index = html.indexOf("</body>");

  if (index === -1) {
    return html;
  }

	const start = html.slice(0, index);
	const end = html.slice(index);

	return start + content + end;
};

const LiveServer = ({ host, port, rootDirectoryPath }) => {
  const clients = [];
  const server = Http.createServer((request, response) => {
    if (request.url === EVENT_SOURCE_PATH) {
      response.writeHead(200, {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
      });

      clients.push(response);
      return;
    }

    const filePath = getFilePath(rootDirectoryPath, request.url);
    const contentType = getMimeType(Path.extname(filePath).slice(1));
    const isHtml = contentType === "text/html";
    const encoding = isHtml ? DEFAULT_TEXT_ENCODING : undefined;

    Fs.readFile(filePath, encoding, (error, data) => {
      if (error) {
        if (error.code === "ENOENT") {
          response.writeHead(404, { "Content-Type": "text/html" });
          response.end("File not found", DEFAULT_TEXT_ENCODING);
          return;
        }

        response.writeHead(500, { "Content-Type": "text/html" });
        response.end("Unexpected error", DEFAULT_TEXT_ENCODING);
        return;
      }

      let content = data;

      if (isHtml) {
        content = injectHtmlBody(content, generateClientReloadCode());
      }

      response.writeHead(200, { "Content-Type": contentType });
      response.end(content, encoding);
    });
  });

  const reload = () => {
    for (;;) {
      const client = clients.pop();

      if (!client) {
        return;
      }

      client.write("data: reload\n\n");
      client.end();
    }
  };

  const start = () => new Promise(resolve => {
    server.listen(port, host, resolve);
  });

  const stop = () => new Promise((resolve, reject) => {
    client.length = 0;
    server.closeAllConnections();
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return {
    reload,
    start,
    stop
  };
};

export {
  LiveServer
};
