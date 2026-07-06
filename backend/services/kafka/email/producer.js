const { Kafka, Partitioners } = require("kafkajs");
const logger = require("../../logger/contextLogger");
const { enqueueEmail } = require("../email");
const {
  isKafkaEnabled,
  getKafkaBrokers,
  getKafkaEmailTopic,
} = require("../../../config/env");

const TOPIC_NAME = getKafkaEmailTopic();

let kafka = null;
let producer = null;
let producerConnected = false;
let producerConnecting = null;

function getKafkaProducer() {
  if (!isKafkaEnabled()) {
    return null;
  }

  if (!kafka) {
    kafka = new Kafka({
      clientId: "email-processor",
      brokers: getKafkaBrokers(),
    });

    producer = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });
  }

  return producer;
}

const ensureProducerConnected = async () => {
  const activeProducer = getKafkaProducer();
  if (!activeProducer) {
    throw new Error("Kafka email producer is disabled (KAFKA_ENABLED=false)");
  }

  if (producerConnected) {
    return;
  }

  if (producerConnecting) {
    return producerConnecting;
  }

  producerConnecting = (async () => {
    try {
      await activeProducer.connect();
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

const sendEmailUsingKafka = async (to, subject, text, html, options = {}) => {
  if (isKafkaEnabled()) {
    try {
      await ensureProducerConnected();
      const activeProducer = getKafkaProducer();

      await activeProducer.send({
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
      return;
    } catch (error) {
      logger.kafkaLogs.error("Error sending message to Kafka", {
        error,
        to,
        subject,
      });
    }
  }

  return enqueueEmail({
    to,
    subject,
    text,
    html,
    idempotencyKey: options.idempotencyKey,
    provider: "SMTP",
  });
};

const shutdownProducer = async () => {
  try {
    if (producerConnected && producer) {
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

module.exports = { producer: getKafkaProducer, sendEmailUsingKafka, shutdownProducer };
