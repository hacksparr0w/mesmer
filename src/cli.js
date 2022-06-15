import Process from "process";

import { build } from "./core.js";

const main = async () => {
  const projectPath = Process.cwd();

  console.log(`Building project at ${projectPath}`);

  return build(projectPath);
};

main();
