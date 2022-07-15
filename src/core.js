import Path from "node:path";

import Chokidar from "chokidar";

import * as Bundle from "./bundle.js";
import * as Codegen from "./codegen.js";
import * as Config from "./config.js";
import * as Http from "./http.js";
import * as Logger from "./logger.js";
import * as Paths from "./paths.js";
import * as Ssr from "./ssr.js";
import * as Utility from "./utility.js";

const CLIENT_BUNDLE_FILE_NAME = "mesmer-client.js";
const CONFIG_FILE_NAME = "mesmer.json";
const METADATA_FILE_NAME = "metadata.json";
const SERVER_BUNDLE_FILE_NAME = "mesmer-server.js";
const BUILD_DIRECTORY_NAME = "build";

const createPaths = projectDirectoryPath => {
  const buildDirectoryPath = Path.join(
    projectDirectoryPath,
    BUILD_DIRECTORY_NAME
  );

  return Paths.Paths({
    projectDirectoryPath,
    buildDirectoryPath,
    configFilePath: Path.join(projectDirectoryPath, CONFIG_FILE_NAME),
    clientBundleFilePath: Path.join(
      buildDirectoryPath,
      CLIENT_BUNDLE_FILE_NAME
    ),
    serverBundleFilePath: Path.join(
      buildDirectoryPath,
      SERVER_BUNDLE_FILE_NAME
    ),
    metadataFilePath: Path.join(buildDirectoryPath, METADATA_FILE_NAME)
  });
};

const resolvePages = async (pageGlobPatterns, projectDirectoryPath) => {
  const pageModuleFilePaths = await Utility.globAll(
    pageGlobPatterns,
    projectDirectoryPath
  );

  const pages = pageModuleFilePaths.map(moduleFilePath => Bundle.Page({
    moduleFilePath,
    moduleExportName: Codegen.generatePageModuleExportName(moduleFilePath)
  }));

  return pages;
};

const build = async projectDirectoryPath => {
  const paths = createPaths(projectDirectoryPath);
  const config = await Config.readConfigFile(paths.configFilePath);
  const {
    metadata: projectMetadata,
    build: {
      baseUrl
    }
  } = config;

  const pages = await resolvePages(config.build.pages, projectDirectoryPath);

  await Bundle.bundle(
    Bundle.BundleOptions({
      paths,
      pages,
      baseUrl
    })
  );

  return Ssr.renderFromBundle(
    Ssr.SsrOptions({
      paths,
      projectMetadata,
      baseUrl,
      bundlePages: pages
    })
  );
};

const serve = async projectDirectoryPath => {
  const paths = createPaths(projectDirectoryPath);
  const config = await Config.readConfigFile(paths.configFilePath);
  const { metadata: projectMetadata } = config;
  const baseUrl = "/"
  const pages = await resolvePages(config.build.pages, projectDirectoryPath);
  const bundleOptions = Bundle.BundleOptions({
    paths,
    pages,
    baseUrl,
    incremental: true
  });

  const ssrOptions = Ssr.SsrOptions({
    paths,
    projectMetadata,
    baseUrl,
    bundlePages: pages
  });

  let { inputFilePaths, rebuild } = await Bundle.bundle(bundleOptions);

  await Ssr.renderFromBundleInWorkerThread(ssrOptions);

  const watcher = Chokidar.watch(
    inputFilePaths,
    { disableGlobbing: true, ignoreInitial: true }
  );

  const server = Http.LiveServer({
    host: "localhost",
    port: 8080,
    rootDirectoryPath: paths.buildDirectoryPath
  });

  await server.start();

  const handleWatchEvent = async (event, path) => {
    if (event === "delete") {
      watcher.add(path);
    }

    try {
      const { inputFilePaths: updatedInputFilePaths } = await rebuild();

      await Ssr.renderFromBundleInWorkerThread(ssrOptions);

      const createdInputFilePaths = Utility.arrayDiff(
        updatedInputFilePaths,
        inputFilePaths
      );

      const deletedInputFilePaths = Utility.arrayDiff(
        inputFilePaths,
        updatedInputFilePaths
      );

      if (createdInputFilePaths.length !== 0) {
        watcher.add(createdInputFilePaths);
      }

      if (deletedInputFilePaths.length !== 0) {
        watcher.unwatch(deletedInputFilePaths);
      }

      inputFilePaths = updatedInputFilePaths;

      server.reload();
    } catch (error) {
      Logger.logError(error);
    }
  };

  watcher.on("add", path => handleWatchEvent("create", path));
  watcher.on("change", path => handleWatchEvent("change", path));
  watcher.on("unlink", path => handleWatchEvent("delete", path));
};

export {
  build,
  serve
};
