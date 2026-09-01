import test from "node:test";
import assert from "node:assert/strict";
import {
  createServices,
  runtimeApiKey as coreRuntimeApiKey
} from "../functions/iteration1-core/src/appwrite.js";
import { runtimeApiKey as deleteRuntimeApiKey } from "../functions/delete-account/src/main.js";

const runtimeRequest = { headers: { "x-appwrite-key": "runtime-key" } };
const buildEnvironment = {
  APPWRITE_FUNCTION_API_ENDPOINT: "https://example.test/v1",
  APPWRITE_FUNCTION_PROJECT_ID: "project-id",
  APPWRITE_FUNCTION_API_KEY: "build-only-key"
};

test("runtime request key takes precedence over the build-time environment value", () => {
  assert.equal(coreRuntimeApiKey(runtimeRequest, buildEnvironment), "runtime-key");
  assert.equal(deleteRuntimeApiKey(runtimeRequest, buildEnvironment), "runtime-key");
});

test("core services can initialize when the API key exists only in the runtime header", () => {
  const environmentWithoutKey = {
    APPWRITE_FUNCTION_API_ENDPOINT: "https://example.test/v1",
    APPWRITE_FUNCTION_PROJECT_ID: "project-id"
  };

  assert.doesNotThrow(() => createServices(runtimeRequest, environmentWithoutKey));
});

test("legacy environment key remains available for local development", () => {
  assert.equal(coreRuntimeApiKey({ headers: {} }, buildEnvironment), "build-only-key");
  assert.equal(deleteRuntimeApiKey({ headers: {} }, buildEnvironment), "build-only-key");
});
