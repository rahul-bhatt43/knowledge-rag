import sgMail from "@sendgrid/mail";
import { config } from "../config/env";

// Validate SendGrid configuration
if (!config.sendgrid.apiKey) {
  console.warn("WARNING: SENDGRID_API_KEY is not set. Email sending will fail.");
}

// Set SendGrid API key
if (config.sendgrid.apiKey) {
  sgMail.setApiKey(config.sendgrid.apiKey);
}

export const sendEmail = async (to: string, subject: string, html: string) => {
  // Validate configuration before sending
  if (!config.sendgrid.apiKey) {
    throw new Error(
      "SendGrid API key is not configured. Please set SENDGRID_API_KEY environment variable."
    );
  }

  if (!config.sendgrid.fromEmail) {
    throw new Error(
      "SendGrid from email is not configured. Please set SENDGRID_FROM_EMAIL environment variable."
    );
  }

  try {
    await sgMail.send({
      from: config.sendgrid.fromEmail,
      to,
      subject,
      html,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error: any) {
    console.error("SendGrid email send error:", error);
    if (error.response) {
      console.error("SendGrid error details:", {
        status: error.response.status,
        body: error.response.body,
        headers: error.response.headers,
      });
    }
    throw error;
  }
};
