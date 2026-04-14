import nodemailer from 'nodemailer';
import { logEmail, updateEmailLogStatus } from './db';

let transporter: nodemailer.Transporter | null = null;

export async function initializeEmailService() {
  try {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      console.warn('Email service disabled: missing Gmail credentials');
      return;
    }

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    console.log('Email service initialized successfully');
  } catch (error) {
    console.error('Error initializing email service:', error);
  }
}

export async function sendConfirmationEmail(
  userId: number,
  recipientEmail: string,
  userName: string,
  productName: string,
  downloadLink: string,
  purchaseId?: number
): Promise<boolean> {
  if (!transporter) return false;
  const subject = `Your ${productName} Report is Ready to Download`;
  try {
    const emailLog = await logEmail(userId, purchaseId || null, 'confirmation', recipientEmail, subject);
    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      text: `Hi ${userName},\n\nYour personalized ${productName} report is ready: ${downloadLink}\n\n(c) 2026 GeneWell.`,
      html: `<p>Hi ${userName},</p><p>Your personalized ${productName} report is ready.</p><p><a href="${downloadLink}">Download your report</a></p>`,
    });
    await updateEmailLogStatus(emailLog.id, 'sent');
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    const emailLog = await logEmail(userId, purchaseId || null, 'confirmation', recipientEmail, subject);
    await updateEmailLogStatus(emailLog.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export async function sendPaymentConfirmationEmail(
  userId: number,
  recipientEmail: string,
  userName: string,
  planName: string,
  amount: number,
  transactionId: string,
  purchaseId?: number
): Promise<boolean> {
  if (!transporter) return false;
  const subject = `Payment Confirmation - ${planName}`;
  try {
    const emailLog = await logEmail(userId, purchaseId || null, 'payment_confirmation', recipientEmail, subject);
    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      text: `Hi ${userName},\n\nPayment received for ${planName}. Amount: Rs.${amount.toFixed(2)}. Transaction ID: ${transactionId}.`,
      html: `<p>Hi ${userName},</p><p>Payment received for ${planName}.</p><p>Amount: ₹${amount.toFixed(2)}</p><p>Transaction ID: ${transactionId}</p>`,
    });
    await updateEmailLogStatus(emailLog.id, 'sent');
    console.log('Payment confirmation email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    const emailLog = await logEmail(userId, purchaseId || null, 'payment_confirmation', recipientEmail, subject);
    await updateEmailLogStatus(emailLog.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export function isEmailServiceAvailable(): boolean {
  return !!transporter && !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
}
