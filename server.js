const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Ключи из .env
const SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Отдаем конфиг фронтенду
app.get('/api/config', (req, res) => {
    res.json({
        googleClientId: GOOGLE_CLIENT_ID,
        openAiApiKey: OPENAI_API_KEY
    });
});

// Анализ лица через OpenAI
app.post('/api/analyze-face', async (req, res) => {
    try {
        const { problem, photoDataUrl } = req.body;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Верни ТОЛЬКО JSON. Если нет лица: {"error": "no_face"}. 
                            Иначе: {"overall_potential": число, "features": [{"name": "Челюсть", "status": "...", "potential": число, "plan": "..."}, ...]}
                            Пожелание: ${problem}`
                        },
                        { type: "image_url", image_url: { url: photoDataUrl, detail: "high" } }
                    ]
                }],
                max_tokens: 2000,
                temperature: 1.2
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Парсим JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const result = JSON.parse(jsonMatch[0]);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Создание платежа в ЮKassa
app.post('/api/create-payment', async (req, res) => {
    try {
        const { plan, amount, userId } = req.body;

        const paymentData = {
            amount: { value: amount.toString(), currency: 'RUB' },
            confirmation: {
                type: 'redirect',
                return_url: `${process.env.SITE_URL || 'http://localhost:3000'}?payment_success=true`
            },
            description: `Подписка ${plan} для ${userId}`
        };

        const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');

        const response = await fetch('https://api.yookassa.ru/v3/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(paymentData)
        });

        const data = await response.json();

        res.json({
            success: true,
            confirmationUrl: data.confirmation.confirmation_url
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Сервер на http://localhost:${PORT}`);
});