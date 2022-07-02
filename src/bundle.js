import Path from "node:path";

import mdx from "@mdx-js/esbuild";
import Esbuild from "esbuild";

import * as Codegen from "./codegen.js";
import * as Config from "./config.js";
import * as Utility from "./utility.js";

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

const BundlePlugin = (paths, mode) => ({
  name: BUNDLE_PLUGIN_NAME,
  setup: async build => {
    const {
      projectDirectoryPath,
      buildDirectoryPath,
      configFilePath,
      metadataFilePath
    } = paths;

    const configFilePattern = new RegExp(
      `${Path.parse(configFilePath).base}$`
    );

    let config;
    let pages;

    build.onLoad({ filter: configFilePattern }, async () => {
      config = await Config.readConfigFile(configFilePath);
      const pageModuleFilePaths = await Utility.globAll(
        config.pages,
        projectDirectoryPath
      );

      pages = pageModuleFilePaths.map(moduleFilePath => Page({
        moduleFilePath,
        moduleExportName: Codegen.generatePageModuleExportName(moduleFilePath)
      }));

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

    build.onEnd(result => {
      if (result.errors.length !== 0) {
        return;
      }

      result.config = config;
      result.pages = pages;
    });
  }
});

const esbuild = (paths, mode, watch = false, onRebuild = undefined) => {
  const {
    buildDirectoryPath,
    clientBundleFilePath,
    configFilePath,
    serverBundleFilePath
  } = paths;

  let bundleFilePath;
  let platform;
  let logLevel;

  //
  // TODO: Silencing the client builder is actually very dangerous and may
  // potentially hide important error messages from users!
  //
  // Another problem with having two separate build processes like this is
  // that some resources get written out to the filesystem twice!
  //

  if (mode === BundleMode.CLIENT) {
    bundleFilePath = clientBundleFilePath;
    platform = "browser";
    logLevel = "silent";
  } else {
    bundleFilePath = serverBundleFilePath;
    platform = "node";
    logLevel = "warning";
  }

  bundleFilePath = bundleFilePath.slice(
    0,
    -Path.parse(bundleFilePath).ext.length
  );

  let watchOptions;

  if (watch) {
    watchOptions = true;

    if (onRebuild) {
      watchOptions = { onRebuild };
    }
  } else {
    watchOptions = false;
  }

  return Esbuild.build({
    platform,
    logLevel,
    entryPoints: {
      [bundleFilePath]: configFilePath
    },
    watch: watchOptions,
    bundle: true,
    loader: DEFAULT_LOADERS,
    outdir: buildDirectoryPath,
    plugins: [mdx(), BundlePlugin(paths, mode)]
  });
};

const bundle = async paths => {
  const [_, serverBuilderResult] = await Promise.all([
    esbuild(paths, BundleMode.CLIENT),
    esbuild(paths, BundleMode.SERVER)
  ]);

  return serverBuilderResult;
};

const watch = async (paths, onRebuild) => {
  const [clientWatcher, serverWatcher] = await Promise.all([
    esbuild(paths, BundleMode.CLIENT, true),
    esbuild(paths, BundleMode.SERVER, true, onRebuild)
  ]);

  const stop = () => {
    clientWatcher.stop();
    serverWatcher.stop();
  };

  const wait = () => Promise.all([
    clientWatcher.wait,
    serverWatcher.wait
  ]);

  return {
    stop,
    wait
  };
};

export {
  bundle,
  watch
};
