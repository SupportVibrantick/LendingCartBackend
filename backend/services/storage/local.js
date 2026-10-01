/**
 * Local filesystem storage driver.
 * Keys look like: uploads/loan-documents/{appId}/{reqId}/{file}
 */

const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

function diskPathFromKey(key) {
  const normalized = String(key || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
  return path.join(process.cwd(), ...normalized.split("/").filter(Boolean));
}

function publicUrlFromKey(key) {
  const normalized = String(key || "").replace(/^\/+/, "");
  return `/${normalized}`;
}

async function putStream({ key, stream, contentType }) {
  const filePath = diskPathFromKey(key);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await pipeline(stream, fs.createWriteStream(filePath));
  return {
    key: String(key).replace(/^\/+/, ""),
    url: publicUrlFromKey(key),
    contentType: contentType || null,
    provider: "local",
  };
}

async function putBuffer({ key, buffer, contentType }) {
  const filePath = diskPathFromKey(key);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
  return {
    key: String(key).replace(/^\/+/, ""),
    url: publicUrlFromKey(key),
    contentType: contentType || null,
    provider: "local",
  };
}

async function getStream(key) {
  const filePath = diskPathFromKey(key);
  if (!fs.existsSync(filePath)) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }
  return fs.createReadStream(filePath);
}

async function getBuffer(key) {
  const filePath = diskPathFromKey(key);
  if (!fs.existsSync(filePath)) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }
  return fs.promises.readFile(filePath);
}

async function exists(key) {
  return fs.existsSync(diskPathFromKey(key));
}

async function deleteObject(key) {
  const filePath = diskPathFromKey(key);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

async function copyObject({ fromKey, toKey }) {
  const src = diskPathFromKey(fromKey);
  if (!fs.existsSync(src)) {
    const err = new Error("Source file not found");
    err.statusCode = 404;
    throw err;
  }
  const dest = diskPathFromKey(toKey);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(src, dest);
  return {
    key: String(toKey).replace(/^\/+/, ""),
    url: publicUrlFromKey(toKey),
    provider: "local",
  };
}

function getUrl(key) {
  return publicUrlFromKey(key);
}

module.exports = {
  name: "local",
  putStream,
  putBuffer,
  getStream,
  getBuffer,
  exists,
  delete: deleteObject,
  copyObject,
  getUrl,
  diskPathFromKey,
  publicUrlFromKey,
  Readable,
};
