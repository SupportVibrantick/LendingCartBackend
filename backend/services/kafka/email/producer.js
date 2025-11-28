const { Kafka } = require("kafkajs");
const logger = require("../../logger/contextLogger");

const TOPIC_NAME = "email-sending";

const kafka = new Kafka({
  clientId: "email-processor",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

const sendEmailUsingKafka = async (to, subject, text, html) => {
  try {
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
    });
  }
};

// Ensure to call this before starting the server
const run = async () => {
  try {
    await producer.connect();
    logger.kafkaLogs.info("Kafka Producer connected");
  } catch (error) {
    logger.kafkaLogs.error("Error connecting Kafka producer", {
      error,
    });
  }
};

run().catch((error) => {
  logger.kafkaLogs.error("Error during Kafka producer initialization", {
    error,
  });
});

module.exports = { producer, sendEmailUsingKafka };