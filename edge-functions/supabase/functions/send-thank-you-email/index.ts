import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

// Google SMTP credentials - should be set as environment variables
const SMTP_USER = Deno.env.get('SMTP_USER');  // Gmail account email
const SMTP_PASS = Deno.env.get('SMTP_PASS');  // Gmail app password

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': 'https://wasinuddy.github.io',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { email } = await req.json(); // Extract email from the request body

    // Setup the SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    await client.send({
      from: SMTP_USER,
      to: email,
      subject: "Thanks for Rating My Talk!",
      content: `Hey there,

Just wanted to say a huge thank you for attending my session and taking the time to rate it! I really appreciate it. Hope you found it interesting and maybe even picked up something useful.

Enjoy the rest of the Supabase Meetup—there's still plenty of awesome stuff happening! If you ever want to chat more about Supabase (or just tech in general), feel free to reach out.

Catch you around!

— Wasin Silakong
Powered by Supabase Edge Functions`
    });

    await client.close(); // Close the client after sending

    return new Response(
        JSON.stringify({ message: 'Thank you email sent successfully!' }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://wasinuddy.github.io" } }
    );
  } catch (error) {
    console.error('Error sending thank-you email:', error);
    return new Response(
        JSON.stringify({ message: 'Error sending thank-you email' }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://wasinuddy.github.io" } }
    );
  }
});
