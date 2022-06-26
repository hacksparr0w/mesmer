import Esbuild from "esbuild";
import { glob } from "./src/utility.js";

const build = async () => {
  const entryPoints = await glob("./src/*.{js,jsx}");

  return Esbuild.build({
    entryPoints,
    format: "esm",
    outdir: "build"
  });
};

build();
