export default {
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: false,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    },
    default: {
        from: 'Rodrigo Topan <noreply@rodrigo.com.br>' 
    }
}

/**
 * Amazon SES
 * Mailgun
 * Sparkpost
 * Mandril(mailchimp)
 * Gmail(not cool)
 * Mailtrap(jus development)
 */