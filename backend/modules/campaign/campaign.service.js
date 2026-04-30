// modules/campaign/campaign.service.js

const ghlService = require("../ghl/ghl.service");

// 🔥 helper: chunk array (for batching)
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const sendCampaign = async ({
  prisma,
  orgId,
  createdById,
  contacts,
  subject,
  message,
  isRecurring = false,
  intervalValue = null,
  intervalUnit = null,
}) => {
  try {
    // 1️⃣ Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        orgId,
        name: `Campaign ${new Date().toISOString()}`,
        subject,
        content: message,
        status: "PROCESSING",
        createdById: createdById || null,
        isRecurring,
        intervalValue,
        intervalUnit,
        lastSentAt: new Date(),
      },
    });

    const results = [];

    // 2️⃣ Save ALL recipients first (idempotent)
    for (const contact of contacts) {
      if (!contact.id) continue;

      await prisma.campaignRecipient.upsert({
        where: {
          campaignId_contactId: {
            campaignId: campaign.id,
            contactId: contact.id,
          },
        },
        update: {},
        create: {
          campaignId: campaign.id,
          contactId: contact.id,
          status: "PENDING",
        },
      });
    }

    // 3️⃣ Process in batches
    const batches = chunkArray(contacts, 5);

    for (const batch of batches) {
      // 🛑 CHECK BEFORE BATCH (STOP SUPPORT)
      const freshCampaign = await prisma.campaign.findUnique({
        where: { id: campaign.id },
        select: { status: true },
      });

      if (
        freshCampaign.status === "STOPPED" ||
        freshCampaign.status === "FAILED"
      ) {
        console.log("🛑 Campaign stopped before batch:", campaign.id);
        break;
      }

      const promises = batch.map(async (contact) => {
        const contactId = contact.id || null;

        try {
          // 🛑 CHECK INSIDE LOOP (STOP SUPPORT)
          const liveCampaign = await prisma.campaign.findUnique({
            where: { id: campaign.id },
            select: { status: true },
          });

          if (
            liveCampaign.status === "STOPPED" ||
            liveCampaign.status === "FAILED"
          ) {
            return {
              email: contact.email,
              status: "STOPPED",
            };
          }

          if (!contact.email) {
            throw new Error("Email is missing");
          }

          // ❌ skip already SENT (idempotent)
          if (contactId) {
            const existing = await prisma.campaignRecipient.findUnique({
              where: {
                campaignId_contactId: {
                  campaignId: campaign.id,
                  contactId,
                },
              },
            });

            if (existing && existing.status === "SENT") {
              return {
                email: contact.email,
                status: "SKIPPED",
              };
            }
          }

          // 4️⃣ Send email
          const res = await ghlService.triggerWebhook({
            email: contact.email,
            name: contact.name || "User",
            subject,
            message,
          });

          // 5️⃣ Update recipient
          if (contactId) {
            await prisma.campaignRecipient.update({
              where: {
                campaignId_contactId: {
                  campaignId: campaign.id,
                  contactId,
                },
              },
              data: {
                status: "SENT",
                sentAt: new Date(),
                error: null,
              },
            });
          }

          // 6️⃣ Log success
          if (contactId) {
            await prisma.emailLog.create({
              data: {
                campaignId: campaign.id,
                contactId,
                status: "SENT",
                response: res || {},
              },
            });
          }

          return {
            email: contact.email,
            status: "SENT",
          };

        } catch (error) {
          // 7️⃣ Handle failure
          if (contactId) {
            try {
              await prisma.campaignRecipient.update({
                where: {
                  campaignId_contactId: {
                    campaignId: campaign.id,
                    contactId,
                  },
                },
                data: {
                  status: "FAILED",
                  error: error.message,
                },
              });

              await prisma.emailLog.create({
                data: {
                  campaignId: campaign.id,
                  contactId,
                  status: "FAILED",
                  response: { error: error.message },
                },
              });
            } catch (logError) {
              console.error("Log failed:", logError.message);
            }
          }

          return {
            email: contact.email || "N/A",
            status: "FAILED",
            error: error.message,
          };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // 🔥 delay between batches
      await new Promise((r) => setTimeout(r, 500));
    }

    // 8️⃣ Final status (DO NOT override STOPPED)
    const finalCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      select: { status: true },
    });

    if (finalCampaign.status !== "STOPPED") {
      const sent = results.filter((r) => r.status === "SENT").length;
      const failed = results.filter((r) => r.status === "FAILED").length;

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: failed > 0 ? "FAILED" : "SENT",
          sentAt: new Date(),
          lastSentAt: new Date(),
        },
      });
    }

    return {
      campaignId: campaign.id,
      total: contacts.length,
      sent: results.filter((r) => r.status === "SENT").length,
      failed: results.filter((r) => r.status === "FAILED").length,
      skipped: results.filter((r) => r.status === "SKIPPED").length,
      stopped: results.filter((r) => r.status === "STOPPED").length,
      isRecurring,
      results,
    };

  } catch (error) {
    console.error("Campaign Service Error:", error);
    throw new Error("Failed to process campaign");
  }
};

module.exports = {
  sendCampaign,
};