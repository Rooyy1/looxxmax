const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Для обслуживания HTML файла

// Данные для ЮKassa
const shopId = process.env.YOOKASSA_SHOP_ID;
const secretKey = process.env.YOOKASSA_SECRET_KEY;

// Создание платежа
app.post('/api/create-payment', async (req, res) => {
    try {
        const { plan, amount, userId, userEmail } = req.body;

        const idempotenceKey = crypto.randomUUID();

        const paymentData = {
            amount: {
                value: amount.toString(),
                currency: 'RUB'
            },
            payment_method_data: {
                type: 'bank_card'
            },
            confirmation: {
                type: 'redirect',
                return_url: `${process.env.SITE_URL || 'http://localhost:3000'}/?payment_success=true`
            },
            description: `Подписка ${plan} для пользователя ${userId}`,
            metadata: {
                userId: userId,
                plan: plan,
                userEmail: userEmail
            },
            capture: true
        };

        const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

        const response = await fetch('https://api.yookassa.ru/v3/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(paymentData)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.description);
        }

        res.json({
            success: true,
            confirmationUrl: data.confirmation.confirmation_url,
            paymentId: data.id
        });

    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Webhook для уведомлений от ЮKassy (опционально)
app.post('/api/webhook', async (req, res) => {
    try {
        const event = req.body;

        if (event.event === 'payment.succeeded') {
            const { metadata, id } = event.object;
            console.log(`Платеж ${id} успешен! Пользователь: ${metadata.userId}, План: ${metadata.plan}`);
            // Здесь можно сохранить в БД, отправить email и т.д.
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
    console.log(`📱 Откройте: http://localhost:${PORT}`);
});