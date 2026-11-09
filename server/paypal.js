require("dotenv").config();

const crypto = require("crypto");

const PAYPAL_BASE_URL =
    process.env.PAYPAL_BASE_URL ||
    "https://api-m.sandbox.paypal.com";

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

async function getAccessToken() {

    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("PayPal credentials are missing.");
    }

    const auth = Buffer.from(
        `${CLIENT_ID}:${CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(
        `${PAYPAL_BASE_URL}/v1/oauth2/token`,
        {
            method: "POST",

            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },

            body: "grant_type=client_credentials"
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.access_token) {

        console.error("PayPal authentication error:", data);

        throw new Error("PayPal authentication failed.");
    }

    return data.access_token;
}

async function paypalRequest(
    endpoint,
    method = "GET",
    body = null,
    requestId = null
) {

    const accessToken = await getAccessToken();

    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
    };

    if (requestId) {
        headers["PayPal-Request-Id"] = requestId;
    }

    const options = {
        method,
        headers
    };

    if (body !== null) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(
        `${PAYPAL_BASE_URL}${endpoint}`,
        options
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {

        console.error("PayPal API error:", data);

        throw new Error(
            data.message || "PayPal request failed."
        );
    }

    return data;
}

async function createOrder(deal) {

    if (
        !deal ||
        typeof deal.id !== "string" ||
        !deal.d ||
        typeof deal.d.item !== "string" ||
        !Number.isFinite(deal.price) ||
        deal.price <= 0
    ) {

        throw new Error("Invalid deal information.");
    }

    const amount = deal.price.toFixed(2);

    const requestId = crypto.randomUUID();

    const order = await paypalRequest(
        "/v2/checkout/orders",
        "POST",
        {
            intent: "CAPTURE",

            purchase_units: [
                {
                    reference_id: deal.id,

                    description:
                        `PayPal Haggler: ${deal.d.item}`.slice(0, 127),

                    amount: {
                        currency_code: "USD",
                        value: amount
                    }
                }
            ],

            application_context: {
                brand_name: "PayPal Haggler",
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING"
            }
        },
        requestId
    );

    if (!order.id) {
        throw new Error("PayPal did not return an order ID.");
    }

    return {
        orderId: order.id,
        status: order.status
    };
}

async function captureOrder(orderId) {

    if (
        typeof orderId !== "string" ||
        !/^[A-Z0-9]+$/i.test(orderId)
    ) {

        throw new Error("Invalid PayPal order ID.");
    }

    return await paypalRequest(
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        "POST",
        {}
    );
}

function verifyPayment(
    capture,
    expectedAmount,
    expectedOrderId = null,
    expectedDealId = null
) {

    if (
        !capture ||
        capture.status !== "COMPLETED"
    ) {
        return false;
    }

    if (
        expectedOrderId &&
        capture.id !== expectedOrderId
    ) {
        return false;
    }

    const purchaseUnits =
        capture.purchase_units || [];

    if (purchaseUnits.length !== 1) {
        return false;
    }

    const purchaseUnit = purchaseUnits[0];

    if (
        expectedDealId &&
        purchaseUnit.reference_id !== expectedDealId
    ) {
        return false;
    }

    const captures =
        purchaseUnit.payments?.captures || [];

    if (captures.length !== 1) {
        return false;
    }

    const payment = captures[0];

    if (payment.status !== "COMPLETED") {
        return false;
    }

    if (
        payment.amount?.currency_code !== "USD" ||
        payment.amount?.value !== expectedAmount.toFixed(2)
    ) {
        return false;
    }

    return true;
}

module.exports = {
    getAccessToken,
    paypalRequest,
    createOrder,
    captureOrder,
    verifyPayment
};