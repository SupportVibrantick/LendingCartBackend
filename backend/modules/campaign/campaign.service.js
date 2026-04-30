const ghlService = require("../ghl/ghl.service");

// 🔥 helper: chunk array (for scalability)
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
}) => {
  // 1️⃣ Create Campaign
  const campaign = await prisma.campaign.create({
    data: {
      orgId,
      name: `Campaign ${new Date().toISOString()}`,
      subject,
      content: message,
      status: "PROCESSING",
      createdById: createdById || null,
    },
  });

  const results = [];

  // 🔥 process in batches (scalable)
  const batches = chunkArray(contacts, 5); // adjust batch size if needed

  for (const batch of batches) {
    const promises = batch.map(async (contact) => {
      let contactId = contact.id || null;

      try {
        if (!contact.email) {
          throw new Error("Email is missing");
        }

        // 2️⃣ Send email
        const res = await ghlService.triggerWebhook({
          email: contact.email, // ✅ matches your ghl.service
          name: contact.name || "User",
          subject,
          message,
        });

        // 3️⃣ Save recipient (if exists)
        if (contactId) {
          await prisma.campaignRecipient.create({
            data: {
              campaignId: campaign.id,
              contactId,
            },
          });
        }

        // 4️⃣ Log success (ONLY if contactId exists)
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
        // 5️⃣ Log failure safely
        if (contactId) {
          try {
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

    // 🔥 small delay between batches (rate-limit safe)
    await new Promise((r) => setTimeout(r, 500));
  }

  // 6️⃣ Final campaign status
  const sent = results.filter((r) => r.status === "SENT").length;
  const failed = results.length - sent;

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: failed > 0 ? "FAILED" : "SENT",
      sentAt: new Date(),
    },
  });

  return {
    campaignId: campaign.id,
    total: contacts.length,
    sent,
    failed,
    results,
  };
};

module.exports = {
  sendCampaign,
};