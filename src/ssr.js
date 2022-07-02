import Fs from "node:fs/promises";
import Path from "node:path";
import Url from "node:url";
import { Worker } from "node:worker_threads";

import commonPath from "common-path";

import * as Utility from "./utility.js";

const HTML_DOCTYPE = "<!DOCTYPE html>";

const Page = ({ component, templateComponent, metadata }) => ({
  component,
  templateComponent,
  metadata
});

const renderElementToString = (ReactDomServer, element) => {
  let contents = ReactDomServer.renderToString(element);

  contents = HTML_DOCTYPE + contents;

  return contents;
};

const renderPageToString = (React, ReactDomServer, page) => {
  const props = { metadata: page.metadata };
  let element = React.createElement(page.component, props);

  if (page.templateComponent) {
    element = React.createElement(page.templateComponent, props, element);
  }

  return renderElementToString(ReactDomServer, element);
};

const renderPageToFile = (React, ReactDomServer, page, path) => {
  const contents = renderPageToString(React, ReactDomServer, page);

  return Utility.writeTextFile(path, contents);
};

const renderFromBundle = async (paths, config, bundlePages) => {
  const {
    buildDirectoryPath,
    clientBundleFilePath,
    metadataFilePath,
    serverBundleFilePath
  } = paths;

  const { default: bundle } = await import(serverBundleFilePath);
  const { React, ReactDomServer } = bundle;
  const { parsedPaths: commonPageModulePaths } = commonPath(
    bundlePages,
    "moduleFilePath"
  );

  const candidates = Utility.zip(
    bundlePages,
    commonPageModulePaths
  ).map(item => {
    const [{ moduleFilePath, moduleExportName }, { subPart, namePart }] = item;
    const documentFilePath = Path.join(
      buildDirectoryPath,
      subPart,
      `${namePart}.html`
    );

    const module = bundle[moduleExportName];
    const metadata = {
      ...Object.assign({}, module.metadata),
      moduleFilePath,
      moduleExportName,
      documentFilePath: (
        `/${Path.relative(buildDirectoryPath, documentFilePath)}`
      )
    };

    const {
      parent,
      template: childTemplate,
      default: childComponent
    } = module;

    let templateComponent = childTemplate?.default;
    let component = childComponent;

    if (parent) {
      const { template: parentTemplate, default: parentComponent } = parent;
      templateComponent = parentTemplate?.default ?? templateComponent;

      component = (props) => (
        React.createElement(
          parentComponent,
          props,
          React.createElement(childComponent, props)
        )
      );
    }

    return {
      component,
      documentFilePath,
      templateComponent,
      metadata
    };
  });

  const metadata = {
    build: {
      clientBundleFilePath: (
        `/${Path.relative(buildDirectoryPath, clientBundleFilePath)}`
      )
    },
    project: config.metadata,
    pages: candidates.map(({ metadata }) => metadata)
  };

  await Utility.writeJsonFile(metadataFilePath, metadata);

  return Promise.all(candidates.map(async candidate => {
    const { component, documentFilePath, templateComponent } = candidate;
    const page = Page({
      component,
      templateComponent,
      metadata: {
        ...metadata,
        page: candidate.metadata
      }
    });

    const parentDirectoryPath = Path.dirname(documentFilePath);

    try {
      await Fs.stat(parentDirectoryPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        await Fs.mkdir(parentDirectoryPath, { recursive: true });
      } else {
        throw error;
      }
    }

    return renderPageToFile(React, ReactDomServer, page, documentFilePath);
  }));
};

const renderFromBundleInWorkerThread = (paths, config, bundlePages) => {
  const workerFilePath = Path.join(
    Path.dirname(Url.fileURLToPath(import.meta.url)),
    "./ssr-worker.js"
  );

  const worker = new Worker(
    workerFilePath,
    { workerData: { paths, config, bundlePages } }
  );

  const result = new Promise((resolve, reject) => {
    worker.once("exit", resolve);
    worker.once("error", reject);
  });

  return result;
};

export {
  Page,
  renderElementToString,
  renderFromBundle,
  renderFromBundleInWorkerThread,
  renderPageToFile,
  renderPageToString
};
