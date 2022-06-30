import Path from "node:path";

import LiveServer from "live-server";

import * as Bundle from "./bundle.js";
import * as Paths from "./paths.js";
import * as Ssr from "./ssr.js";

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

const build = async projectDirectoryPath => {
  const paths = createPaths(projectDirectoryPath);
  const { config, pages } = await Bundle.bundle(paths);

  return Ssr.renderFromBundle(paths, config, pages);
};

const serve = async projectDirectoryPath => {
  const paths = createPaths(projectDirectoryPath);
  const serveOptions = {
    root: paths.buildDirectoryPath,
    host: "0.0.0.0",
    port: 8080,
    wait: 0.5,
    logLevel: 0
  };

  const onRebuild = async (error, result) => {
    if (error) {
      return;
    }

    const { config, pages } = result;

    try {
      await Ssr.renderFromBundleInWorkerThread(paths, config, pages);
    } catch (error) {
      console.error(error);
    }
  };

  const { wait } = await Bundle.watch(paths, onRebuild);

  LiveServer.start(serveOptions);

  return wait();
};

export {
  build,
  serve
};
