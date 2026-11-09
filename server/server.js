require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");

const { negotiate } = require("./negotiation");
const { evaluateDeal } = require("./referee");

const {
    createDealTokens,
    hashToken,
    authorizeParticipant,
    validateDealInputs
} = require("./security");

const {
    createOrder,
    captureOrder,
    verifyPayment
} = require("./paypal");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(cors({
    origin: process.env.APP_ORIGIN || `http://localhost:${PORT}`
}));

app.use(express.json({ limit: "20kb" }));

app.use(express.static(path.join(__dirname, "../public")));

app.use("/api", rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false
}));

const deals = new Map();

function getAuthorizedDeal(req, res, side) {

    const deal = deals.get(req.params.id);

    if (!deal) {
        res.status(404).json({
            error: "Deal not found."
        });

        return null;
    }

    const token = req.headers["x-deal-token"];

    if (!authorizeParticipant(deal, side, token)) {

        res.status(403).json({
            error: "Unauthorized participant."
        });

        return null;
    }

    return deal;
}

app.get("/api/health", (req, res) => {

    res.json({
        status: "online",
        application: "PayPal Haggler",
        timestamp: new Date().toISOString()
    });

});

app.get("/api/config", (req, res) => {

    if (!process.env.PAYPAL_CLIENT_ID) {

        return res.status(503).json({
            error: "PayPal Client ID is not configured."
        });

    }

    res.json({
        clientId: process.env.PAYPAL_CLIENT_ID,
        currency: "USD"
    });

});

app.post("/api/negotiate", async (req, res) => {

    try {

        const input = validateDealInputs(req.body);

        const deal = {

            ...input,

            sellerRules: String(
                req.body.sellerRules || ""
            ).slice(0, 200),

            buyerStyle: String(
                req.body.buyerStyle || "friendly"
            ).slice(0, 30)

        };

        const id = crypto.randomUUID();

        const tokens = createDealTokens();

        const result = await negotiate(deal);

        const storedDeal = {

            id,

            d: deal,

            conversation: result.conversation,

            outcome: result.outcome,

            price: result.agreedPrice,

            totalTurns: result.totalTurns,

            receipt: null,

            fairness: null,

            approved: {
                seller: false,
                buyer: false
            },

            sellerTokenHash: hashToken(tokens.sellerToken),

            buyerTokenHash: hashToken(tokens.buyerToken),

            paypalOrderId: null,

            paymentStatus: "NOT_CREATED",

            createdAt: new Date().toISOString()

        };

        if (result.outcome === "deal") {

            const referee = await evaluateDeal(
                deal,
                result.conversation,
                result.agreedPrice
            );

            storedDeal.receipt = referee.receipt;

            storedDeal.fairness = referee.score;

            storedDeal.buyerSavings = referee.buyerSavings;

            storedDeal.sellerMargin = referee.sellerMargin;

            storedDeal.refereeApproved = referee.fair;

            if (!referee.fair) {

                storedDeal.outcome = "blocked_by_referee";

            }

        } else {

            storedDeal.refereeApproved = false;

        }


        deals.set(id, storedDeal);

        res.status(201).json({

            dealId: id,

            conversation: storedDeal.conversation,

            outcome: storedDeal.outcome,

            price: storedDeal.price,

            receipt: storedDeal.receipt,

            fairnessScore: storedDeal.fairness,

            buyerSavings: storedDeal.buyerSavings,

            sellerMargin: storedDeal.sellerMargin,

            totalTurns: storedDeal.totalTurns,

            credentials: {
                sellerToken: tokens.sellerToken,
                buyerToken: tokens.buyerToken
            }

        });

    } catch (error) {

        console.error("Negotiation error:", error);

        res.status(400).json({
            error: error.message || "Negotiation failed."
        });

    }

});

app.post("/api/deals/:id/approve", (req, res) => {

    const side = req.body.side;

    if (!["seller", "buyer"].includes(side)) {

        return res.status(400).json({
            error: "Invalid participant."
        });

    }

    const deal = getAuthorizedDeal(req, res, side);

    if (!deal) return;

    if (
        deal.outcome !== "deal" ||
        deal.refereeApproved !== true
    ) {

        return res.status(403).json({
            error: "This deal cannot be approved."
        });

    }

    if (deal.paymentStatus === "COMPLETED") {

        return res.status(409).json({
            error: "Payment is already completed."
        });

    }

    deal.approved[side] = true;

    const bothApproved =
        deal.approved.seller &&
        deal.approved.buyer;

    res.json({

        success: true,

        approved: deal.approved,

        bothApproved

    });

});

