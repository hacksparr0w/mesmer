import { workerData } from "node:worker_threads";

import * as Ssr from "./ssr.js";

const { options } = workerData;

Ssr.renderFromBundle(options);
