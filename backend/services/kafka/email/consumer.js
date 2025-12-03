// services/kafka/consumer.js
const { Kafka } = require("kafkajs");
const logger = require("../../logger/contextLogger");
const sendMail = require("../../mail");

const kafka = new Kafka({
  clientId: "email-processor",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "lendingcart-email-group" });

const runEmailConsumerKafka = async () => {
  try {
    await consumer.connect();

    await consumer.subscribe({
      topic: "email-sending",
      fromBeginning: true,
    });

    logger.commonLogs.info("Kafka Consumer connected & subscribed to email topic.");

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        // Each message handled inside try/catch to prevent crashes
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
            return; // skip this message
          }

          // Optional: basic validation of required fields
          if (!mailOptions || !mailOptions.to) {
            logger.kafkaLogs.error("Invalid mailOptions (missing 'to')", {
              topic,
              partition,
              offset: message.offset,
              mailOptions,
            });
            return;
          }

          // Attempt to send the email
          await sendMail(mailOptions);
          logger.kafkaLogs.info("Processed email message from Kafka", {
            topic,
            partition,
            offset: message.offset,
            to: mailOptions.to,
          });
        } catch (error) {
          // Log error while processing message (sendMail failure etc)
          logger.kafkaLogs.error("Error processing message:", {
            error,
            topic,
            partition,
            offset: message?.offset,
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

// Consumer event handlers
consumer.on("consumer.crash", async (event) => {
  logger.kafkaLogs.error(`Consumer crashed: ${JSON.stringify(event)}`);
});

consumer.on("consumer.stop", () => {
  logger.kafkaLogs.info("Consumer has been stopped.");
});

consumer.on("consumer.group_join", async (event) => {
  logger.kafkaLogs.info(`Consumer group joined: ${JSON.stringify(event)}`);
});

// Graceful shutdown for consumer
const shutdownConsumer = async () => {
  try {
    logger.kafkaLogs.info("Shutting down Kafka consumer...");
    await consumer.disconnect();
    logger.kafkaLogs.info("Kafka consumer disconnected.");
  } catch (err) {
    logger.kafkaLogs.error("Error during consumer shutdown:", { err });
  }
};

process.on("SIGINT", shutdownConsumer);
process.on("SIGTERM", shutdownConsumer);

module.exports = { runEmailConsumerKafka, shutdownConsumer };
