import { promises as Fs } from "fs";
import Path from "path";

import getCommonPath from "common-path";
import Esbuild from "esbuild";
import Glob from "glob";
import React from "react";
import ReactDom from "react-dom/server";

import { glob, hash } from "./utility.js";

const CONFIG_FILE_NAME = "esblog.json";
const BUNDLE_FILE_NAME = "bundle.mjs";
const BUILD_DIR_NAME = "build";

const generateExportName = pagePath => (
  Path.parse(pagePath).name + hash(pagePath)
);

const getBuildPath = projectPath => (
  Path.join(projectPath, BUILD_DIR_NAME)
);

const getBundlePath = projectPath => (
  Path.join(getBuildPath(projectPath), BUNDLE_FILE_NAME)
);

const getConfigPath = projectPath => (
  Path.join(projectPath, CONFIG_FILE_NAME)
);

const generateModuleCode = pages => {
  let buffer = "";

  for (const [path, exportName] of pages) {
    buffer += `export { default as ${exportName} } from "${path}";\n`;
  }

  buffer += `export { default as React } from "react";\n`;
  buffer += `export { default as ReactDom } from "react-dom";\n`;

  return buffer;
};

const resolvePagePaths = async pagePatterns => {
  const paths = [];

  for (const pattern of pagePatterns) {
    if (!Glob.hasMagic(pattern)) {
      paths.push(pattern);
      continue;
    }

    const matches = await glob(pattern);
    paths.push(...matches);
  }

  return paths;
};

const loadConfig = async configPath => {
  const contents = await Fs.readFile(configPath, "utf-8");
  const data = JSON.parse(contents);
  const pagePaths = await resolvePagePaths(data.pages ?? []);
  const pages = pagePaths
    .map(path => [path, generateExportName(path)]);

  return { pages };
};

const plugin = projectPath => ({
  name: "mesmer",
  setup: build => {
    let config;

    build.onLoad({ filter: /esblog\.json$/ }, async args => {
      config = await loadConfig(args.path);
      const { pages } = config;

      return {
        loader: "js",
        contents: generateModuleCode(pages)
      };
    });

    build.onEnd(async result => {
      if (result.errors.length !== 0) {
        return;
      }

      const { pages } = config;
      const buildPath = getBuildPath(projectPath);
      const bundlePath = getBundlePath(projectPath);
      const { parsedPaths: commonPaths } = getCommonPath(
        pages.map(([path, _]) => path)
      );

      const options = pages.map(
        ([, exportName], index) => {
          const { subdir, namePart } = commonPaths[index];

          return [
            exportName,
            Path.join(buildPath, subdir, `${namePart}.html`)
          ];
        }
      );

      const bundle = await import(bundlePath);

      for (const [exportName, outputPath] of options) {
        const element = React.createElement(bundle[exportName]);
        const markup = ReactDom.renderToString(element);

        await Fs.writeFile(outputPath, markup, "utf-8");
      }
    });
  }
});

const build = async projectPath => {
  const configPath = getConfigPath(projectPath);
  const bundlePath = getBundlePath(projectPath);

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