app.post("/api/orders", async (req, res) => {

    try {

        const dealId = req.body.dealId;

        const deal = deals.get(dealId);

        if (!deal) {

            return res.status(404).json({
                error: "Deal not found."
            });

        }

        if (!authorizeParticipant(
            deal,
            "buyer",
            req.headers["x-deal-token"]
        )) {

            return res.status(403).json({
                error: "Buyer authorization failed."
            });

        }

        if (
            deal.outcome !== "deal" ||
            deal.refereeApproved !== true
        ) {

            return res.status(403).json({
                error: "Deal is not eligible for payment."
            });

        }

        if (!deal.approved.seller || !deal.approved.buyer) {

            return res.status(403).json({
                error: "Both participants must approve."
            });

        }

        if (deal.paymentStatus === "COMPLETED") {

            return res.status(409).json({
                error: "Payment already completed."
            });

        }

        if (deal.paypalOrderId) {

            return res.json({
                orderId: deal.paypalOrderId
            });

        }

        const order = await createOrder({

            id: deal.id,

            d: deal.d,

            price: deal.price

        });

        deal.paypalOrderId = order.orderId;

        deal.paymentStatus = "ORDER_CREATED";

        res.status(201).json({

            orderId: order.orderId,

            status: order.status

        });

    } catch (error) {

        console.error("Order creation error:", error);

        res.status(500).json({
            error: "Unable to create PayPal order."
        });

    }

});

app.post("/api/orders/:id/capture", async (req, res) => {

    try {

        const deal = deals.get(req.body.dealId);

        if (!deal) {

            return res.status(404).json({
                error: "Deal not found."
            });

        }

        if (!authorizeParticipant(
            deal,
            "buyer",
            req.headers["x-deal-token"]
        )) {

            return res.status(403).json({
                error: "Buyer authorization required."
            });

        }

        if (
            deal.paymentStatus === "COMPLETED" &&
            deal.captureResult
        ) {

            return res.json(deal.captureResult);

        }

        if (
            !deal.approved.seller ||
            !deal.approved.buyer ||
            deal.refereeApproved !== true
        ) {

            return res.status(403).json({
                error: "Approval requirements not satisfied."
            });

        }

        const orderId = req.params.id;

        if (
            !deal.paypalOrderId ||
            deal.paypalOrderId !== orderId
        ) {

            return res.status(403).json({
                error: "Order does not belong to this deal."
            });

        }

        if (deal.paymentStatus !== "ORDER_CREATED") {

            return res.status(409).json({
                error: "Order is not ready for capture."
            });

        }

        const capture = await captureOrder(orderId);

        const valid = verifyPayment(
            capture,
            deal.price,
            orderId,
            deal.id
        );

        if (!valid) {

            deal.paymentStatus = "CAPTURE_REVIEW";

            return res.status(400).json({
                error: "Payment verification failed."
            });

        }

        deal.paymentStatus = "COMPLETED";

        deal.captureResult = {

            success: true,

            status: capture.status,

            orderId: capture.id,

            price: deal.price,

            currency: "USD",

            captureId:
                capture.purchase_units?.[0]
                    ?.payments?.captures?.[0]?.id || null

        };

        res.json(deal.captureResult);

    } catch (error) {

        console.error("Payment capture error:", error);

        res.status(500).json({
            error: "Payment capture failed. Check PayPal order status before retrying."
        });

    }

});

app.get("/api/deals/:id/receipt", (req, res) => {

    const deal = deals.get(req.params.id);

    if (!deal) {

        return res.status(404).json({
            error: "Deal not found."
        });

    }

    const token = req.headers["x-deal-token"];

    const authorized =
        authorizeParticipant(deal, "buyer", token) ||
        authorizeParticipant(deal, "seller", token);

    if (!authorized) {

        return res.status(403).json({
            error: "Unauthorized."
        });

    }

    if (deal.paymentStatus !== "COMPLETED") {

        return res.status(403).json({
            error: "Payment has not been completed."
        });

    }

    res.json({

        item: deal.d.item,

        price: deal.price,

        originalPrice: deal.d.listPrice,

        negotiationTurns: deal.totalTurns,

        fairnessScore: deal.fairness,

        receipt: deal.receipt,

        captureId: deal.captureResult?.captureId,

        payment: deal.captureResult,

        createdAt: deal.createdAt

    });

});

app.listen(PORT, () => {

    console.log("-----------------------------------");

    console.log("PAYPAL HAGGLER");

    console.log("-----------------------------------");

    console.log(`Server running at http://localhost:${PORT}`);

    console.log("AI negotiation engine: Ready");

    console.log("PayPal integration: Sandbox");

    console.log("-----------------------------------");

});