import express from 'express';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET!, { apiVersion: '2023-08-16' });
const router = express.Router();

router.post('/stripe', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      // помечаем donation как подтверждённый, начисляем звезды пользователю, пушим в socket
    }
    res.json({received: true});
  } catch (e) {
    res.status(400).send(`Webhook error: ${(e as Error).message}`);
  }
});
export default router;