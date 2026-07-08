const { Kafka } = require("kafkajs");
const logger = require("../../logger/contextLogger");
const sendMail = require("../../emails/mail");
const {
  isKafkaEnabled,
  getKafkaBrokers,
  getKafkaEmailTopic,
} = require("../../../config/env");

let kafka = null;
let consumer = null;

function getKafkaConsumer() {
  if (!isKafkaEnabled()) {
    return null;
  }

  if (!kafka) {
    kafka = new Kafka({
      clientId: "email-processor",
      brokers: getKafkaBrokers(),
    });

    consumer = kafka.consumer({ groupId: "lendingcart-email-group" });
  }

  return consumer;
}

const runEmailConsumerKafka = async () => {
  const activeConsumer = getKafkaConsumer();
  if (!activeConsumer) {
    logger.kafkaLogs.info("Kafka consumer disabled (KAFKA_ENABLED=false)");
    return;
  }

  try {
    await activeConsumer.connect();

    await activeConsumer.subscribe({
      topic: getKafkaEmailTopic(),
      fromBeginning: true,
    });

    logger.commonLogs.info(
      "Kafka Consumer connected & subscribed to email topic.",
    );

    await activeConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const raw = message.value.toString();

          let mailOptions;
          try {
            mailOptions = JSON.parse(raw);
          } catch (parseErr) {
            logger.kafkaLogs.error("Invalid JSON message on topic", {
              topic,
              partition,
              offset: message.offset,
              raw,
              parseErr,
            });
            return;
          }

          const { to, subject, text, html } = mailOptions;

          if (!to) {
            logger.kafkaLogs.error("Kafka email message missing recipient", {
              topic,
              partition,
              offset: message.offset,
            });
            return;
          }

          await sendMail({
            to,
            subject,
            text,
            html,
          });

          logger.kafkaLogs.info("Email sent from Kafka consumer", {
            to,
            subject,
          });
        } catch (err) {
          logger.kafkaLogs.error("Error processing Kafka email message", {
            err,
          });
        }
      },
    });
  } catch (err) {
    logger.kafkaLogs.error("Kafka consumer failed to start", { err });
    throw err;
  }
};

const shutdownConsumer = async () => {
  try {
    if (consumer) {
      logger.kafkaLogs.info("Shutting down Kafka consumer...");
      await consumer.disconnect();
      logger.kafkaLogs.info("Kafka consumer disconnected.");
    }
  } catch (err) {
    logger.kafkaLogs.error("Error during consumer shutdown:", { err });
  }
};

process.on("SIGINT", shutdownConsumer);
process.on("SIGTERM", shutdownConsumer);

module.exports = { runEmailConsumerKafka, shutdownConsumer };
