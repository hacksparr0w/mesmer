import Crypto from "crypto";

import Glob from "glob";

const glob = pattern => new Promise((resolve, reject) => {
  Glob.glob(pattern, (error, matches) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(matches);
  });
});

const hash = text => (
  Crypto.createHash("md5").update(text).digest("hex")
);

export {
  glob,
  hash
};
