#!/usr/bin/env node

import Process from "node:process";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { build, serve } from "./core.js";

const handleErrors = callable => async (...args) => {
  try {
    await callable(...args);
  } catch (error) {
    if (!("errors" in error) || error.errors.length < 1) {
      console.log("An unexpected error has occurred");
      console.error(error);
    }

    Process.exit(1);
  }
};

const handleBuildCommand = handleErrors(build);
const handleServeCommand = handleErrors(serve);

const cli = yargs(hideBin(process.argv))
  .command(
    "build",
    "builds a project",
    yargs => yargs.option(
      "projectPath",
      {
        describe: "A path to a project you want to build",
        default: Process.cwd()
      }
    ),
    ({ projectPath }) => handleBuildCommand(projectPath)
  )
  .command(
    "serve",
    "starts a development server",
    yargs => yargs.option(
      "projectPath",
      {
        describe: "A path to a project you want to serve",
        default: Process.cwd()
      }
    ),
    ({ projectPath }) => handleServeCommand(projectPath)
  )
  .demandCommand(1)
  .help();

const main = () => cli.parse();

main();
