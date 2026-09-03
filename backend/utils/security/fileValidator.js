const fileType = require("file-type");
const { Readable, PassThrough } = require("stream");

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
      resolve(data);
    });
    stream.once("end", () => {
      resolve(null);
    });
    stream.once("error", reject);
  });

  if (!chunk) {
    return { isValid: false, detectedMime: undefined, stream };
  }

  const type = await fileType.fromBuffer(chunk);
  const detectedMime = type?.mime;

  const isValid = !!(detectedMime && allowedMimeTypes.includes(detectedMime));

  // Use a PassThrough stream to prepend the buffer we already read
  const combinedStream = new PassThrough();
  combinedStream.write(chunk);

  // Pipe the original stream into the PassThrough
  stream.pipe(combinedStream);

  // Ensure the combined stream ends when the original stream ends
  stream.on("end", () => {
    combinedStream.end();
  });

  return {
    isValid,
    detectedMime,
    stream: combinedStream,
  };
}

module.exports = { validateFileMimetype };
