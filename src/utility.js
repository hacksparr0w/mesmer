import Crypto from "crypto";

import Glob from "glob";

const glob = (pattern, workingDirectoryPath = undefined) => (
  new Promise((resolve, reject) => {
    Glob.glob(pattern, { cwd: workingDirectoryPath }, (error, matches) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(matches);
    });
  })
);

const globAll = async (patterns, workingDirectoryPath = undefined) => {
  const paths = [];

  for (const pattern of patterns) {
    if (!Glob.hasMagic(pattern)) {
      paths.push(pattern);
      continue;
    }

    const matches = await glob(pattern, workingDirectoryPath);
    paths.push(...matches);
  }

  return paths;
};

const hash = text => (
  Crypto.createHash("md5").update(text).digest("hex")
);

export {
  glob,
  globAll,
  hash
};
