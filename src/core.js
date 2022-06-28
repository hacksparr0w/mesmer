import { createRequire } from "node:module";
import Path from "node:path";

import commonPath from "common-path";
import Esbuild from "esbuild";
import LiveServer from "live-server";

import {
  globAll,
  hash,
  readJsonFile,
  writeJsonFile,
  writeTextFile,
  zip
} from "./utility.js";

const BUILD_DIR_NAME = "build";
const CONFIG_FILE_NAME = "mesmer.json";
const CLIENT_BUNDLE_FILE_NAME = "mesmer-client.js";
const SERVER_BUNDLE_FILE_NAME = "mesmer-server.js";
const METADATA_FILE_NAME = "metadata.json";

const require = createRequire(import.meta.url);

const generatePageModuleExportName = path => (
  Path.parse(path).name + hash(path)
);

const generateClientModuleCode = pages => {
  const lines = [];

  lines.push(`import React from "react";`);
  lines.push(`import ReactDomClient from "react-dom/client";`);

  for (const { modulePath, moduleExportName } of pages) {
    lines.push(`import * as ${moduleExportName} from "${modulePath}";`);
  }

  lines.push("");

  lines.push(`const pages = {};`);

  for (const { moduleExportName } of pages) {
    lines.push(`pages["${moduleExportName}"] = ${moduleExportName};`);
  }

  lines.push("");

  lines.push(`
    (async () => {
      let { pathname } = location;

      if (pathname.endsWith("/")) {
        location += "index.html";
      }

      const response = await fetch("./${METADATA_FILE_NAME}");
      const metadata = await response.json();
      const pageMetadata = metadata.pages[pathname];

      metadata["page"] = pageMetadata;

      const { moduleExportName } = pageMetadata;
      const { default: component } = pages[moduleExportName];
      const element = React.createElement(component, { metadata });
      const container = document.querySelector("#app");

      ReactDomClient.hydrateRoot(container, element);
    })();
  `);

  const contents = lines.join("\n");

  return contents;
};

const generateServerModuleCode = pages => {
  const lines = [];

  lines.push(`export * as React from "react";`);
  lines.push(`export * as ReactDomServer from "react-dom/server";`);

  lines.push("");

  for (const { modulePath, moduleExportName } of pages) {
    lines.push(`export * as ${moduleExportName} from "${modulePath}";`);
  }

  const contents = lines.join("\n");

  return contents;
};

const renderHtmlString = (ReactDomServer, element) => {
  let contents = ReactDomServer.renderToString(element);

  contents = "<!DOCTYPE html>" + contents;

  return contents;
};

const buildPages = async (projectPath, config) => {
  const buildPath = Path.join(projectPath, BUILD_DIR_NAME);
  const metadataPath = Path.join(buildPath, METADATA_FILE_NAME);
  const serverBundlePath = Path.join(buildPath, SERVER_BUNDLE_FILE_NAME);

  if (serverBundlePath in require.cache) {
    delete require.cache[serverBundlePath];
  }

  const bundle = require(serverBundlePath);

  const { React, ReactDomServer } = bundle;
  const { pages, metadata: projectMetadata } = config;
  const { parsedPaths: pageModuleCommonPaths } = commonPath(
    pages,
    "modulePath"
  );

  const candidates = zip(pages, pageModuleCommonPaths).map(page => {
    const [{ moduleExportName }, { subPart, namePart }] = page;
    const pageRelPath = "/" + Path.join(subPart, `${namePart}.html`);
    const pageBuildPath = Path.join(buildPath, pageRelPath);
    const pageModule = bundle[moduleExportName];
    const pageMetadata = Object.assign(
      {},
      pageModule.metadata,
      { moduleExportName }
    );

    return {
      pageRelPath,
      pageBuildPath,
      pageModule,
      pageMetadata
    };
  });

  const pagesMetadata = Object.fromEntries(
    candidates.map(({ pageRelPath, pageMetadata }) => [
      pageRelPath,
      pageMetadata
    ])
  );

  const metadata = { pages: pagesMetadata, project: projectMetadata };

  await writeJsonFile(metadataPath, metadata);

  return Promise.all(candidates.map(candidate => {
    const { pageBuildPath, pageModule, pageMetadata } = candidate;
    const {
      default: pageComponent,
      documentTemplate: documentTemplateModule
    } = pageModule;

    const props = { metadata: { ...metadata, page: pageMetadata } };
    let element = React.createElement(pageComponent, props);

    if (documentTemplateModule) {
      const { default: documentTemplateComponent } = documentTemplateModule;

      element = React.createElement(
        documentTemplateComponent,
        props,
        element
      );
    }

    const contents = renderHtmlString(ReactDomServer, element);

    return writeTextFile(pageBuildPath, contents);
  }));
};

