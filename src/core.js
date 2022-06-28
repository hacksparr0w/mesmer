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
const CONFIG_FILE_PATTERN = /mesmer.json$/;
const CLIENT_BUNDLE_FILE_NAME = "mesmer-client.js";
const DEFAULT_LOADERS = {
  ".png": "file",
  ".jpg": "file",
  ".svg": "file",
  ".css": "file"
};

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
        pathname += "index.html";
      }

      const response = await fetch("./${METADATA_FILE_NAME}");
      const metadata = await response.json();
      const pageMetadata = metadata.pages.find(
        ({ documentPath }) => documentPath === pathname
      );

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
    const [{ modulePath, moduleExportName }, { subPart, namePart }] = page;
    const relativeDocumentPath = "/" + Path.join(subPart, `${namePart}.html`);
    const absoluteDocumentPath = Path.join(buildPath, relativeDocumentPath);
    const module = bundle[moduleExportName];
    const metadata = Object.assign(
      {},
      module.metadata,
      {
        moduleExportName,
        modulePath,
        documentPath: relativeDocumentPath
      }
    );

    return {
      relativeDocumentPath,
      absoluteDocumentPath,
      module,
      metadata
    };
  });

  const metadata = {
    build: {
      clientBundlePath: `/${CLIENT_BUNDLE_FILE_NAME}`
    },
    pages: candidates.map(({ metadata }) => metadata),
    project: projectMetadata
  };

  await writeJsonFile(metadataPath, metadata);

  return Promise.all(candidates.map(candidate => {
    const {
      absoluteDocumentPath: documentPath,
      module,
      metadata: pageMetadata
    } = candidate;

    const {
      default: pageComponent,
      documentTemplate: documentTemplateModule
    } = module;

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

    return writeTextFile(documentPath, contents);
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

const MesmerPluginMode = {
  CLIENT: "CLIENT",
  SERVER: "SERVER"
};

const MesmerPlugin = (projectPath, mode) => ({
  name: "mesmer",
  setup: async build => {
    const configPath = Path.join(projectPath, CONFIG_FILE_NAME);
    const config = await expandConfig(
      await readJsonFile(configPath),
      projectPath
    );

    build.onLoad({ filter: CONFIG_FILE_PATTERN }, () => {
      const { pages } = config;
      const contents = mode === MesmerPluginMode.CLIENT
        ? generateClientModuleCode(pages)
        : generateServerModuleCode(pages);

      return {
        contents,
        loader: "js"
      };
    });

    if (mode === MesmerPluginMode.CLIENT) {
      return;
    }

    build.onEnd(({ errors }) => {
      if (errors.length !== 0) {
        return;
      }

      return buildPages(projectPath, config);
    });
  }
});

const getEsbuildClientBuildOptions = (projectPath, watch) => {
  const buildPath = Path.join(projectPath, BUILD_DIR_NAME);
  const configPath = Path.join(projectPath, CONFIG_FILE_NAME);
  const bundlePath = Path.join(
    buildPath,
    CLIENT_BUNDLE_FILE_NAME.slice(0, -3)
  );

  return {
    watch,
    entryPoints: {
      [bundlePath]: configPath
    },
    outdir: buildPath,
    bundle: true,
    loader: DEFAULT_LOADERS,
    platform: "browser",
    logLevel: "silent",
    plugins: [MesmerPlugin(projectPath, MesmerPluginMode.CLIENT)]
  };
};

const getEsbuildServerBuildOptions = (projectPath, watch) => {
  const buildPath = Path.join(projectPath, BUILD_DIR_NAME);
  const configPath = Path.join(projectPath, CONFIG_FILE_NAME);
  const bundlePath = Path.join(
    buildPath,
    SERVER_BUNDLE_FILE_NAME.slice(0, -3)
  );

  return {
    watch,
    entryPoints: {
      [bundlePath]: configPath
    },
    outdir: buildPath,
    bundle: true,
    loader: DEFAULT_LOADERS,
    platform: "node",
    plugins: [MesmerPlugin(projectPath, MesmerPluginMode.SERVER)]
  };
};

const build = projectPath => Promise.all([
  Esbuild.build(getEsbuildClientBuildOptions(projectPath, false)),
  Esbuild.build(getEsbuildServerBuildOptions(projectPath, false))
]);


const serve = async projectPath => {
  const buildPath = Path.join(projectPath, BUILD_DIR_NAME);
  const clientBuildOptions = getEsbuildClientBuildOptions(projectPath, true);
  const serverBuildOptions = getEsbuildServerBuildOptions(projectPath, true);
  const serveOptions = {
    root: buildPath,
    host: "0.0.0.0",
    port: 8080,
    wait: 0.5
  };

  const watchers = await Promise.all([
    Esbuild.build(clientBuildOptions),
    Esbuild.build(serverBuildOptions)
  ]);

  LiveServer.start(serveOptions);

  return Promise.all(watchers.map(watcher => watcher.wait));
};

export {
  build,
  serve
};
