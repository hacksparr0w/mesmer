import Fs from "node:fs/promises";
import Path from "node:path";
import Url from "node:url";
import { Worker } from "node:worker_threads";

import commonPath from "common-path";

import {
  extendUrlPath,
  writeJsonFile,
  writeTextFile,
  zip
} from "./utility.js";

const HTML_DOCTYPE = "<!DOCTYPE html>";

const Page = ({ component, templateComponent, metadata }) => ({
  component,
  templateComponent,
  metadata
});

const SsrOptions = ({ paths, projectMetadata, bundlePages, baseUrl }) => ({
  paths,
  projectMetadata,
  bundlePages,
  baseUrl
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

  return writeTextFile(path, contents);
};

const renderFromBundle = async options => {
  const {
    baseUrl,
    bundlePages,
    projectMetadata,
    paths: {
      buildDirectoryPath,
      clientBundleFilePath,
      metadataFilePath,
      serverBundleFilePath
    }
  } = options;

  const { default: bundle } = await import(serverBundleFilePath);
  const { React, ReactDomServer } = bundle;
  const { parsedPaths: commonPageModulePaths } = commonPath(
    bundlePages,
    "moduleFilePath"
  );

  const candidates = zip(
    bundlePages,
    commonPageModulePaths
  ).map(item => {
    const [{ moduleFilePath, moduleExportName }, { subPart, namePart }] = item;
    const documentFilePath = Path.join(
      buildDirectoryPath,
      subPart,
      `${namePart}.html`
    );

    const documentFileUrl = extendUrlPath(
      baseUrl,
      Path.relative(buildDirectoryPath, documentFilePath)
    );

    const module = bundle[moduleExportName];
    const metadata = {
      ...Object.assign({}, module.metadata),
      moduleFilePath,
      moduleExportName,
      documentFileUrl
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

  const clientBundleFileUrl = extendUrlPath(
    baseUrl,
    Path.relative(buildDirectoryPath, clientBundleFilePath)
  );

  const metadata = {
    build: { clientBundleFileUrl },
    project: projectMetadata,
    pages: candidates.map(({ metadata }) => metadata)
  };

  await writeJsonFile(metadataFilePath, metadata);

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

const renderFromBundleInWorkerThread = options => {
  const workerFilePath = Path.join(
    Path.dirname(Url.fileURLToPath(import.meta.url)),
    "./ssr-worker.js"
  );

  const worker = new Worker(workerFilePath, { workerData: { options } });
  const result = new Promise((resolve, reject) => {
    worker.once("exit", resolve);
    worker.once("error", reject);
  });

  return result;
};

export {
  Page,
  SsrOptions,
  renderElementToString,
  renderFromBundle,
  renderFromBundleInWorkerThread,
  renderPageToFile,
  renderPageToString
};
