import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Email would be sent:', options);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Petwellly" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  resetToken: string
): Promise<void> => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  await sendEmail({
    to,
    subject: 'Restablecer tu contraseña - Petwellly',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1d1d1f; margin-bottom: 20px;">Restablecer contraseña</h1>
        <p style="font-size: 17px; color: #333; line-height: 1.5;">
          Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para continuar:
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #0071e3; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin: 20px 0; font-size: 17px;">
          Restablecer contraseña
        </a>
        <p style="font-size: 14px; color: #666;">
          Si no solicitaste este cambio, puedes ignorar este correo. El enlace expirará en 1 hora.
        </p>
      </div>
    `,
  });
};

export const sendReservationNotification = async (
  to: string,
  type: 'new' | 'confirmed' | 'cancelled' | 'completed',
  reservationData: {
    dogName: string;
    kennelName: string;
    status: string;
  }
): Promise<void> => {
  const subjects = {
    new: 'Nueva solicitud de reserva - Petwellly',
    confirmed: 'Reserva confirmada - Petwellly',
    cancelled: 'Reserva cancelada - Petwellly',
    completed: 'Compra completada - Petwellly',
  };

  const messages = {
    new: `Has recibido una nueva solicitud de reserva para ${reservationData.dogName}.`,
    confirmed: `Tu reserva para ${reservationData.dogName} ha sido confirmada.`,
    cancelled: `Tu reserva para ${reservationData.dogName} ha sido cancelada.`,
    completed: `La compra de ${reservationData.dogName} ha sido completada exitosamente.`,
  };

  await sendEmail({
    to,
    subject: subjects[type],
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1d1d1f; margin-bottom: 20px;">${subjects[type]}</h1>
        <p style="font-size: 17px; color: #333; line-height: 1.5;">
          ${messages[type]}
        </p>
        <p style="font-size: 17px; color: #333; line-height: 1.5;">
          <strong>Criadero:</strong> ${reservationData.kennelName}<br>
          <strong>Perro:</strong> ${reservationData.dogName}<br>
          <strong>Estado:</strong> ${reservationData.status}
        </p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #0071e3; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin: 20px 0; font-size: 17px;">
          Ver en el sistema
        </a>
      </div>
    `,
  });
};

export const sendWelcomeEmail = async (
  to: string,
  name: string,
  tempPassword?: string
): Promise<void> => {
  const hasTempPassword = tempPassword
    ? `<p style="font-size: 17px; color: #333; line-height: 1.5;">
        <strong>Tu contraseña temporal:</strong> ${tempPassword}
       </p>
       <p style="font-size: 14px; color: #666;">
         Por seguridad, te recomendamos cambiar tu contraseña al iniciar sesión.
       </p>`
    : '';

  await sendEmail({
    to,
    subject: 'Bienvenido a Petwellly',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 28px; color: #1d1d1f; margin-bottom: 20px; font-weight: 600;">¡Bienvenido, ${name}!</h1>
        <p style="font-size: 17px; color: #333; line-height: 1.5;">
          Tu cuenta en Petwellly ha sido creada exitosamente.
        </p>
        ${hasTempPassword}
        <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background: #0071e3; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin: 20px 0; font-size: 17px;">
          Iniciar sesión
        </a>
        <p style="font-size: 14px; color: #666;">
          Si tienes alguna pregunta, no dudes en contactarnos.
        </p>
      </div>
    `,
  });
};
