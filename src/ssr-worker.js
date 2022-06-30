import { workerData } from "node:worker_threads";

import * as Ssr from "./ssr.js";

const { paths, config, bundlePages } = workerData;

Ssr.renderFromBundle(paths, config, bundlePages);
