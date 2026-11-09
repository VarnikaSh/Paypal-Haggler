const { askClaude } = require("./claude");

const MAX_TURNS = 10;

const BUYER_STYLES = {
    aggressive:
        "Be assertive, start with low offers, and negotiate firmly.",

    friendly:
        "Be polite, cooperative, and maintain a friendly tone.",

    strategic:
        "Analyze previous offers and make calculated counteroffers.",

    budget:
        "Be extremely budget-conscious and avoid unnecessary concessions."
};

function roundMoney(value) {
    return Math.round(value * 100) / 100;
}

function validateResponse(response) {

    if (
        !response ||
        typeof response.message !== "string" ||
        response.message.trim().length === 0 ||
        !Number.isFinite(Number(response.offer)) ||
        !["offer", "accept", "walk"].includes(response.action)
    ) {

        throw new Error("Invalid AI negotiation response.");

    }

    const offer = Number(response.offer);

    if (!Number.isFinite(offer) || offer <= 0) {

        throw new Error("AI generated an invalid price.");

    }

    return {

        message: response.message.trim().slice(0, 300),

        offer: roundMoney(offer),

        action: response.action

    };

}

function extractJSON(text) {
    if(typeof text !== "string") {
        console.error("Invalid AI response received:", text);
        throw new Error("AI response must be a string.");
    }
    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end < start) {
        throw new Error("Claude returned invalid JSON.");
    }

    return JSON.parse(cleaned.slice(start, end + 1));

}

function createSystemPrompt(role, deal) {

    const commonRules = `

You are participating in a professional price negotiation.

Respond ONLY with a valid JSON object:

{
    "message": "Your negotiation message",
    "offer": 850,
    "action": "offer"
}

Available actions:

- offer: Make a counteroffer.
- accept: Accept the other agent's latest offer.
- walk: End negotiations.

Important rules:

1. Never reveal your private financial information.
2. Never invent product specifications.
3. Never claim that the other agent has accepted an offer unless they have.
4. Keep your message concise and professional.
5. Always provide a numeric offer.
6. Do not include markdown outside the JSON object.

`;


    if (role === "seller") {

        return `

You are an AI SELLER negotiation agent.

Product: ${deal.item}

Original listing price: $${deal.listPrice}

YOUR PRIVATE MINIMUM: $${deal.sellerMin}

STRICT FINANCIAL RULE:

You must never offer or accept a price below your private minimum.

Seller rules:

${deal.sellerRules || "No additional rules."}

Negotiation strategy:

- Begin near the listing price.
- Make gradual concessions.
- Protect the seller's financial interests.
- Consider the buyer's previous offers.
- Accept a reasonable offer when appropriate.

${commonRules}

`;

    }


    const style =
        BUYER_STYLES[deal.buyerStyle] ||
        BUYER_STYLES.friendly;


    return `

You are an AI BUYER negotiation agent.

Product: ${deal.item}

Original listing price: $${deal.listPrice}

YOUR PRIVATE MAXIMUM: $${deal.buyerMax}

STRICT FINANCIAL RULE:

You must never offer or accept a price above your private maximum.

Your negotiation personality:

${style}

Negotiation strategy:

- Begin with a reasonable low offer.
- Make calculated concessions.
- Consider the seller's previous offers.
- Protect the buyer's budget.
- Accept a reasonable offer when appropriate.

${commonRules}

`;

}

async function getAgentResponse(
    role,
    deal,
    conversation
) {

    const systemPrompt =
        createSystemPrompt(role, deal);


    const userPrompt = `

Previous negotiation:

${
    conversation.length === 0

        ? "No previous messages."

        : conversation.map(entry => {

            return `
${entry.role.toUpperCase()}:
${entry.message}
Offer: $${entry.offer}
`;

        }).join("\n")

}

It is your turn to negotiate.

Consider the previous offer carefully.

Return ONLY a valid JSON object.

`;


    const raw = await askClaude(
        systemPrompt,
        userPrompt
    );

    const parsed = extractJSON(raw);

    return validateResponse(parsed);

}

async function negotiate(deal) {

    const conversation = [];

    let lastOffer = {

        seller: null,

        buyer: null

    };

    let agreedPrice = null;

    let outcome = "no_deal";


    for (
        let turn = 0;
        turn < MAX_TURNS;
        turn++
    ) {

        const role =
            turn % 2 === 0
                ? "seller"
                : "buyer";


        const otherRole =
            role === "seller"
                ? "buyer"
                : "seller";


        let response;

        try {

            response = await getAgentResponse(
                role,
                deal,
                conversation
            );

            console.log("AI NEGOTIATION DEBUG:", {
                role,
                message: response.message,
                offer: response.offer,
                action: response.action
            });

        } catch (error) {

            console.error(
                `${role} agent failed:`,
                error.message
            );

            outcome = "agent_error";

            break;

        }

        let offer = roundMoney(response.offer);

        const minimum = deal.sellerMin;

        const maximum = deal.buyerMax;

        if (role === "seller" && offer < minimum) {

            conversation.push({

                role,

                message:
                    "Seller agent generated an offer below its permitted minimum.",

                offer: null,

                action: "invalid"

            });

            outcome = "agent_error";

            break;

        }


        if (role === "buyer" && offer > maximum) {

            conversation.push({

                role,

                message:
                    "Buyer agent generated an offer above its permitted maximum.",

                offer: null,

                action: "invalid"

            });

            outcome = "agent_error";

            break;

        }

        if (response.action === "walk") {

            conversation.push({

                role,

                message: response.message,

                offer,

                action: "walk"

            });

            outcome = "walked_away";

            break;

        }

        if (response.action === "accept") {

            const previousOffer =
                lastOffer[otherRole];


            if (previousOffer !== null) {

                const validPrice =
                    previousOffer >= minimum &&
                    previousOffer <= maximum;


                if (validPrice) {

                    agreedPrice = previousOffer;

                    conversation.push({

                        role,

                        message: response.message,

                        offer: agreedPrice,

                        action: "accept"

                    });

                    outcome = "deal";

                    break;

                }

            }

            conversation.push({

                role,

                message:
                    "No valid previous offer was available to accept.",

                offer,

                action: "offer"

            });

            lastOffer[role] = offer;

            continue;

        }

        lastOffer[role] = offer;

        conversation.push({

            role,

            message: response.message,

            offer,

            action: "offer"

        });

        if (
            lastOffer.seller !== null &&
            lastOffer.buyer !== null &&
            lastOffer.buyer >= lastOffer.seller
        ) {

            agreedPrice = roundMoney(
                (
                    lastOffer.seller +
                    lastOffer.buyer
                ) / 2
            );

            if (
                agreedPrice >= minimum &&
                agreedPrice <= maximum
            ) {

                outcome = "deal";

            } else {

                agreedPrice = null;

                outcome = "no_deal";

            }

            break;

        }

    }


    return {

        conversation,

        agreedPrice,

        outcome,

        totalTurns: conversation.length

    };

}

module.exports = {

    negotiate,

    BUYER_STYLES

};