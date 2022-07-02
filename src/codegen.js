import Path from "node:path";

import * as Csr from "./csr.js";
import * as Utility from "./utility.js";

const generateExports = (names) => {
  const lines = [];

  lines.push("export {");

  for (const name of names) {
    lines.push(`  ${name},`);
  }

  lines.push("};");

  return lines.join("\n");
};

const generatePageModuleExportName = moduleFilePath => {
  let name = Path.parse(moduleFilePath).name;

  name = name.replaceAll(/-/g, "_");

  const id = Utility.hash(moduleFilePath);
  const prefix = name.match(/^\d/) ? "_" : "";

  return `${prefix}${name}${id}`;
};

const generatePageModuleImports = pages => {
  const lines = [];

  for (const { moduleFilePath, moduleExportName } of pages) {
    lines.push(`import * as ${moduleExportName} from "${moduleFilePath}";`);
  }

  return lines.join("\n");
};

const generatePageModuleMap = (name, pages) => {
  const lines = [];

  lines.push(`const ${name} = {};`);

  for (const { moduleExportName } of pages) {
    lines.push(`${name}["${moduleExportName}"] = ${moduleExportName};`);
  }

  return lines.join("\n");
};

const generateClientModuleCode = (pages, metadataFilePath) => {
  const lines = [];

  lines.push(`import React from "react";`);
  lines.push(`import ReactDomClient from "react-dom/client";`);

  lines.push(generatePageModuleImports(pages));

  lines.push(generatePageModuleMap("pageModules", pages));

  lines.push(
    `(${Csr.hydratePage.toString()})(pageModules, "${metadataFilePath}");`
  );

  return lines.join("\n");
};

const generateServerModuleCode = pages => {
  const lines = [];

  lines.push(`import React from "react";`);
  lines.push(`import ReactDomServer from "react-dom/server";`);

  lines.push(generatePageModuleImports(pages));

  const exports = [
    "React",
    "ReactDomServer",
    ...pages.map(({ moduleExportName }) => moduleExportName)
  ];

  lines.push(generateExports(exports));

  return lines.join("\n");
};

export {
  generateClientModuleCode,
  generateExports,
  generatePageModuleExportName,
  generatePageModuleImports,
  generatePageModuleMap,
  generateServerModuleCode
};
