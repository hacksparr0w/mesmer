import { readJsonFile } from "./utility.js";

const readConfigFile = async path => {
  const data = await readJsonFile(path);

  const metadata = data.metadata ?? {};
  const build = {
    baseUrl: data.build?.baseUrl ?? "/",
    pages: data.build?.pages ?? []
  };

  // TODO: We could probably use some validation here

  return {
    metadata,
    build
  };
};

export {
  readConfigFile
};
