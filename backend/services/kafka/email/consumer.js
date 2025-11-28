const { Kafka } = require("kafkajs");
const logger = require("../../logger/contextLogger");
const sendMail = require("../../mail");

const kafka = new Kafka({
  clientId: "email-processor",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "mlm-email-group" });

const runEmailConsumerKafka = async () => {
  try {
    await consumer.connect();

    await consumer.subscribe({
      topic: "email-sending",
      fromBeginning: true,
    });

    logger.commonLogs.info(
      "Kafka Consumer connected & subscribed to email topic."
    );

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          // Parse the message
          const mailOptions = JSON.parse(message.value.toString());
          // Attempt to send the email
          await sendMail(mailOptions);
        } catch (error) {
          // Log error while processing message
          logger.kafkaLogs.error("Error processing message:", {
            error,
          });
        }
      },
    });
  } catch (error) {
    // Log error while starting the consumer
    logger.kafkaLogs.error("Error starting the consumer:", {
      error,
    });
  }
};

// Ensure to catch consumer crash events
consumer.on("consumer.crash", async (event) => {
  logger.kafkaLogs.error(`Consumer crashed: ${JSON.stringify(event)}`);
});

consumer.on("consumer.stop", () => {
  logger.kafkaLogs.info("Consumer has been stopped.");
});

consumer.on("consumer.group_join", async (event) => {
  logger.kafkaLogs.info(`Consumer group joined: ${JSON.stringify(event)}`);
});

module.exports = { runEmailConsumerKafka };