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

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const { data, error } = await resend.emails.send({
    from: process.env.CONTACT_FROM_EMAIL,
    to: [to],
    subject: 'Restablece tu contraseña - MGP Rutina Fitness',
    replyTo: process.env.CONTACT_TO_EMAIL,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Recuperación de contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace para continuar:</p>
        <p>
          <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">
            Restablecer contraseña
          </a>
        </p>
        <p>Este enlace caduca en 1 hora.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || 'No se pudo enviar el correo de recuperación');
  }

  return data;
}

export async function sendWelcomeEmail({ to, name }) {
  const { data, error } = await resend.emails.send({
    from: process.env.CONTACT_FROM_EMAIL,
    to: [to],
    subject: 'Bienvenido a MGP Rutina Fitness',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>¡Bienvenido a MGP Rutina Fitness!</h2>
        <p>Hola ${name ?? 'usuario'},</p>
        <p>Tu cuenta ha sido creada correctamente.</p>
        <p>Ya puedes comenzar a crear rutinas, explorar sugerencias y aprovechar las herramientas de la aplicación.</p>
        <p>Gracias por formar parte de este proyecto.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || 'No se pudo enviar el correo de bienvenida');
  }

  return data;
}