const cron = require("node-cron");

const runCampaignScheduler = (fastify) => {
  console.log("🔥 Campaign Scheduler initialized");

  cron.schedule("* * * * *", async () => {
    const now = new Date();
    console.log("\n⏱ CRON TICK:", now.toISOString());

    try {
      const prisma = fastify.prisma;

      // 1️⃣ Fetch campaigns
      const campaigns = await prisma.campaign.findMany({
        where: {
          isRecurring: true,
          status: "SENT",
        },
      });

      console.log(`📦 Found ${campaigns.length} recurring campaigns`);

      if (!campaigns.length) return;

      for (const campaign of campaigns) {
        console.log("\n🔁 Checking campaign:", campaign.id);

        const lastSent = campaign.lastSentAt || campaign.createdAt;

        let nextRun;

        if (campaign.intervalUnit === "minutes") {
          nextRun = new Date(
            lastSent.getTime() + campaign.intervalValue * 60 * 1000
          );
        }

        if (campaign.intervalUnit === "hours") {
          nextRun = new Date(
            lastSent.getTime() + campaign.intervalValue * 60 * 60 * 1000
          );
        }

        if (campaign.intervalUnit === "days") {
          nextRun = new Date(
            lastSent.getTime() + campaign.intervalValue * 24 * 60 * 60 * 1000
          );
        }

        console.log("🕒 Last Sent:", lastSent);
        console.log("⏭ Next Run:", nextRun);

        // 2️⃣ Check if it's time
        if (!nextRun || now < nextRun) {
          console.log("⏳ Not time yet, skipping...");
          continue;
        }

        console.log("🚀 Running campaign:", campaign.id);

        // 3️⃣ Fetch recipients
        const recipients = await prisma.campaignRecipient.findMany({
          where: { campaignId: campaign.id },
          include: { contact: true },
        });

        console.log(`👥 Found ${recipients.length} recipients`);

        if (!recipients.length) {
          console.log("⚠️ No recipients found, skipping...");
          continue;
        }

        // 4️⃣ Send emails
        for (const r of recipients) {
          const email = r.contact?.email;

          if (!email) {
            console.log("⚠️ Missing email, skipping contact:", r.contact?.id);
            continue;
          }

          try {
            console.log("📤 Sending email to:", email);

            const res = await fastify.ghlService.triggerWebhook({
              email,
              name: r.contact.firstName || "User",
              subject: campaign.subject,
              message: campaign.content,
            });

            console.log("✅ Email sent:", email);

            await prisma.emailLog.create({
              data: {
                campaignId: campaign.id,
                contactId: r.contact.id,
                status: "SENT",
                response: res || {},
              },
            });

          } catch (err) {
            console.error("❌ Email FAILED:", email, "| Error:", err.message);

            try {
              await prisma.emailLog.create({
                data: {
                  campaignId: campaign.id,
                  contactId: r.contact.id,
                  status: "FAILED",
                  response: { error: err.message },
                },
              });
            } catch (logErr) {
              console.error("❌ Log failed:", logErr.message);
            }
          }
        }

        // 5️⃣ Update last run
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            lastSentAt: new Date(),
          },
        });

        console.log("🔄 Campaign updated:", campaign.id);
      }

    } catch (error) {
      console.error("❌ Campaign Scheduler Error:", error.message);
    }
  });
};

module.exports = runCampaignScheduler;