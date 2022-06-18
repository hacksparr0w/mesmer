import { promises as Fs } from "fs";
import Path from "path";

import getCommonPath from "common-path";
import Esbuild from "esbuild";
import React from "react";
import ReactDom from "react-dom/server";

import { globAll, hash } from "./utility.js";

const CONFIG_FILE_NAME = "mesmer.json";
const CONFIG_FILE_PATTERN = /mesmer\.json$/;
const METADATA_FILE_NAME = "metadata.json";
const BUNDLE_FILE_NAME = "bundle.mjs";
const BUILD_DIR_NAME = "build";

const generateExportName = pagePath => (
  Path.parse(pagePath).name + hash(pagePath)
);

const getBuildPath = projectPath => (
  Path.join(projectPath, BUILD_DIR_NAME)
);

const getBundlePath = buildPath => (
  Path.join(buildPath, BUNDLE_FILE_NAME)
);

const getConfigPath = projectPath => (
  Path.join(projectPath, CONFIG_FILE_NAME)
);

const getMetadataPath = buildPath => (
  Path.join(buildPath, METADATA_FILE_NAME)
);

const generateBundleCode = pages => {
  const lines = [];

  for (const [path, exportName] of pages) {
    lines.push(`export { default as ${exportName} } from "${path}";`);
  }

  lines.push(`export { default as React } from "react";`);
  lines.push(`export { default as ReactDom } from "react-dom";`);

  const contents = lines.join("\n");

  return contents;
};

const loadConfig = async (projectPath, configPath) => {
  const contents = await Fs.readFile(configPath, "utf-8");
  const data = JSON.parse(contents);
  const pagePaths = await globAll(data.pages ?? [], projectPath);
  const pages = pagePaths
    .map(path => [path, generateExportName(path)]);

  const metadata = data.metadata ?? {};

  return { pages, metadata };
};

const plugin = projectPath => ({
  name: "mesmer",
  setup: build => {
    let config;

    build.onLoad({ filter: CONFIG_FILE_PATTERN }, async args => {
      config = await loadConfig(projectPath, args.path);
      const { pages } = config;

      return {
        loader: "js",
        contents: generateBundleCode(pages)
      };
    });

    build.onEnd(async ({ errors }) => {
      if (errors.length !== 0) {
        return;
      }

      const { pages, metadata: siteMetadata } = config;
      const buildPath = getBuildPath(projectPath);
      const bundlePath = getBundlePath(buildPath);
      const metadataPath = getMetadataPath(buildPath);
      const { parsedPaths: commonPaths } = getCommonPath(
        pages.map(([path, _]) => path)
      );

      const bundle = await import(bundlePath);
      const pagesMetadata = {};
      const candidates = [];

      for (let index = 0; index < pages.length; index += 1) {
        const [, exportName] = pages[index];
        const { subdir, namePart } = commonPaths[index];
        const relativeDocumentPath = Path.join(
          `/${subdir}`,
          `${namePart}.html`
        );

        const absoluteDocumentPath = Path.join(
          buildPath,
          relativeDocumentPath
        );

        const component = bundle[exportName];
        const pageMetadata = component.metadata ?? {};

        pagesMetadata[relativeDocumentPath] = pageMetadata;
        candidates.push([absoluteDocumentPath, component, pageMetadata]);
      }

      const metadata = { site: siteMetadata, pages: pagesMetadata };
      const metadataContents = JSON.stringify(metadata);

      await Fs.writeFile(metadataPath, metadataContents, "utf-8");

      for (const [documentPath, component, pageMetadata] of candidates) {
        const element = React.createElement(
          component,
          { metadata: { ...metadata, page: pageMetadata } }
        );

        const htmlContents = ReactDom.renderToString(element);

        await Fs.writeFile(documentPath, htmlContents, "utf-8");
      }
    });
  }
});

const build = async projectPath => {
  const configPath = getConfigPath(projectPath);
  const buildPath = getBuildPath(projectPath);
  const bundlePath = getBundlePath(buildPath);

  await Esbuild.build({
    entryPoints: [configPath],
    outfile: bundlePath,
    format: "esm",
    bundle: true,
    plugins: [plugin(projectPath)]
  });
};

export {
  build
};
