import Crypto from "node:crypto";
import Fs from "node:fs/promises";

import Glob from "glob";

const DEFAULT_ENCODING = "utf-8";

const flatten = array => (
  array.reduce((accumulator, value) => [...accumulator, ...value], [])
);

const glob = (pattern, parentPath = undefined) => new Promise((resolve, reject) => {
  Glob.glob(pattern, { cwd: parentPath }, (error, matches) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(matches);
  });
});

const globAll = async (patterns, parentPath = undefined) => {
  const result = await Promise.all(
    patterns.map(pattern => glob(pattern, parentPath))
  );

  return flatten(result);
};

const hash = text => (
  Crypto.createHash("md5").update(text).digest("hex")
)

const readTextFile = async (path, encoding = DEFAULT_ENCODING) => (
  Fs.readFile(path, encoding)
);

const readJsonFile = async (path, encoding = undefined) => {
  const text = await readTextFile(path, encoding);
  const data = JSON.parse(text);

  return data;
};

const writeTextFile = async (path, contents, encoding = DEFAULT_ENCODING) => (
  Fs.writeFile(path, contents, encoding)
);

const zip = (...arrays) => {
  const length = Math.min(...arrays.map(array => array.length));
  const result = [];

  for (let index = 0; index < length; index += 1) {
    result.push(arrays.map(array => array[index]));
  }

  return result;
};

export {
  flatten,
  glob,
  globAll,
  hash,
  readTextFile,
  readJsonFile,
  writeTextFile,
  zip
};
