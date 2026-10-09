#!/usr/bin/env node
/**
 * install-targets/opencode.mjs -- the `opencode` install target (distribute P03, ADR-2005/2018).
 *
 * The plan is the shared rendered plan (rendered.mjs); apply and doctor are the shared transaction
 * (common.mjs). The record is `<dir>/.arc-install.json`.
 */

import { MANIFEST, apply, doctor } from "./common.mjs";
import { renderedPlan } from "./rendered.mjs";

export const ID = "opencode";
export const MANIFEST_PATH = MANIFEST;
export const plan = (tree) => renderedPlan(tree, ID);
export { apply, doctor };
