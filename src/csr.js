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
  const { parent, template: childTemplate, default: childComponent } = module;

  let template = childTemplate;
  let component = childComponent;

  if (parent) {
    const { template: parentTemplate, default: parentComponent } = parent;

    template = parentTemplate ?? template;
    component = (props) => (
      React.createElement(
        parentComponent,
        props,
        React.createElement(childComponent, props)
      )
    );
  }

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
