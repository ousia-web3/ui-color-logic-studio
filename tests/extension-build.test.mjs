import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const extensionRoot = new URL("../extension/dist/", import.meta.url);

test("packages a least-privilege Manifest V3 extension", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", extensionRoot), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.deepEqual(manifest.permissions.sort(), [
    "activeTab",
    "contextMenus",
    "storage",
    "unlimitedStorage",
  ]);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.optional_host_permissions, ["http://*/*", "https://*/*"]);
  assert.equal(manifest.options_page, "privacy.html");
});

test("creates the installable extension archive", async () => {
  await access(new URL("../public/downloads/ui-color-logic-studio-extension.zip", import.meta.url));
});

test("packages the studio, manual, and bundled test set", async () => {
  await Promise.all([
    access(new URL("index.html", extensionRoot)),
    access(new URL("background.js", extensionRoot)),
    access(new URL("privacy.html", extensionRoot)),
    access(new URL("icons/icon-128.png", extensionRoot)),
    access(new URL("manual.html", extensionRoot)),
    access(new URL("test-images/fruit-01.webp", extensionRoot)),
    access(new URL("test-images/vegetable-01.webp", extensionRoot)),
    access(new URL("test-images/korean-01.webp", extensionRoot)),
    access(new URL("test-images/western-01.webp", extensionRoot)),
    access(new URL("test-images/chinese-01.webp", extensionRoot)),
  ]);
});
