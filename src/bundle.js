import Fs from "node:fs/promises";
import Path from "node:path";

import mdx from "@mdx-js/esbuild";
import Esbuild from "esbuild";

import * as Codegen from "./codegen.js";

const BUNDLE_PLUGIN_NAME = "mesmer";
const DEFAULT_LOADERS = {
  ".png": "file",
  ".jpg": "file",
  ".svg": "file",
  ".css": "file"
};

const Page = ({ moduleFilePath, moduleExportName }) => ({
  moduleFilePath,
  moduleExportName
});

const BundleMode = {
  CLIENT: "CLIENT",
  SERVER: "SERVER"
};

const BundlePlugin = (paths, pages, mode) => ({
  name: BUNDLE_PLUGIN_NAME,
  setup: async build => {
    const {
      buildDirectoryPath,
      configFilePath,
      metadataFilePath
    } = paths;

    const configFilePattern = new RegExp(
      `${Path.parse(configFilePath).base}$`
    );

    build.onLoad({ filter: configFilePattern }, async () => {
      let contents;

      if (mode === BundleMode.CLIENT) {
        contents = Codegen.generateClientModuleCode(
          pages,
          `/${Path.relative(buildDirectoryPath, metadataFilePath)}`
        );
      } else {
        contents = Codegen.generateServerModuleCode(pages);
      }

      return {
        contents,
        loader: "js"
      };
    });
  }
});

const esbuild = (paths, pages, mode, incremental) => {
  const {
    buildDirectoryPath,
    clientBundleFilePath,
    configFilePath,
    serverBundleFilePath
  } = paths;

  let bundleFilePath;
  let platform;

  if (mode === BundleMode.CLIENT) {
    bundleFilePath = clientBundleFilePath;
    platform = "browser";
  } else {
    bundleFilePath = serverBundleFilePath;
    platform = "node";
  }

  bundleFilePath = bundleFilePath.slice(
    0,
    -Path.parse(bundleFilePath).ext.length
  );

  return Esbuild.build({
    platform,
    incremental,
    logLevel: "silent",
    entryPoints: {
      [bundleFilePath]: configFilePath
    },
    bundle: true,
    write: false,
    metafile: true,
    loader: DEFAULT_LOADERS,
    outdir: buildDirectoryPath,
    publicPath: "/",
    plugins: [mdx(), BundlePlugin(paths, pages, mode)]
  });
};

const compareErrors = (first, second) => (
  first.text === second.text &&
  first.location.column === second.location.column &&
  first.location.file === second.location.file &&
  first.location.line === second.location.line
);

const compareOutputFiles = (first, second) => (
  first.path === second.path
);

const isUniqueItem = compare => (first, firstIndex, array) => {
  const secondIndex = array
    .findIndex((second) => compare(first, second));

  return firstIndex === secondIndex;
};

const processEsbuildResults = async (promises) => {
  const results = await Promise.allSettled(promises);
  const errors = results
    .filter(({ status }) => status === "rejected")
    .map(({ reason: { errors }}) => errors)
    .flat()
    .filter(isUniqueItem(compareErrors));

  if (errors.length !== 0) {
    const error = new Error();
    error.errors = errors;

    throw error;
  }

  const outputFiles = results
    .map(({ value: { outputFiles } }) => outputFiles)
    .flat()
    .filter(isUniqueItem(compareOutputFiles));

  await Promise.all(
    outputFiles.map(({ path, contents }) => Fs.writeFile(path, contents))
  );

  const inputFilePaths = results
    .map(({ value: { metafile } }) => Object.keys(metafile.inputs))
    .flat()
    .filter(isUniqueItem((a, b) => a === b));

  const rebuild = () => (
    processEsbuildResults(results.map(({ value }) => value.rebuild()))
  );

  const dispose = () => (
    results.forEach(({ value }) => value.rebuild.dispose())
  );

  return {
    inputFilePaths,
    rebuild,
    dispose
  };
};

const bundle = async (paths, pages, incremental = false) => (
  processEsbuildResults([
    esbuild(paths, pages, BundleMode.CLIENT, incremental),
    esbuild(paths, pages, BundleMode.SERVER, incremental)
  ])
);

export {
  Page,
  bundle
};
