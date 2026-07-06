const cron = require("node-cron");
const { runCronJob } = require("../services/jobs");
const { enqueueGhlEmail } = require("../services/email");

const JOB_NAME = "campaign-recurring";
const LOCK_TTL_MS = 10 * 60 * 1000;

function computeNextRun(campaign) {
  const lastSent = campaign.lastSentAt || campaign.createdAt;

  if (campaign.intervalUnit === "minutes") {
    return new Date(lastSent.getTime() + campaign.intervalValue * 60 * 1000);
  }

  if (campaign.intervalUnit === "hours") {
    return new Date(lastSent.getTime() + campaign.intervalValue * 60 * 60 * 1000);
  }

  if (campaign.intervalUnit === "days") {
    return new Date(
      lastSent.getTime() + campaign.intervalValue * 24 * 60 * 60 * 1000,
    );
  }

  return null;
}

async function processRecurringCampaigns(prisma, log) {
  const now = new Date();

  const campaigns = await prisma.campaign.findMany({
    where: {
      isRecurring: true,
      status: "SENT",
    },
  });

  let campaignsRun = 0;
  let emailsEnqueued = 0;
  let emailsFailed = 0;

  for (const campaign of campaigns) {
    const nextRun = computeNextRun(campaign);

    if (!nextRun || now < nextRun) {
      continue;
    }

    campaignsRun += 1;

    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id },
      include: { contact: true },
    });

    for (const recipient of recipients) {
      const email = recipient.contact?.email;
      if (!email) {
        continue;
      }

      try {
        await enqueueGhlEmail({
          prisma,
          to: email,
          subject: campaign.subject,
          text: campaign.content,
          providerMeta: {
            name: recipient.contact.firstName || "User",
            message: campaign.content,
          },
          idempotencyKey: `campaign-recurring:${campaign.id}:${recipient.contact.id}:${nextRun.toISOString()}`,
        });

        emailsEnqueued += 1;

        await prisma.emailLog.create({
          data: {
            campaignId: campaign.id,
            contactId: recipient.contact.id,
            status: "SENT",
            response: { queued: true },
          },
        });
      } catch (error) {
        emailsFailed += 1;
        log?.warn(
          {
            campaignId: campaign.id,
            contactId: recipient.contact.id,
            error: error.message,
          },
          "Recurring campaign email enqueue failed",
        );

        try {
          await prisma.emailLog.create({
            data: {
              campaignId: campaign.id,
              contactId: recipient.contact.id,
              status: "FAILED",
              response: { error: error.message },
            },
          });
        } catch (logErr) {
          log?.error(
            { err: logErr, campaignId: campaign.id },
            "Failed to write campaign email log",
          );
        }
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { lastSentAt: new Date() },
    });
  }

  return {
    campaignsChecked: campaigns.length,
    campaignsRun,
    emailsEnqueued,
    emailsFailed,
  };
}

function runCampaignScheduler(fastify) {
  fastify.log.info("Campaign scheduler initialized");

  cron.schedule("* * * * *", async () => {
    try {
      await runCronJob({
        prisma: fastify.prisma,
        log: fastify.log,
        jobName: JOB_NAME,
        ttlMs: LOCK_TTL_MS,
        handler: () => processRecurringCampaigns(fastify.prisma, fastify.log),
      });
    } catch (error) {
      fastify.log.error({ err: error }, "Campaign scheduler failed");
    }
  });
}

module.exports = runCampaignScheduler;
