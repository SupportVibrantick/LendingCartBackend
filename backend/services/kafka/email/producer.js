// services/kafka/producer.js
const { Kafka, Partitioners } = require("kafkajs");
const logger = require("../../logger/contextLogger");

const TOPIC_NAME = "email-sending";

const kafka = new Kafka({
  clientId: "email-processor",
  brokers: ["localhost:9092"],
});

// Use legacy partitioner to retain previous behaviour and silence warning
const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

let producerConnected = false;
let producerConnecting = null;

// Ensure producer is connected (guard against race)
const ensureProducerConnected = async () => {
  if (producerConnected) return;
  if (producerConnecting) {
    // if connection in progress, wait for it
    return producerConnecting;
  }
  producerConnecting = (async () => {
    try {
      await producer.connect();
      producerConnected = true;
      logger.kafkaLogs.info("Kafka Producer connected");
    } catch (err) {
      logger.kafkaLogs.error("Error connecting Kafka producer", { err });
      throw err;
    } finally {
      producerConnecting = null;
    }
  })();

  return producerConnecting;
};

const sendEmailUsingKafka = async (to, subject, text, html) => {
  try {
    await ensureProducerConnected();

    await producer.send({
      topic: TOPIC_NAME,
      messages: [
        {
          value: JSON.stringify({
            to,
            subject,
            text,
            html,
          }),
        },
      ],
    });

    logger.kafkaLogs.info(`Email request sent to Kafka topic=${TOPIC_NAME}`, {
      to,
      subject,
    });
  } catch (error) {
    logger.kafkaLogs.error("Error sending message to Kafka", {
      error,
      to,
      subject,
    });
    throw error;
  }
};

// Initialize producer connection at startup (but sendEmailUsingKafka will also await it)
const run = async () => {
  try {
    await ensureProducerConnected();
  } catch (error) {
    logger.kafkaLogs.error("Error during Kafka producer initialization", {
      error,
    });
  }
};
run().catch((error) => {
  logger.kafkaLogs.error("Error during Kafka producer initialization", {
    error,
  });
});

// Graceful shutdown
const shutdownProducer = async () => {
  try {
    if (producerConnected) {
      logger.kafkaLogs.info("Shutting down Kafka producer...");
      await producer.disconnect();
      producerConnected = false;
      logger.kafkaLogs.info("Kafka producer disconnected.");
    }
  } catch (err) {
    logger.kafkaLogs.error("Error during producer shutdown:", { err });
  }
};

process.on("SIGINT", shutdownProducer);
process.on("SIGTERM", shutdownProducer);

module.exports = { producer, sendEmailUsingKafka, shutdownProducer };
