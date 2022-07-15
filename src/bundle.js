import Fs from "node:fs/promises";
import Path from "node:path";

import mdx from "@mdx-js/esbuild";
import Esbuild from "esbuild";

import * as Codegen from "./codegen.js";
import { isUniqueElement, joinUrl } from "./utility.js";

const BUNDLE_PLUGIN_NAME = "mesmer";
const DEFAULT_LOADERS = {
  ".png": "file",
  ".jpg": "file",
  ".svg": "file",
  ".css": "file"
};

const BundleMode = {
  CLIENT: "CLIENT",
  SERVER: "SERVER"
};

const BundleOptions = ({ mode, paths, pages, baseUrl, incremental }) => ({
  mode,
  paths,
  pages,
  baseUrl,
  incremental
});

const Page = ({ moduleFilePath, moduleExportName }) => ({
  moduleFilePath,
  moduleExportName
});

const BundlePlugin = options => ({
  name: BUNDLE_PLUGIN_NAME,
  setup: async build => {
    const {
      mode,
      pages,
      baseUrl,
      paths: {
        buildDirectoryPath,
        configFilePath,
        metadataFilePath
      }
    } = options;

    const configFilePattern = new RegExp(
      `${Path.parse(configFilePath).base}$`
    );

    build.onLoad({ filter: configFilePattern }, async () => {
      let contents;
      const metadataFileUrl = joinUrl(
        baseUrl,
        Path.relative(buildDirectoryPath, metadataFilePath)
      );

      if (mode === BundleMode.CLIENT) {
        contents = Codegen.generateClientModuleCode(
          pages,
          metadataFileUrl
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

const esbuild = options => {
  const {
    mode,
    incremental,
    baseUrl,
    paths: {
      buildDirectoryPath,
      clientBundleFilePath,
      configFilePath,
      serverBundleFilePath
    }
  } = options;

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
    publicPath: baseUrl,
    plugins: [mdx(), BundlePlugin(options)]
  });
};

const multibuild = async promises => {
  const compareErrors = (first, second) => (
    first.text === second.text &&
    first.location.column === second.location.column &&
    first.location.file === second.location.file &&
    first.location.line === second.location.line
  );

  const compareOutputFiles = (first, second) => (
    first.path === second.path
  );

  const results = await Promise.allSettled(promises);
  const errors = results
    .filter(({ status }) => status === "rejected")
    .map(({ reason: { errors }}) => errors)
    .flat()
    .filter(isUniqueElement(compareErrors));

  if (errors.length !== 0) {
    const error = new Error();
    error.errors = errors;

    throw error;
  }

  const outputFiles = results
    .map(({ value: { outputFiles } }) => outputFiles)
    .flat()
    .filter(isUniqueElement(compareOutputFiles));

  await Promise.all(
    outputFiles.map(async ({ path, contents }) => {
      const parentDirectoryPath = Path.dirname(path);

      try {
        await Fs.stat(parentDirectoryPath);
      } catch (error) {
        if (error.code === "ENOENT") {
          await Fs.mkdir(parentDirectoryPath, { recursive: true });
        } else {
          throw error;
        }
      }

      return Fs.writeFile(path, contents);
    })
  );

  const inputFilePaths = results
    .map(({ value: { metafile } }) => Object.keys(metafile.inputs))
    .flat()
    .filter(isUniqueElement((a, b) => a === b));

  const rebuild = () => (
    multibuild(results.map(({ value }) => value.rebuild()))
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

const bundle = async options => (
  multibuild([
    esbuild(BundleOptions({ ...options, mode: BundleMode.CLIENT })),
    esbuild(BundleOptions({ ...options, mode: BundleMode.SERVER }))
  ])
);

export {
  BundleOptions,
  Page,
  bundle
};
