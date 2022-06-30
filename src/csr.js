const hydratePage = async (pageModules, metadataFilePath) => {
  let { pathname } = document.location;

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const result = await fetch(metadataFilePath);
  const metadata = await result.json();
  const pageMetadata = metadata.pages.find(
    ({ documentFilePath }) => documentFilePath === pathname
  );

  metadata["page"] = pageMetadata;

  const module = pageModules[pageMetadata.moduleExportName];
  const { default: component, template } = module;

  if (!template) {
    return;
  }

  const element = React.createElement(component, { metadata });
  const container = document.querySelector(
    template.containerSelector
  );

  ReactDomClient.hydrateRoot(container, element);
};

export {
  hydratePage
};
