import Process from "node:process";

import { build } from "./core.js";

const main = async () => {
  const projectPath = Process.cwd();

  return build(projectPath);
};

main();
