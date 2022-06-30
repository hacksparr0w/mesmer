import { readJsonFile } from "./utility.js";

const readConfigFile = async path => {
  const data = await readJsonFile(path);

  const metadata = data.metadata ?? {};
  const pages = data.pages ?? [];

  // TODO: We could probably use some validation here

  return {
    metadata,
    pages
  };
};

export {
  readConfigFile
};
