/**
 * AWS S3 storage driver.
 * Object keys match local relative paths: uploads/loan-documents/...
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getS3Config } = require("./config");
const { Readable } = require("stream");

let clientSingleton = null;

function normalizeKey(key) {
  return String(key || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
}

function getClient() {
  if (clientSingleton) return clientSingleton;
  const cfg = getS3Config();
  const options = {
    region: cfg.region,
  };
  if (cfg.accessKeyId && cfg.secretAccessKey) {
    options.credentials = {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    };
  }
  if (cfg.endpoint) {
    options.endpoint = cfg.endpoint;
    options.forcePathStyle = cfg.forcePathStyle;
  }
  clientSingleton = new S3Client(options);
  return clientSingleton;
}

function resetS3Client() {
  clientSingleton = null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function publicUrlFromKey(key) {
  const normalized = normalizeKey(key);
  const { publicBaseUrl } = getS3Config();
  if (publicBaseUrl) {
    return `${publicBaseUrl}/${normalized}`;
  }
  // Keep frontend-compatible relative URL; app proxies /uploads/* from S3.
  return `/${normalized}`;
}

async function putStream({ key, stream, contentType }) {
  const buffer = await streamToBuffer(stream);
  return putBuffer({ key, buffer, contentType });
}

async function putBuffer({ key, buffer, contentType }) {
  const cfg = getS3Config();
  const normalized = normalizeKey(key);
  await getClient().send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: normalized,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    }),
  );
  return {
    key: normalized,
    url: publicUrlFromKey(normalized),
    contentType: contentType || null,
    provider: "s3",
  };
}

async function getStream(key) {
  const cfg = getS3Config();
  const normalized = normalizeKey(key);
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: normalized,
    }),
  );
  if (!result.Body) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }
  if (typeof result.Body.transformToWebStream === "function") {
    return Readable.fromWeb(result.Body.transformToWebStream());
  }
  return result.Body;
}

async function getBuffer(key) {
  const stream = await getStream(key);
  return streamToBuffer(stream);
}

async function exists(key) {
  const cfg = getS3Config();
  const normalized = normalizeKey(key);
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: cfg.bucket,
        Key: normalized,
      }),
    );
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      return false;
    }
    throw err;
  }
}

async function deleteObject(key) {
  const cfg = getS3Config();
  const normalized = normalizeKey(key);
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: cfg.bucket,
      Key: normalized,
    }),
  );
}

async function copyObject({ fromKey, toKey }) {
  const cfg = getS3Config();
  const source = normalizeKey(fromKey);
  const dest = normalizeKey(toKey);
  await getClient().send(
    new CopyObjectCommand({
      Bucket: cfg.bucket,
      CopySource: `${cfg.bucket}/${source}`,
      Key: dest,
    }),
  );
  return {
    key: dest,
    url: publicUrlFromKey(dest),
    provider: "s3",
  };
}

function getUrl(key) {
  return publicUrlFromKey(key);
}

async function getSignedDownloadUrl(key, expiresInSeconds = 3600) {
  const cfg = getS3Config();
  const normalized = normalizeKey(key);
  const command = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: normalized,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

module.exports = {
  name: "s3",
  putStream,
  putBuffer,
  getStream,
  getBuffer,
  exists,
  delete: deleteObject,
  copyObject,
  getUrl,
  getSignedDownloadUrl,
  resetS3Client,
  normalizeKey,
};
