// src/services/emailService.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactNotificationEmail({
  name,
  email,
  inquiryType,
  subject,
  message,
  sentFrom,
  platform,
  accountName,
  accountEmail,
  userId,
  createdAt,
}) {
  const { data, error } = await resend.emails.send({
    from: process.env.CONTACT_FROM_EMAIL,
    to: [process.env.CONTACT_TO_EMAIL],
    subject: `[Contacto App] ${subject}`,
    replyTo: email,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Nuevo mensaje desde MGP Rutina Fitness</h2>
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Tipo:</strong> ${inquiryType}</p>
        <p><strong>Enviado desde:</strong> ${sentFrom}</p>
        <p><strong>Plataforma:</strong> ${platform}</p>
        <p><strong>Cuenta asociada:</strong> ${accountName ?? '-'} (${accountEmail ?? '-'})</p>
        <p><strong>User ID:</strong> ${userId ?? '-'}</p>
        <p><strong>Fecha:</strong> ${createdAt}</p>
        <hr />
        <p><strong>Mensaje:</strong></p>
        <p>${String(message).replace(/\n/g, '<br />')}</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || 'No se pudo enviar el correo con Resend');
  }

  return data;
}