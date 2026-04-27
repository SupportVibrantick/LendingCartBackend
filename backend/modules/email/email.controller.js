const emailService = require("./email.service");

const sendEmail = async (req, reply) => {
  try {
    const { to, name, subject, message } = req.body; //  ADD name

    if (!to || !message) {
      return reply.status(400).send({
        success: false,
        message: "to and message are required",
      });
    }

    const result = await emailService.sendEmail({
      to,
      name,      // PASS name
      subject,
      message,
    });

    return reply.send({
      success: true,
      data: result,
    });
  } catch (err) {
    return reply.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  sendEmail,
};