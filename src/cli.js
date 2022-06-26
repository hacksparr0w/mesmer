import Process from "node:process";
import Url from "node:url";

import { build } from "./core.js";

const main = () => {
  const projectPath = Process.cwd();

  return build(projectPath);
};

if (Process.argv[1] === Url.fileURLToPath(import.meta.url)) {
  main();
}
