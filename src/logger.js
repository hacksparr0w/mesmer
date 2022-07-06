import * as Esbuild from "esbuild";

const logError = (error) => {
  const { errors } = error;
  if (errors instanceof Array) {
    const formatted = Esbuild.formatMessagesSync(errors, { kind: "error" });
    const output = formatted.join("\n");

    console.error(output);
    return;
  }

  console.error(error);
};

export {
  logError
};
