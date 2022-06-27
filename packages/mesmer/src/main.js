#!/usr/bin/env node

import Process from "node:process";

import { build } from "./core.js";

const main = () => {
  const projectPath = Process.cwd();

  return build(projectPath);
};

main();