const expandConfig = async (config, projectPath) => {
  const pageModulePaths = await globAll(config.pages, projectPath);
  const pages = pageModulePaths.map(modulePath => ({
    modulePath,
    moduleExportName: generatePageModuleExportName(modulePath)
  }));

  const metadata = config.metadata ?? {};

  return {
    metadata,
    pages
  };
};

const MesmerPlugin = (projectPath) => ({
  name: "mesmer",
  setup: async build => {
    const configPath = Path.join(projectPath, CONFIG_FILE_NAME);
    const config = await expandConfig(
      await readJsonFile(configPath),
      projectPath
    );

    build.onResolve({ filter: /^mesmer-client$/ }, () => ({
      namespace: "mesmer",
      path: "mesmer-client"
    }));

    build.onResolve({ filter: /^mesmer-server$/ }, () => ({
      namespace: "mesmer",
      path: "mesmer-server"
    }));

    build.onLoad({ filter: /^mesmer-client$/, namespace: "mesmer" }, () => {
      const { pages } = config;
      const contents = generateClientModuleCode(pages);

      return {
        contents,
        loader: "js",
        resolveDir: projectPath,
        watchFiles: [configPath]
      };
    });

    build.onLoad({ filter: /^mesmer-server$/, namespace: "mesmer" }, () => {
      const { pages } = config;
      const contents = generateServerModuleCode(pages);

      return {
        contents,
        loader: "js",
        resolveDir: projectPath,
        watchFiles: [configPath]
      };
    });

    build.onEnd(({ errors }) => {
      if (errors.length !== 0) {
        return;
      }

      return buildPages(projectPath, config);
    });
  }
});

const getEsbuildBuildOptions = (projectPath, watch) => {
  const buildPath = Path.join(projectPath, BUILD_DIR_NAME);
  const clientBundlePath = Path.join(
    buildPath,
    CLIENT_BUNDLE_FILE_NAME.slice(0, -3)
  );

  const serverBundlePath = Path.join(
    buildPath,
    SERVER_BUNDLE_FILE_NAME.slice(0, -3)
  );

  return {
    watch,
    entryPoints: {
      [clientBundlePath]: "mesmer-client",
      [serverBundlePath]: "mesmer-server"
    },
    outdir: buildPath,
    bundle: true,
    format: "cjs",
    loader: {
      ".png": "file",
      ".jpg": "file",
      ".svg": "file",
      ".css": "file"
    },
    plugins: [MesmerPlugin(projectPath)]
  };
};

const build = projectPath => (
  Esbuild.build(getEsbuildBuildOptions(projectPath, false))
);

const serve = async projectPath => {
  const buildPath = Path.join(projectPath, BUILD_DIR_NAME);
  const buildOptions = getEsbuildBuildOptions(projectPath, true);
  const serveOptions = {
    root: buildPath,
    host: "0.0.0.0",
    port: 8080,
    wait: 0.5
  };

  const watcher = await Esbuild.build(buildOptions);

  LiveServer.start(serveOptions);

  return watcher.wait;
};

export {
  build,
  serve
};
