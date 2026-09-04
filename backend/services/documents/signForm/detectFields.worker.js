const { parentPort, workerData } = require("worker_threads");

async function main() {
  const {
    runFieldDetectionPipeline,
  } = require("./detectFields.service");

  const pipeline = await runFieldDetectionPipeline({
    templateFileUrl: workerData.templateFileUrl,
    templateMimeType: workerData.templateMimeType,
    templateFileName: workerData.templateFileName,
    documentName: workerData.documentName,
    options: workerData.options || {},
  });

  parentPort.postMessage({
    ok: true,
    pages: pipeline.pages || [],
    fields: pipeline.fields || [],
    detection: pipeline.detection || null,
  });
}

main().catch((error) => {
  parentPort.postMessage({
    ok: false,
    error: error?.message || String(error),
  });
});
