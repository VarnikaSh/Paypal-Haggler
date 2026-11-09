const { askClaude } = require("./claude");

function calculateFairDealScore(deal, agreedPrice) {

    const {
        listPrice,
        sellerMin,
        buyerMax
    } = deal;


    if (
        !Number.isFinite(agreedPrice) ||
        agreedPrice < sellerMin ||
        agreedPrice > buyerMax
    ) {

        return {
            score: 0,

            explanation:
                "The agreed price violates a private financial limit."
        };

    }


    const midpoint =
        (sellerMin + buyerMax) / 2;

    const range =
        buyerMax - sellerMin;


    let score = 100;


    if (range > 0) {

        const distance =
            Math.abs(agreedPrice - midpoint);

        score = Math.round(
            100 * (1 - distance / (range / 2))
        );

        score = Math.max(
            0,
            Math.min(100, score)
        );

    }


    return {

        score,

        midpoint: Number(
            midpoint.toFixed(2)
        ),

        buyerSavings: Number(
            (listPrice - agreedPrice).toFixed(2)
        ),

        sellerMargin: Number(
            (agreedPrice - sellerMin).toFixed(2)
        )

    };

}

function extractJSON(text) {

    if (typeof text !== "string") {
        throw new Error("Invalid referee response.");
    }

    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const start = cleaned.indexOf("{");

    const end = cleaned.lastIndexOf("}");

    if (
        start === -1 ||
        end === -1 ||
        end < start
    ) {

        throw new Error(
            "Referee did not return valid JSON."
        );

    }

    return JSON.parse(
        cleaned.slice(start, end + 1)
    );

}

function parseRefereeResponse(text) {

    const result = extractJSON(text);

    if (
        typeof result.fair !== "boolean" ||
        typeof result.receipt !== "string" ||
        result.receipt.trim().length === 0
    ) {

        throw new Error(
            "Invalid referee response structure."
        );

    }


    return {

        fair: result.fair,

        receipt: result.receipt
            .trim()
            .slice(0, 400)

    };

}

function validateTranscript(conversation) {

    if (
        !Array.isArray(conversation) ||
        conversation.length === 0
    ) {

        throw new Error(
            "Negotiation transcript is missing."
        );

    }


    const allowedRoles = [
        "seller",
        "buyer"
    ];


    for (const entry of conversation) {

        if (
            !allowedRoles.includes(entry.role) ||
            typeof entry.message !== "string"
        ) {

            throw new Error(
                "Invalid negotiation transcript."
            );

        }

    }


    return conversation.map(entry => {

        const offer =
            Number.isFinite(Number(entry.offer))
                ? `$${Number(entry.offer).toFixed(2)}`
                : "No valid offer";


        return (
            `${entry.role.toUpperCase()}: ` +
            `${entry.message} | Offer: ${offer}`
        );

    }).join("\n");

}

async function evaluateDeal(
    deal,
    conversation,
    agreedPrice
) {

    if (
        !Number.isFinite(agreedPrice) ||
        agreedPrice < deal.sellerMin ||
        agreedPrice > deal.buyerMax
    ) {

        return {

            fair: false,

            score: 0,

            receipt:
                "Deal rejected because the agreed price violates financial limits."

        };

    }

    const fairness = calculateFairDealScore(
        deal,
        agreedPrice
    );

    let transcript;

    try {

        transcript = validateTranscript(
            conversation
        );

    } catch (error) {

        return {

            fair: false,

            score: fairness.score,

            receipt:
                "Deal requires manual review because the negotiation transcript is invalid."

        };

    }

    const systemPrompt = `

You are the independent AI referee for PayPal Haggler.

Your role is to review a completed buyer-seller negotiation.

Evaluate the following:

1. Whether the conversation appears transparent.
2. Whether either agent made misleading claims.
3. Whether either participant appears to have used unreasonable pressure.
4. Whether the final agreement is consistent with the negotiation transcript.

IMPORTANT RULES:

- You cannot see either participant's private financial limit.
- You cannot independently verify product quality.
- You cannot verify participant identities.
- You cannot guarantee that the negotiated price represents market value.
- You must not override server-side financial validation.
- Do not invent information.
- Be conservative when evidence is insufficient.

Respond ONLY in JSON:

{
    "fair": true,
    "receipt": "A concise explanation of your decision."
}

The fair field must be a boolean.

`;

    const userPrompt = `

PRODUCT: ${deal.item}

ORIGINAL LIST PRICE: $${deal.listPrice}

AGREED PRICE: $${agreedPrice}

MATHEMATICAL NEGOTIATION SCORE:
${fairness.score}/100

NEGOTIATION TRANSCRIPT:

${transcript}

Evaluate this agreement independently.

Return only the required JSON.

`;

    try {

        const response = await askClaude(
            systemPrompt,
            userPrompt
        );


        const result = parseRefereeResponse(
            response
        );

        return {

            fair: result.fair,

            receipt: result.receipt,

            score: fairness.score,

            buyerSavings: fairness.buyerSavings,

            sellerMargin: fairness.sellerMargin,

            midpoint: fairness.midpoint

        };


    } catch (error) {

        console.error(
            "Referee evaluation failed:",
            error.message
        );

        return {

            fair: false,

            score: fairness.score,

            receipt:
                "Deal requires manual review because the AI referee could not complete its evaluation."

        };

    }

}

module.exports = {

    evaluateDeal,

    calculateFairDealScore

};