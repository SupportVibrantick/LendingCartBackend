const fileType = require("file-type");
const { Readable } = require("stream");

/**
 * Validates the actual content type of a file stream using magic numbers.
 *
 * @param {Readable} stream - The file stream to validate.
 * @param {string[]} allowedMimeTypes - List of acceptable mimetypes (e.g., ['application/pdf', 'image/jpeg']).
 * @returns {Promise<{isValid: boolean, detectedMime: string|undefined, stream: Readable}>}
 *          Returns the validation result and a new stream that includes the bytes read for detection.
 */
async function validateFileMimetype(stream, allowedMimeTypes) {
  // Read enough bytes for magic number detection (file-type needs up to 4100 bytes)
  const buffer = Buffer.alloc(4100);
  let bytesRead = 0;

  // We read a chunk from the stream
  const chunk = await new Promise((resolve, reject) => {
    stream.once("data", (data) => {
      // We only need the first 4100 bytes
      resolve(data);
    });
    stream.once("error", reject);
  });

  if (!chunk) {
    return { isValid: false, detectedMime: undefined, stream };
  }

  const type = await fileType.fromBuffer(chunk);
  const detectedMime = type?.mime;

  const isValid = !!(detectedMime && allowedMimeTypes.includes(detectedMime));

  // Create a new stream that starts with the chunk we already read
  const combinedStream = new Readable({
    read() {},
    async construct() {
      this.push(chunk);
      // Then pipe the rest of the original stream into this one
      for await (const part of stream) {
        this.push(part);
      }
      this.push(null);
    },
  });

  return {
    isValid,
    detectedMime,
    stream: combinedStream,
  };
}

module.exports = { validateFileMimetype };
