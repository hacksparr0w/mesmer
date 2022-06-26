import Path from "node:path";

import { commonjs as EsmPlugin } from "@hyrious/esbuild-plugin-commonjs";
import MdxPlugin from "@mdx-js/esbuild";
import commonPath from "common-path";
import Esbuild from "esbuild";

import {
  globAll,
  hash,
  readJsonFile,
  writeJsonFile,
  writeTextFile,
  zip
} from "./utility.js";

const APP_BUNDLE_FILE_NAME = "app.mjs";
const APP_METADATA_FILE_NAME = "metadata.json";
const BUILD_DIR_NAME = "build";
const CONFIG_FILE_NAME = "mesmer.json";
const CONFIG_FILE_PATTERN = /mesmer.json$/;
const REACT_BUNDLE_FILE_NAME = "react.mjs";
const REACT_DOM_CLIENT_BUNDLE_FILE_NAME = "react-dom-client.mjs";
const REACT_DOM_SERVER_BUNDLE_FILE_NAME = "react-dom-server.mjs";

const REACT_DOM_CLIENT_MODULE_REL_PATH = "./node_modules/react-dom/client.js";
const REACT_DOM_SERVER_MODULE_REL_PATH = "./node_modules/react-dom/server.js";
const REACT_DOM_MODULES_PATTERN = /react-dom/;
const REACT_MODULE_REL_PATH = "./node_modules/react/index.js";
const REACT_MODULE_PATTERN = /^react$/;

const generatePageExportName = path => (
  Path.parse(path).name + hash(path)
);

const generateAppModuleCode = pages => {
  const lines = [];

  for (const { path, exportName } of pages) {
    lines.push(`export { default as ${exportName} } from "${path}";`);
  }

  const code = lines.join("\n");

  return code;
};

const expandConfig = async (config, projectPath) => {
  const pagePaths = await globAll(config.pages, projectPath);
  const pagePathsWithExportNames = pagePaths.map(path => ({
    path,
    exportName: generatePageExportName(path)
  }));

  const metadata = config.metadata ?? {};

  return {
    ...config,
    metadata,
    pages: pagePathsWithExportNames
  };
};

const buildPages = async (projectPath, config) => {
  const buildPath = Path.join(projectPath, BUILD_DIR_NAME);
  const appMetadataPath = Path.join(buildPath, APP_METADATA_FILE_NAME);
  const appBundlePath = Path.join(buildPath, APP_BUNDLE_FILE_NAME);
  const reactBundlePath = Path.join(buildPath, REACT_BUNDLE_FILE_NAME);
  const reactDomServerBundlePath = Path.join(
    buildPath,
    REACT_DOM_SERVER_BUNDLE_FILE_NAME
  );

  const App = await import(appBundlePath);
  const { default: React } = await import(reactBundlePath);
  const { default: ReactDomServer } = await import(reactDomServerBundlePath);

  const { pages, metadata: projectMetadata } = config;
  const { parsedPaths: pageCommonPaths } = commonPath(pages, "path");

  const candidates = zip(pages, pageCommonPaths).map(page => {
    const [{ exportName }, { subPart, namePart }] = page;
    const pageRelPath = "/" + Path.join(subPart, `${namePart}.html`);
    const pageBuildPath = Path.join(buildPath, pageRelPath);
    const component = App[exportName];
    const metadata = Object.assign({}, component.metadata, { exportName });

    return {
      pageRelPath,
      pageBuildPath,
      component,
      metadata
    };
  });

  const pagesMetadata = Object.fromEntries(
    candidates.map(({ pageRelPath, metadata }) => [pageRelPath, metadata])
  );

  const appMetadata = { pages: pagesMetadata, project: projectMetadata };

  await writeJsonFile(appMetadataPath, appMetadata);

  return Promise.all(candidates.map(candidate => {
    const { pageBuildPath, component, metadata: pageMetadata } = candidate;
    const metadata = { ...appMetadata, page: pageMetadata };
    const element = React.createElement(component, { metadata });
    const contents = ReactDomServer.renderToString(element);

    return writeTextFile(pageBuildPath, contents);
  }));
};

const MesmerPlugin = projectPath => ({
  name: "mesmer",
  setup: build => {
    let config;

    build.onLoad({ filter: CONFIG_FILE_PATTERN }, async ({ path }) => {
      config = await readJsonFile(path);
      config = await expandConfig(config, projectPath);

      const { pages } = config;
      const contents = generateAppModuleCode(pages);

      return {
        contents,
        loader: "js"
      };
    });

    build.onResolve({ filter: REACT_MODULE_PATTERN }, () => ({
      path: `./${REACT_BUNDLE_FILE_NAME}`,
      external: true
    }));

    build.onEnd(({ errors }) => {
      if (errors.length !== 0) {
        return;
      }

      return buildPages(projectPath, config);
    });
  }
});

const build = async projectPath => {
  const buildPath = Path.join(projectPath, BUILD_DIR_NAME);
  const configPath = Path.join(projectPath, CONFIG_FILE_NAME);

  const reactModulePath = Path.join(projectPath, REACT_MODULE_REL_PATH);
  const reactDomClientModulePath = Path.join(
    projectPath,
    REACT_DOM_CLIENT_MODULE_REL_PATH
  );

  const reactDomServerModulePath = Path.join(
    projectPath,
    REACT_DOM_SERVER_MODULE_REL_PATH
  );

  const { name: appBundlePath } = Path.parse(APP_BUNDLE_FILE_NAME);
  const { name: reactBundlePath } = Path.parse(REACT_BUNDLE_FILE_NAME);
  const { name: reactDomClientBundlePath } = Path.parse(
    REACT_DOM_CLIENT_BUNDLE_FILE_NAME
  );

  const { name: reactDomServerBundlePath } = Path.parse(
    REACT_DOM_SERVER_BUNDLE_FILE_NAME
  );

  return Esbuild.build({
    entryPoints: {
      [appBundlePath]: configPath,
      [reactBundlePath]: reactModulePath,
      [reactDomClientBundlePath]: reactDomClientModulePath,
      [reactDomServerBundlePath]: reactDomServerModulePath
    },
    outdir: buildPath,
    bundle: true,
    format: "esm",
    outExtension: { ".js": ".mjs" },
    external: ["stream", "util"],
    plugins: [
      MdxPlugin(),
      MesmerPlugin(projectPath),
      EsmPlugin({ filter: REACT_DOM_MODULES_PATTERN })
    ]
  });
};

export {
  build
};
